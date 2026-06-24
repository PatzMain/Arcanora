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
import { itemsCatalog } from '../../utils/catalog.js';

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

