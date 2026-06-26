import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../client.js';
import {
  players,
  playerStats,
  playerEquipment,
  dailyLogins,
} from '../schema.js';
import { getEquippedItems } from './inventory.js';
import { computeStats } from '../../systems/progression/stats.js';
import { checkLevelUp } from '../../systems/progression/leveling.js';
import { itemsCatalog, zonesCatalog } from '../../utils/catalog.js';

/**
 * Find an existing player by Discord ID, or create a new one with default
 * stats, equipment, and daily-login rows.
 */
export async function findOrCreatePlayer(discordId: string, username: string) {
  return db.transaction(async (tx) => {
    // Attempt to find existing player
    const existing = await tx.query.players.findFirst({
      where: eq(players.discordId, discordId),
      with: { stats: true },
    });

    if (existing) {
      // Update username if it changed and refresh lastSeen
      if (existing.username !== username) {
        await tx
          .update(players)
          .set({ username, lastSeen: new Date() })
          .where(eq(players.id, existing.id));
      } else {
        await tx
          .update(players)
          .set({ lastSeen: new Date() })
          .where(eq(players.id, existing.id));
      }
      return existing;
    }

    const [newPlayer] = await tx
      .insert(players)
      .values({ discordId, username, lastSeen: new Date() })
      .returning();

    if (!newPlayer) {
      throw new Error('Failed to create new player record');
    }

    // Create default stats row
    await tx.insert(playerStats).values({ playerId: newPlayer.id });

    // Create default equipment row
    await tx.insert(playerEquipment).values({ playerId: newPlayer.id });

    // Create default daily-login row
    await tx.insert(dailyLogins).values({ playerId: newPlayer.id });

    // Re-fetch with stats for a consistent return shape
    const created = await tx.query.players.findFirst({
      where: eq(players.id, newPlayer.id),
      with: { stats: true },
    });

    return created!;
  });
}

/**
 * Get a player by Discord ID with their stats.
 */
export async function getPlayerByDiscordId(discordId: string) {
  return db.query.players.findFirst({
    where: eq(players.discordId, discordId),
    with: { stats: true },
  });
}

/**
 * Update a player's level and experience.
 */
export async function updatePlayerLevel(
  playerId: string,
  level: number,
  exp: number,
) {
  const [updated] = await db
    .update(players)
    .set({ level, exp })
    .where(eq(players.id, playerId))
    .returning();
  return updated;
}

/**
 * Set a player's last_seen timestamp to now.
 */
export async function updateLastSeen(playerId: string) {
  await db
    .update(players)
    .set({ lastSeen: new Date() })
    .where(eq(players.id, playerId));
}

/**
 * Get the top N players for a given leaderboard category.
 */
export async function getLeaderboard(
  category: 'level' | 'gold' | 'kills',
  limit: number = 10,
) {
  const orderColumn = {
    level: players.level,
    gold: players.gold,
    kills: players.totalKills,
  }[category];

  return db
    .select({
      id: players.id,
      discordId: players.discordId,
      username: players.username,
      level: players.level,
      gold: players.gold,
      totalKills: players.totalKills,
    })
    .from(players)
    .orderBy(desc(orderColumn))
    .limit(limit);
}

/**
 * Increment a player's total kill count.
 */
export async function incrementKills(playerId: string, count: number = 1) {
  const [updated] = await db
    .update(players)
    .set({
      totalKills: sql`${players.totalKills} + ${count}`,
    })
    .where(eq(players.id, playerId))
    .returning({ totalKills: players.totalKills });
  return updated;
}

/**
 * Increment a player's total completed quests count by 1.
 */
export async function incrementQuestsCompleted(playerId: string) {
  const [updated] = await db
    .update(players)
    .set({
      totalQuestsCompleted: sql`${players.totalQuestsCompleted} + 1`,
    })
    .where(eq(players.id, playerId))
    .returning({ totalQuestsCompleted: players.totalQuestsCompleted });
  return updated;
}

/**
 * Retrieves a player by Discord ID, computes their stats, and clamps their current HP/Mana to max HP/Mana if they exceed them, updating the database.
 */
export async function getPlayerWithClampedStats(discordId: string) {
  const player = await getPlayerByDiscordId(discordId);
  if (!player) return null;

  // Auto-heal/fix invalid or deleted zone IDs (e.g. from old version)
  const zoneExists = zonesCatalog.some((z) => z.id === player.currentZoneId);
  if (!zoneExists) {
    await db
      .update(players)
      .set({ currentZoneId: 'cozy_tavern' })
      .where(eq(players.id, player.id));
    player.currentZoneId = 'cozy_tavern';
  }

  const equippedDbItems = await getEquippedItems(player.id);
  const equippedItemsList = equippedDbItems.map((dbItem) => {
    const def = itemsCatalog.find((i) => i.id === dbItem.itemId);
    return { slot: def?.type || 'accessory', rarity: def?.rarity || 'common', stats: def?.stats || {} };
  });

  const stats = computeStats(
    player.level,
    player.prestige,
    player.playerClass,
    equippedItemsList,
    null,
    []
  );

  if (player.hpCurrent > stats.hpMax || player.manaCurrent > stats.manaMax) {
    const clampedHp = Math.min(stats.hpMax, player.hpCurrent);
    const clampedMana = Math.min(stats.manaMax, player.manaCurrent);

    await db
      .update(players)
      .set({ hpCurrent: clampedHp, manaCurrent: clampedMana })
      .where(eq(players.id, player.id));

    player.hpCurrent = clampedHp;
    player.manaCurrent = clampedMana;
  }

  return player;
}

/**
 * Get the player and apply stamina regeneration logic based on elapsed time.
 */
export async function getAndUpdatePlayerStamina(playerId: string, tx: any = db) {
  const player = await tx.query.players.findFirst({
    where: eq(players.id, playerId),
  });

  if (!player) return null;

  const now = new Date();
  if (player.stamina >= player.staminaMax) {
    if (player.lastStaminaRegen.getTime() !== now.getTime()) {
      const [updated] = await tx
        .update(players)
        .set({ lastStaminaRegen: now })
        .where(eq(players.id, playerId))
        .returning();
      return updated;
    }
    return player;
  }

  const elapsedMs = now.getTime() - player.lastStaminaRegen.getTime();
  const intervalMs = 5 * 60 * 1000; // 5 minutes

  if (elapsedMs >= intervalMs) {
    const intervals = Math.floor(elapsedMs / intervalMs);
    const newStamina = Math.min(player.staminaMax, player.stamina + intervals);
    const newLastRegen = new Date(player.lastStaminaRegen.getTime() + intervals * intervalMs);

    const [updated] = await tx
      .update(players)
      .set({
        stamina: newStamina,
        lastStaminaRegen: newLastRegen,
      })
      .where(eq(players.id, playerId))
      .returning();

    return updated;
  }

  return player;
}

/**
 * Deduct a specified amount of stamina from the player.
 * Calls getAndUpdatePlayerStamina first to ensure the stamina is current.
 */
export async function deductPlayerStamina(playerId: string, amount: number): Promise<boolean> {
  return db.transaction(async (tx) => {
    const player = await getAndUpdatePlayerStamina(playerId, tx);
    if (!player) return false;

    if (player.stamina < amount) {
      return false;
    }

    const newStamina = player.stamina - amount;
    const setClause: any = { stamina: newStamina };
    if (player.stamina === player.staminaMax) {
      setClause.lastStaminaRegen = new Date();
    }

    await tx
      .update(players)
      .set(setClause)
      .where(eq(players.id, playerId));

    return true;
  });
}

/**
 * Replenish a player's stamina, capping it at staminaMax.
 */
export async function replenishPlayerStamina(playerId: string, amount: number) {
  return db.transaction(async (tx) => {
    const player = await getAndUpdatePlayerStamina(playerId, tx);
    if (!player) return null;

    const newStamina = Math.min(player.staminaMax, player.stamina + amount);
    const setClause: any = { stamina: newStamina };
    if (newStamina === player.staminaMax) {
      setClause.lastStaminaRegen = new Date();
    }

    const [updated] = await tx
      .update(players)
      .set(setClause)
      .where(eq(players.id, playerId))
      .returning();

    return updated;
  });
}

/**
 * Award experience to a player, processing level ups, healing, and recalculating stats.
 */
export async function awardPlayerExp(
  playerId: string,
  expToGain: number,
) {
  return db.transaction(async (tx) => {
    const player = await tx.query.players.findFirst({
      where: eq(players.id, playerId),
    });

    if (!player) {
      throw new Error(`Player not found: ${playerId}`);
    }

    const currentLevel = player.level;
    const currentExp = player.exp;
    const newTotalExp = currentExp + expToGain;

    const { levelsGained, newLevel, remainingExp } = checkLevelUp(currentLevel, newTotalExp);

    if (levelsGained > 0) {
      const equippedDbItems = await getEquippedItems(playerId);
      const equippedItemsList = equippedDbItems.map((dbItem) => {
        const def = itemsCatalog.find((i) => i.id === dbItem.itemId);
        return {
          slot: def?.type || 'accessory',
          rarity: def?.rarity || 'common',
          stats: def?.stats || {},
        };
      });

      const newStats = computeStats(newLevel, player.prestige, player.playerClass, equippedItemsList, null, []);

      await tx
        .update(players)
        .set({
          level: newLevel,
          exp: remainingExp,
          hpCurrent: newStats.hpMax,
          manaCurrent: newStats.manaMax,
        })
        .where(eq(players.id, playerId));

      return {
        leveledUp: true,
        oldLevel: currentLevel,
        newLevel,
        gainedExp: expToGain,
        currentExp: remainingExp,
        hpMax: newStats.hpMax,
        manaMax: newStats.manaMax,
      };
    } else {
      await tx
        .update(players)
        .set({
          exp: newTotalExp,
        })
        .where(eq(players.id, playerId));

      return {
        leveledUp: false,
        oldLevel: currentLevel,
        newLevel: currentLevel,
        gainedExp: expToGain,
        currentExp: newTotalExp,
      };
    }
  });
}

