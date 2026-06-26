import { db } from '../database/client.js';
import { customAssets } from '../database/schema.js';
import { eq } from 'drizzle-orm';
import { logger } from './logger.js';

// Centralized in-memory cache for fast synchronous emoji lookups
export const emojiCache = new Map<string, { type: string; emoji: string }>();

// Standard fallback emojis
const RARITY_FALLBACKS: Record<string, string> = {
  common: '🪨',
  uncommon: '🌿',
  rare: '🔷',
  epic: '🔮',
  mythic: '👑',
};

const CLASS_FALLBACKS: Record<string, string> = {
  warrior: '⚔️',
  mage: '🔮',
  rogue: '🗡️',
  ranger: '🏹',
  healer: '❇️',
  paladin: '🛡️',
  necromancer: '💀',
  berserker: '🪓',
};

/**
 * Loads all custom assets from the database and populates the in-memory cache.
 * Called once during bot boot sequence.
 */
export async function initEmojis(): Promise<void> {
  try {
    logger.info('Pre-loading custom assets from database...');
    // If running in Vitest test environment, we might not have DATABASE_URL or database initialized
    if (process.env.NODE_ENV === 'test') {
      logger.info('Test environment detected. Skipping custom assets loading.');
      return;
    }

    const assets = await db.select().from(customAssets);
    emojiCache.clear();
    for (const asset of assets) {
      emojiCache.set(asset.id, { type: asset.type, emoji: asset.emoji });
    }
    logger.info(`Loaded ${emojiCache.size} custom assets successfully!`);
  } catch (error) {
    logger.error('Failed to load custom assets from database. Visuals will use default fallbacks:', error);
  }
}

/**
 * Helper to fetch emoji for items. Falls back to rarity gem if not set.
 */
export function getItemEmoji(itemId: string, rarity = 'common'): string {
  const cached = emojiCache.get(itemId);
  if (cached) return cached.emoji;
  return RARITY_FALLBACKS[rarity.toLowerCase()] || '🪨';
}

/**
 * Helper to fetch emoji for classes. Falls back to class emblem.
 */
export function getClassEmoji(className: string | null): string {
  if (!className) return '🌀';
  const cleanName = className.toLowerCase();
  const cached = emojiCache.get(cleanName);
  if (cached) return cached.emoji;
  return CLASS_FALLBACKS[cleanName] || '🌀';
}

/**
 * Helper to fetch emoji for pets. Falls back to paw print.
 */
export function getPetEmoji(petId: string, rarity = 'common'): string {
  const cached = emojiCache.get(petId);
  if (cached) return cached.emoji;
  return RARITY_FALLBACKS[rarity.toLowerCase()] || '🐾';
}

/**
 * Helper to fetch emoji for achievements. Falls back to trophy.
 */
export function getAchievementEmoji(achId: string): string {
  const cached = emojiCache.get(achId);
  if (cached) return cached.emoji;
  return '🏆';
}

/**
 * Helper to fetch emoji for currencies. Falls back to standard emojis.
 */
export function getCurrencyEmoji(currency: 'gold' | 'gems'): string {
  const cached = emojiCache.get(currency);
  if (cached) return cached.emoji;
  return currency === 'gold' ? '🪙' : '💎';
}

/**
 * Inserts or updates a custom asset in the database and updates the memory cache.
 */
export async function setCustomAsset(id: string, type: string, emoji: string): Promise<void> {
  const now = new Date();
  await db
    .insert(customAssets)
    .values({
      id,
      type,
      emoji,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: customAssets.id,
      set: {
        emoji,
        updatedAt: now,
      },
    });

  emojiCache.set(id, { type, emoji });
}

/**
 * Deletes a custom asset from the database and removes it from the memory cache.
 */
export async function removeCustomAsset(id: string): Promise<void> {
  await db.delete(customAssets).where(eq(customAssets.id, id));
  emojiCache.delete(id);
}
