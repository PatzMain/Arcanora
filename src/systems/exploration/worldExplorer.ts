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
import { awardGold } from '../../economy/currency.js';

import { advanceQuestProgress } from '../progression/questSystem.js';

export interface ExploreResult {
  type: 'combat' | 'resource' | 'chest' | 'discovery' | 'empty';
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
export async function travelToNode(playerId: string, targetLocationId: string, interaction?: any) {
  const player = await getAndUpdatePlayerStamina(playerId);
  if (!player) throw new Error('Player not found.');

  const currentLocation = zonesCatalog.find(z => z.id === player.currentZoneId);
  const targetLocation = zonesCatalog.find(z => z.id === targetLocationId);

  if (!targetLocation) throw new Error('Target location does not exist.');

  // If already there, return targetLocation immediately (handles double-clicks gracefully)
  if (player.currentZoneId === targetLocationId) {
    return targetLocation;
  }

  // Adjacency check
  const connections = currentLocation?.connections || [];
  if (!connections.includes(targetLocationId)) {
    throw new Error('Destination is not adjacent to your current location.');
  }

  // Level gate check
  if (player.level < targetLocation.minLevel) {
    throw new Error(`Your level is too low. Required: Level ${targetLocation.minLevel}.`);
  }

  // Update current zone
  await db
    .update(players)
    .set({ currentZoneId: targetLocationId })
    .where(eq(players.id, playerId));

  // Auto-discover the target location and all its adjacent connections
  await discoverLocation(playerId, targetLocationId);
  const targetLoc = zonesCatalog.find(z => z.id === targetLocationId);
  if (targetLoc) {
    for (const connId of targetLoc.connections || []) {
      await discoverLocation(playerId, connId);
    }
  }

  // Advance quests that require exploring this location
  await advanceQuestProgress(playerId, 'explore', targetLocationId, 1, interaction);

  return targetLocation;
}

/**
 * Explores the current node for resources, chests, and discoveries.
 * Never triggers combat. Costs 2 stamina.
 */
export async function exploreNode(playerId: string, expectedLocationId?: string): Promise<ExploreResult> {
  const player = await getAndUpdatePlayerStamina(playerId);
  if (!player) throw new Error('Player not found.');

  if (expectedLocationId && player.currentZoneId !== expectedLocationId) {
    throw new Error('Location mismatch. You are not at the expected location.');
  }

  if (player.stamina < 2) {
    throw new Error('You need at least 2 Stamina to explore.');
  }

  const currentLocation = zonesCatalog.find(z => z.id === player.currentZoneId);
  if (!currentLocation) throw new Error('Current location not found.');

  // Deduct stamina (2 for exploring)
  await deductPlayerStamina(playerId, 2);

  // Check for undiscovered connections (for discovery outcome)
  const discoveredLocs = await getPlayerDiscoveredLocations(playerId);
  const undiscoveredConnections = (currentLocation.connections || []).filter(
    (id: string) => !discoveredLocs.includes(id)
  );

  // Weighted outcome: discovery (if available), resource, chest, empty
  const roll = Math.random() * 100;
  let type: 'resource' | 'chest' | 'discovery' | 'empty' = 'empty';

  if (undiscoveredConnections.length > 0 && roll < 20) {
    type = 'discovery';
  } else if (roll < 55) {
    type = 'resource';
  } else if (roll < 85) {
    type = 'chest';
  } else {
    type = 'empty';
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
    // Fallback to chest if no resources configured
    type = 'chest';
  }

  // 3. CHEST / GOLD
  if (type === 'chest') {
    const goldGained = Math.floor(Math.random() * 150) + 50; // 50-200 gold
    await awardGold(playerId, goldGained, `Explored and found a chest at ${currentLocation.name}`);
    return {
      type: 'chest',
      message: `🪙 **Chest Discovered!**\nYou pull a half-buried lockbox out of the dirt and salvage **${goldGained} Gold**!`,
      goldGained
    };
  }


  // 4. EMPTY
  return {
    type: 'empty',
    message: `💨 **Quiet Scouting**\nYou scout around **${currentLocation.name}**, but find nothing of interest this time.`
  };
}

/**
 * Hunts the current zone for enemies. Always triggers a combat encounter.
 * Costs 5 stamina. Fails if the zone has no enemies.
 */
export async function huntNode(playerId: string, expectedLocationId?: string): Promise<ExploreResult> {
  const player = await getAndUpdatePlayerStamina(playerId);
  if (!player) throw new Error('Player not found.');

  if (expectedLocationId && player.currentZoneId !== expectedLocationId) {
    throw new Error('Location mismatch. You are not at the expected location.');
  }

  const activeCombat = await db.query.combatSessions.findFirst({
    where: eq(combatSessions.playerId, player.id)
  });
  if (activeCombat) {
    throw new Error('You are already in an active battle! Use `/combat fight` to resume your fight.');
  }

  if (player.stamina < 5) {
    throw new Error('You need at least 5 Stamina to hunt.');
  }

  const currentLocation = zonesCatalog.find(z => z.id === player.currentZoneId);
  if (!currentLocation) throw new Error('Current location not found.');

  const TOWN_SAFE_ZONES = ['cozy_tavern', 'oakhaven_square', 'oakhaven_forge', 'apothecary', 'river_docks'];
  if (TOWN_SAFE_ZONES.includes(currentLocation.id)) {
    throw new Error("You cannot hunt in the starter town safe zone. Walk out of the town's gate first!");
  }

  const enemies = currentLocation.enemies || [];
  if (enemies.length === 0) {
    throw new Error('There are no enemies to hunt in this area. Travel to a combat zone.');
  }

  // Deduct stamina (5 for hunting)
  await deductPlayerStamina(playerId, 5);

  const enemyId = enemies[Math.floor(Math.random() * enemies.length)]!;
  const enemyDef = enemiesCatalog.find(e => e.id === enemyId);

  if (!enemyDef) {
    throw new Error('Enemy definition not found.');
  }

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
  initialCombatState.source = 'hunt';
  initialCombatState.combatLog = [
    `⚔️ You tracked down a Lv.${enemyDef.level} **${enemyDef.name}** while hunting!`,
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
    message: `⚔️ **Enemy Found!**\nYou track down a **${enemyDef.name}** lurking in **${currentLocation.name}**!`,
    combatEnemy: enemyDef
  };
}
