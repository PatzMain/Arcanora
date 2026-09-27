import { describe, it, expect, beforeEach } from 'vitest';
import {
  itemsCatalog,
  zonesCatalog,
  enemiesCatalog,
  classesCatalog,
  mapConfig,
  generateDungeonMap,
  createCombatState,
  executeCombatTurn,
  devCheats
} from '../packages/core/src/index.js';
import * as schema from '../packages/database/src/schema.js';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';
import { runLocalMigrations } from '../packages/database/src/localMigrator.js';

describe('Frontend & Core Game Engine Synchronization Suite', () => {
  let pglite: PGlite;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  beforeEach(async () => {
    pglite = new PGlite();
    await runLocalMigrations(pglite);
    db = drizzle(pglite, { schema });
  });

  it('should ensure all 24 world map zones have valid coordinates matching mapConfig', () => {
    const locations = mapConfig.locations as Record<string, { x: number; y: number; type: string }>;
    expect(Object.keys(locations).length).toBe(24);

    for (const [zoneId, loc] of Object.entries(locations)) {
      expect(loc.x).toBeGreaterThanOrEqual(0);
      expect(loc.y).toBeGreaterThanOrEqual(0);
      expect(['settlement', 'dungeon', 'wilderness']).toContain(loc.type);

      const zoneDef = zonesCatalog.find(z => z.id === zoneId);
      expect(zoneDef).toBeDefined();
    }
  });

  it('should synchronize web character creation with database player and stats tables', async () => {
    // 1. Simulate web onboarding hero creation
    const [dbPlayer] = await db.insert(schema.players).values({
      discordId: 'web_hero_test',
      username: 'WebKnight',
      playerClass: 'Warrior',
      currentZoneId: 'oakhaven',
      hpCurrent: 140,
      manaCurrent: 60,
      stamina: 100,
      gold: 500,
      gems: 10
    }).returning();

    await db.insert(schema.playerStats).values({
      playerId: dbPlayer.id,
      hpMax: 140,
      manaMax: 60,
      attack: 32,
      defense: 18,
      speed: 15
    });

    const saved = await db.query.players.findFirst({
      where: eq(schema.players.id, dbPlayer.id),
      with: { stats: true }
    });

    expect(saved).toBeDefined();
    expect(saved?.username).toBe('WebKnight');
    expect(saved?.currentZoneId).toBe('oakhaven');
    expect(saved?.stats?.attack).toBe(32);
  });

  it('should synchronize dungeon grid generation with player exploration states', () => {
    const dungeon = generateDungeonMap('forgotten_ironmine', 5, 1);
    expect(dungeon.nodes).toBeDefined();
    expect(dungeon.startNodeId).toBeDefined();

    const startNode = dungeon.nodes[dungeon.startNodeId];
    expect(startNode.type).toBe('campsite');
    expect(startNode.status).toBe('visited');

    // Verify 6x6 bounds
    for (const node of Object.values(dungeon.nodes)) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThan(6);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThan(6);
    }
  });

  it('should synchronize tactical combat actions with elemental reactions and damage logs', () => {
    const playerStats = {
      hp: 140,
      maxHp: 140,
      mana: 60,
      maxMana: 60,
      attack: 30,
      defense: 15,
      speed: 16,
      critChance: 10,
      critDmg: 150,
      luck: 5,
      element: 'Frost' as const
    };

    const enemyStats = {
      hp: 100,
      attack: 20,
      defense: 5,
      speed: 10
    };

    const state = createCombatState(playerStats, enemyStats);
    state.enemyBuffs.push({
      id: 'f1',
      name: 'Frozen',
      type: 'debuff',
      turnsRemaining: 1
    });

    // Player attacks with Physical weapon against Frozen target
    const result = executeCombatTurn(state, { type: 'attack', element: 'Physical' }, playerStats, enemyStats);

    expect(result.synergy?.reaction).toBe('shatter');
    expect(result.state.combatLog.some(l => l.includes('SHATTER'))).toBe(true);
    expect(result.state.enemyHp).toBeLessThan(100);
  });

  it('should verify Dev Sandbox cheats synchronize correctly with player state', () => {
    const initialPlayer = {
      gold: 50,
      gems: 5,
      level: 1,
      hpCurrent: 20,
      hpMax: 100,
      manaCurrent: 10,
      manaMax: 50,
      stamina: 10,
      staminaMax: 100
    };

    // 1. Refill
    const refilled = { ...initialPlayer, ...devCheats.refillVitals(initialPlayer.hpMax, initialPlayer.manaMax, initialPlayer.staminaMax) };
    expect(refilled.hpCurrent).toBe(100);
    expect(refilled.manaCurrent).toBe(50);
    expect(refilled.stamina).toBe(100);

    // 2. Grant wealth
    const wealthy = { ...refilled, ...devCheats.grantWealth(refilled.gold, refilled.gems, 5000, 250) };
    expect(wealthy.gold).toBe(5050);
    expect(wealthy.gems).toBe(255);

    // 3. Jump level
    const leveled = { ...wealthy, ...devCheats.jumpLevel(20) };
    expect(leveled.level).toBe(20);

    // 4. Teleport
    const warped = devCheats.teleport('crystal_caverns');
    expect(warped.currentZoneId).toBe('crystal_caverns');
  });
});
