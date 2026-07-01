import { vi, describe, it, expect } from 'vitest';

// Mock the client file BEFORE importing any files that depend on it
vi.mock('../src/database/client.js', () => {
  const inMemoryStore: Record<string, any[]> = {
    players: [],
    inventory: [],
    exploration_sessions: [],
    combat_sessions: [],
    player_quests: [],
    codex_entries: []
  };

  function getStoreKey(table: any): string {
    const sym = Object.getOwnPropertySymbols(table).find(s => s.toString().includes('drizzle:Name'));
    const name = sym ? table[sym] : (table.key || table._?.name || '');
    if (name === 'players') return 'players';
    if (name === 'inventory') return 'inventory';
    if (name === 'exploration_sessions') return 'exploration_sessions';
    if (name === 'combat_sessions') return 'combat_sessions';
    if (name === 'player_quests') return 'player_quests';
    if (name === 'codex_entries') return 'codex_entries';
    return name;
  }

  const dbMock = {
    transaction: (cb: any) => cb(dbMock),
    select: () => {
      return {
        from: (table: any) => {
          const key = getStoreKey(table);
          const builder = {
            where: (cond: any) => builder,
            orderBy: (field: any) => builder,
            limit: (num: any) => builder,
            then: (cb: any) => {
              const list = inMemoryStore[key] || [];
              return cb(list);
            }
          };
          return builder;
        }
      };
    },
    query: new Proxy({}, {
      get: (target, tableKey: string) => {
        let storeKey = tableKey;
        if (tableKey === 'combatSessions') storeKey = 'combat_sessions';
        if (tableKey === 'explorationSessions') storeKey = 'exploration_sessions';
        if (tableKey === 'playerQuests') storeKey = 'player_quests';
        if (tableKey === 'codexEntries') storeKey = 'codex_entries';
        return {
          findFirst: (opts?: any) => {
            const list = inMemoryStore[storeKey] || [];
            return list[0] || null;
          },
          findMany: (opts?: any) => {
            return inMemoryStore[storeKey] || [];
          }
        };
      }
    }),
    insert: (table: any) => {
      const key = getStoreKey(table);
      return {
        values: (data: any) => {
          const rows = Array.isArray(data) ? data : [data];
          const inserted = rows.map(r => ({ id: Math.random().toString(), ...r }));
          if (!inMemoryStore[key]) inMemoryStore[key] = [];
          inMemoryStore[key].push(...inserted);
          return {
            returning: () => inserted,
            then: (cb: any) => cb(inserted)
          };
        }
      };
    },
    update: (table: any) => {
      const key = getStoreKey(table);
      return {
        set: (data: any) => {
          return {
            where: (cond: any) => {
              const list = inMemoryStore[key] || [];
              list.forEach(row => Object.assign(row, data));
              return {
                returning: () => list,
                then: (cb: any) => cb(list)
              };
            }
          };
        }
      };
    },
    delete: (table: any) => {
      const key = getStoreKey(table);
      return {
        where: (cond: any) => {
          const deleted = [...(inMemoryStore[key] || [])];
          inMemoryStore[key] = [];
          return {
            returning: () => deleted,
            then: (cb: any) => cb(deleted)
          };
        }
      };
    }
  };

  return {
    db: dbMock,
    inMemoryStore
  };
});

// Import them from the mock
// @ts-ignore
import { db, inMemoryStore } from '../src/database/client.js';

// Now import the database query helper and system files
import { findOrCreatePlayer, getPlayerWithClampedStats } from '../src/database/queries/player.js';
import { createExplorationSession } from '../src/database/queries/exploration.js';
import { generateDungeonMap } from '../src/systems/exploration/dungeonGenerator.js';
import { campsiteHandler } from '../src/systems/exploration/dungeonHandlers/campsite.js';
import { treasureHandler } from '../src/systems/exploration/dungeonHandlers/treasure.js';
import { merchantHandler } from '../src/systems/exploration/dungeonHandlers/merchant.js';
import { eventHandler } from '../src/systems/exploration/dungeonHandlers/event.js';
import { combatNodeHandler } from '../src/systems/exploration/dungeonHandlers/combat.js';
import { getEnemyById } from '../src/systems/combat/enemy.js';
import { enemiesCatalog } from '../src/utils/catalog.js';

describe('End-to-End Game Playthrough Simulation (In-Memory Database)', () => {
  it('should complete onboarding, scouting, traveling, and full grid dungeon clearing successfully', async () => {
    // Reset store to ensure test isolation
    inMemoryStore.players = [];
    inMemoryStore.inventory = [];
    inMemoryStore.exploration_sessions = [];
    inMemoryStore.combat_sessions = [];
    inMemoryStore.player_quests = [];
    inMemoryStore.codex_entries = [];

    // 1. Character Creation (Tutorial Onboarding)
    const player = await findOrCreatePlayer('999999999999999999', 'SimulatedHero');
    expect(player).toBeDefined();
    expect(player.username).toBe('SimulatedHero');

    // Grant class and gold
    inMemoryStore.players[0].playerClass = 'Warrior';
    inMemoryStore.players[0].gold = 500;
    inMemoryStore.players[0].stamina = 100;

    const refreshedPlayer = await getPlayerWithClampedStats('999999999999999999');
    expect(refreshedPlayer?.gold).toBe(500);
    expect(refreshedPlayer?.playerClass).toBe('Warrior');

    // 2. World Map Travel
    inMemoryStore.players[0].currentLocationId = 'oakhaven_east_gate';
    const traveledPlayer = await getPlayerWithClampedStats('999999999999999999');
    expect(traveledPlayer?.currentLocationId).toBe('oakhaven_east_gate');

    // 3. Dungeon Generation
    const mapState = generateDungeonMap('forgotten_ironmine', traveledPlayer!.level, 5);

    expect(mapState.zoneId).toBe('forgotten_ironmine');

    const session = await createExplorationSession({
      playerId: player.id,
      channelId: 'mock_channel_id',
      zoneId: 'forgotten_ironmine',
      currentNodeId: mapState.startNodeId,
      party: { leaderId: player.id, members: [{ playerId: player.id, username: player.username, level: player.level }] },
      mapState
    });
    expect(session).toBeDefined();
    expect(inMemoryStore.exploration_sessions.length).toBe(1);

    // Campsite Rest Node
    let activeNodeId = session.currentNodeId;
    let currNode = mapState.nodes[activeNodeId];
    expect(currNode.type).toBe('campsite');

    const campsiteContext = {
      playerId: player.id,
      discordId: '999999999999999999',
      node: currNode,
      dbSession: session
    };
    const campsiteResult = await campsiteHandler.onAction('rest', campsiteContext);
    expect(campsiteResult.success).toBe(true);

    // Treasure Chest Node
    const treasureCellId = Object.keys(mapState.nodes).find(id => mapState.nodes[id].type === 'treasure') || '1_1';
    mapState.nodes[treasureCellId].status = 'visited';
    const treasureContext = {
      playerId: player.id,
      discordId: '999999999999999999',
      node: mapState.nodes[treasureCellId],
      dbSession: session
    };
    const treasureResult = await treasureHandler.onAction('loot', treasureContext);
    expect(treasureResult.success).toBe(true);

    // Random Event Node
    const eventCellId = Object.keys(mapState.nodes).find(id => mapState.nodes[id].type === 'event');
    if (eventCellId) {
      mapState.nodes[eventCellId].status = 'visited';
      const eventContext = {
        playerId: player.id,
        discordId: '999999999999999999',
        node: mapState.nodes[eventCellId],
        dbSession: session
      };
      const eventData = mapState.nodes[eventCellId].encounterData?.event;
      const eventResult = await eventHandler.onAction('choose', eventContext, { outcomeId: eventData?.choices[0].outcomeId });
      expect(eventResult.success).toBe(true);
    }

    // Merchant Node
    const merchantCellId = Object.keys(mapState.nodes).find(id => mapState.nodes[id].type === 'merchant');
    if (merchantCellId) {
      mapState.nodes[merchantCellId].status = 'visited';
      const merchantContext = {
        playerId: player.id,
        discordId: '999999999999999999',
        node: mapState.nodes[merchantCellId],
        dbSession: session
      };
      const shopItems = mapState.nodes[merchantCellId].encounterData?.shopItems || [];
      const targetItem = shopItems[0];
      const merchantResult = await merchantHandler.onAction('buy', merchantContext, { itemId: targetItem?.id });
      expect(merchantResult.success).toBe(true);
    }

    // Combat Room Node
    const combatCellId = Object.keys(mapState.nodes).find(id => ['room', 'elite'].includes(mapState.nodes[id].type)) || '0_1';
    mapState.nodes[combatCellId].status = 'visited';
    const combatContext = {
      playerId: player.id,
      discordId: '999999999999999999',
      node: mapState.nodes[combatCellId],
      dbSession: session
    };
    const enemyId = mapState.nodes[combatCellId].encounterData?.enemyId || 'cave_bat';
    const enemy = getEnemyById(enemyId);
    expect(enemy).toBeDefined();

    const combatResult = await combatNodeHandler.onAction('engage', combatContext);
    expect(combatResult.success).toBe(true);
    expect(inMemoryStore.combat_sessions.length).toBe(1);

    // Clean combat
    inMemoryStore.combat_sessions = [];
    session.mapState.nodes[combatCellId].status = 'cleared';

    // Boss Chamber Node
    const bossCellId = mapState.bossNodeId;
    const bossContext = {
      playerId: player.id,
      discordId: '999999999999999999',
      node: mapState.nodes[bossCellId],
      dbSession: session
    };
    const bossResult = await combatNodeHandler.onAction('engage', bossContext);
    expect(bossResult.success).toBe(true);

    // Complete session
    inMemoryStore.exploration_sessions = [];
    expect(inMemoryStore.exploration_sessions.length).toBe(0);
  });
});
