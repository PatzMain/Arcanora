import { describe, it, expect, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';
import * as schema from '../packages/database/src/schema.js';
import { runLocalMigrations } from '../packages/database/src/localMigrator.js';

describe('PGlite WASM Local-First Database Adapter', () => {
  let pglite: PGlite;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  beforeEach(async () => {
    // Spin up a clean in-memory PGlite WASM instance
    pglite = new PGlite();
    await runLocalMigrations(pglite);
    db = drizzle(pglite, { schema });
  });

  it('should successfully run all embedded migrations into PGlite', async () => {
    const tables = await pglite.query<{ table_name: string }>(`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
    `);
    const tableNames = tables.rows.map(r => r.table_name);

    expect(tableNames).toContain('players');
    expect(tableNames).toContain('player_stats');
    expect(tableNames).toContain('inventory');
    expect(tableNames).toContain('combat_sessions');
    expect(tableNames).toContain('exploration_sessions');
  });

  it('should insert, query, and update player records cleanly', async () => {
    const newPlayer = await db.insert(schema.players).values({
      discordId: 'web_player_1001',
      username: 'ValeriusTheBrave',
      playerClass: 'Warrior',
      gold: 1500,
      stamina: 100
    }).returning();

    expect(newPlayer.length).toBe(1);
    expect(newPlayer[0].username).toBe('ValeriusTheBrave');
    expect(newPlayer[0].gold).toBe(1500);

    // Query player back
    const fetched = await db.query.players.findFirst({
      where: eq(schema.players.discordId, 'web_player_1001')
    });
    expect(fetched).toBeDefined();
    expect(fetched?.playerClass).toBe('Warrior');

    // Update gold
    await db.update(schema.players)
      .set({ gold: 2500, stamina: 85 })
      .where(eq(schema.players.id, newPlayer[0].id));

    const updated = await db.query.players.findFirst({
      where: eq(schema.players.id, newPlayer[0].id)
    });
    expect(updated?.gold).toBe(2500);
    expect(updated?.stamina).toBe(85);
  });

  it('should support relational transactions and cascades', async () => {
    await db.transaction(async (tx) => {
      const [player] = await tx.insert(schema.players).values({
        discordId: 'tx_player_2002',
        username: 'Astraea',
        playerClass: 'Mage'
      }).returning();

      await tx.insert(schema.playerStats).values({
        playerId: player.id,
        attack: 25,
        defense: 12,
        hpMax: 120,
        manaMax: 180
      });

      await tx.insert(schema.inventory).values([
        { playerId: player.id, itemId: 'staff_novice', quantity: 1 },
        { playerId: player.id, itemId: 'potion_health_small', quantity: 5 }
      ]);
    });

    const playerWithItems = await db.query.players.findFirst({
      where: eq(schema.players.discordId, 'tx_player_2002')
    });
    expect(playerWithItems).toBeDefined();

    const items = await db.select().from(schema.inventory).where(eq(schema.inventory.playerId, playerWithItems!.id));
    expect(items.length).toBe(2);
  });
});
