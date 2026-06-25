import { eq, and } from 'drizzle-orm';
import { db } from '../../database/client.js';
import { players, combatSessions, playerWorldDiscoveries } from '../../database/schema.js';
import {
  getPlayerWithClampedStats,
  deductPlayerStamina,
  getAndUpdatePlayerStamina
} from '../../database/queries/player.js';
import { getEquippedItems, addItem } from '../../database/queries/inventory.js';
import {
  discoverLocation,
  getPlayerDiscoveredLocations,
  isLocationDiscovered
} from '../../database/queries/worldQueries.js';
import { zonesCatalog, itemsCatalog, enemiesCatalog } from '../../utils/catalog.js';
import { scaleEnemyStats, getEnemyById } from '../combat/enemy.js';
import { createCombatState } from '../combat/engine.js';
import { computeStats } from '../progression/stats.js';
import { RIDDLES } from './dungeonGenerator.js';
import { awardGold } from '../../economy/currency.js';

export interface ExploreResult {
  type: 'combat' | 'resource' | 'puzzle' | 'chest' | 'discovery' | 'empty';
  message: string;
  combatEnemy?: any;
  resourceItem?: any;
  puzzle?: any;
  goldGained?: number;
  discoveredLocationId?: string;
  discoveredLocationName?: string;
}

/**
 * Handles node-to-node travel.
 */
export async function travelToNode(playerId: string, targetLocationId: string) {
  const player = await getAndUpdatePlayerStamina(playerId);
  if (!player) throw new Error('Player not found.');

  const currentLocation = zonesCatalog.find(z => z.id === player.currentZoneId);
  const targetLocation = zonesCatalog.find(z => z.id === targetLocationId);

  if (!targetLocation) throw new Error('Target location does not exist.');

  // Adjacency check
  const connections = currentLocation?.connections || [];
  if (!connections.includes(targetLocationId)) {
    throw new Error('Destination is not adjacent to your current location.');
  }

  // Level gate check
  if (player.level < targetLocation.minLevel) {
    throw new Error(`Your level is too low. Required: Level ${targetLocation.minLevel}.`);
  }

  // Discovery check
  const discovered = await isLocationDiscovered(playerId, targetLocationId);
  if (!discovered) {
    throw new Error('This location is hidden. You must discover it first.');
  }

  // Stamina check & deduction
  if (player.stamina < 10) {
    throw new Error('Not enough stamina. Traveling costs 10 stamina.');
  }

  await deductPlayerStamina(playerId, 10);

  // Update current zone
  await db
    .update(players)
    .set({ currentZoneId: targetLocationId })
    .where(eq(players.id, playerId));

  return targetLocation;
}

/**
 * Explores the current node.
 */
export async function exploreNode(playerId: string): Promise<ExploreResult> {
  const player = await getAndUpdatePlayerStamina(playerId);
  if (!player) throw new Error('Player not found.');

  if (player.stamina < 10) {
    throw new Error('You need at least 10 Stamina to explore.');
  }

  const currentLocation = zonesCatalog.find(z => z.id === player.currentZoneId);
  if (!currentLocation) throw new Error('Current location not found.');

  // Deduct stamina
  await deductPlayerStamina(playerId, 10);

  // Determine outcome table based on location type
  const isSettlement = currentLocation.type === 'settlement' || currentLocation.type === 'landmark';
  
  // Weights: combat, resource, puzzle, chest, discovery
  let roll = Math.random() * 100;
  let type: ExploreResult['type'] = 'empty';

  if (isSettlement) {
    // Settlements: lower combat, higher resource/puzzle/chest/discovery
    if (roll < 10) type = 'combat';
    else if (roll < 45) type = 'resource';
    else if (roll < 70) type = 'puzzle';
    else if (roll < 85) type = 'chest';
    else type = 'discovery';
  } else {
    // Combat / Dungeon zones: higher combat, lower others
    if (roll < 55) type = 'combat';
    else if (roll < 70) type = 'resource';
    else if (roll < 80) type = 'puzzle';
    else if (roll < 90) type = 'chest';
    else type = 'discovery';
  }

  // Double check if there are no connections to discover
  const discoveredLocs = await getPlayerDiscoveredLocations(playerId);
  const undiscoveredConnections = (currentLocation.connections || []).filter(
    id => !discoveredLocs.includes(id)
  );

  // If discovery rolled but no undiscovered connections exist, fallback to chest or resource
  if (type === 'discovery' && undiscoveredConnections.length === 0) {
    type = Math.random() < 0.5 ? 'resource' : 'chest';
  }

  // 1. PATH DISCOVERY
  if (type === 'discovery' && undiscoveredConnections.length > 0) {
    const targetId = undiscoveredConnections[Math.floor(Math.random() * undiscoveredConnections.length)]!;
    const targetLoc = zonesCatalog.find(z => z.id === targetId);
    
    await discoverLocation(playerId, targetId);
    
    return {
      type: 'discovery',
      message: `🗺️ **New Path Discovered!**\nWhile scouting around **${currentLocation.name}**, you uncover an overgrown trail leading to **${targetLoc?.name || targetId}**!`,
      discoveredLocationId: targetId,
      discoveredLocationName: targetLoc?.name || targetId
    };
  }

  // 2. RESOURCE GATHERING
  if (type === 'resource') {
    const resources = currentLocation.ecosystem?.resources || [];
    if (resources.length > 0) {
      const resId = resources[Math.floor(Math.random() * resources.length)]!;
      const itemDef = itemsCatalog.find(i => i.id === resId);
      
      if (itemDef) {
        await addItem(playerId, resId, 1);
        return {
          type: 'resource',
          message: `🌿 **Resource Gathered!**\nYou search the local area and successfully gather 1x **${itemDef.name}** (${itemDef.rarity})!`,
          resourceItem: itemDef
        };
      }
    }
    // Fallback to empty if no resources configured
    type = 'empty';
  }

  // 3. PUZZLE / RIDDLE
  if (type === 'puzzle') {
    const riddleIdx = Math.floor(Math.random() * RIDDLES.length);
    const riddle = RIDDLES[riddleIdx]!;
    return {
      type: 'puzzle',
      message: `🧩 **Ancient Inscription**\nYou find a strange stone obelisk glowing with rune carvings. A riddle stands before you...`,
      puzzle: riddle
    };
  }

  // 4. CHEST / GOLD
  if (type === 'chest') {
    const goldGained = Math.floor(Math.random() * 150) + 50; // 50-200 gold
    await awardGold(playerId, goldGained, `Explored and found a chest at ${currentLocation.name}`);
    return {
      type: 'chest',
      message: `🪙 **Chest Discovered!**\nYou pull a half-buried lockbox out of the dirt and salvage **${goldGained} Gold**!`,
      goldGained
    };
  }

  // 5. COMBAT
  if (type === 'combat') {
    const enemies = currentLocation.enemies || [];
    if (enemies.length > 0) {
      const enemyId = enemies[Math.floor(Math.random() * enemies.length)]!;
      const enemyDef = enemiesCatalog.find(e => e.id === enemyId);
      
      if (enemyDef) {
        // Build combat session
        const equippedDbItems = await getEquippedItems(playerId);
        const equippedItemsList = equippedDbItems.map((dbItem) => {
          const def = itemsCatalog.find((i) => i.id === dbItem.itemId);
          return { slot: def?.type || 'accessory', rarity: def?.rarity || 'common', stats: def?.stats || {} };
        });
        const playerStats = computeStats(player.level, player.prestige, player.playerClass, equippedItemsList, null, []);

        const scaledEnemyStats = scaleEnemyStats(enemyDef, player.level);
        const combatStatsInput = {
          hp: player.hpCurrent,
          maxHp: playerStats.hpMax,
          mana: player.manaCurrent,
          maxMana: playerStats.manaMax,
          attack: playerStats.attack,
          defense: playerStats.defense,
          speed: playerStats.speed,
          critChance: playerStats.critChance,
          critDmg: playerStats.critDmg,
          luck: playerStats.luck
        };

        const initialCombatState = createCombatState(combatStatsInput, scaledEnemyStats);
        initialCombatState.combatLog = [
          `⚔️ You were ambushed by a Lv.${enemyDef.level} **${enemyDef.name}** while exploring!`,
          `💪 Prepare for battle!`
        ];

        const sessionExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        await db
          .insert(combatSessions)
          .values({
            playerId: player.id,
            enemyId: enemyDef.id,
            zoneId: currentLocation.id,
            state: initialCombatState,
            expiresAt: sessionExpiresAt
          });

        return {
          type: 'combat',
          message: `⚔️ **Ambushed!**\nA wild **${enemyDef.name}** jumps out from the shadows!`,
          combatEnemy: enemyDef
        };
      }
    }
    type = 'empty';
  }

  // 6. EMPTY
  return {
    type: 'empty',
    message: `💨 **Quiet Scouting**\nYou scout around **${currentLocation.name}**, but find nothing of interest this time.`
  };
}
