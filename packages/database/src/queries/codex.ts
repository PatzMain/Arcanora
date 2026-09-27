import { eq, and } from 'drizzle-orm';
import { db } from '../client.js';
import { codexEntries } from '../schema.js';

/**
 * Discover or increment kill count for an enemy in the player's codex.
 */
export async function discoverEnemy(playerId: string, enemyId: string) {
  const existing = await db.query.codexEntries.findFirst({
    where: and(
      eq(codexEntries.playerId, playerId),
      eq(codexEntries.type, 'enemy'),
      eq(codexEntries.entityId, enemyId)
    ),
  });

  if (existing) {
    const newKillCount = existing.killCount + 1;
    await db
      .update(codexEntries)
      .set({
        killCount: newKillCount,
        discoveredAt: new Date(),
      })
      .where(eq(codexEntries.id, existing.id));
    return { isNew: false, killCount: newKillCount };
  } else {
    await db.insert(codexEntries).values({
      playerId,
      type: 'enemy',
      entityId: enemyId,
      killCount: 1,
      foundCount: 0,
      discoveredAt: new Date(),
    });
    return { isNew: true, killCount: 1 };
  }
}

/**
 * Discover or increment found count for an item in the player's codex.
 */
export async function discoverItem(playerId: string, itemId: string) {
  const existing = await db.query.codexEntries.findFirst({
    where: and(
      eq(codexEntries.playerId, playerId),
      eq(codexEntries.type, 'item'),
      eq(codexEntries.entityId, itemId)
    ),
  });

  if (existing) {
    const newFoundCount = existing.foundCount + 1;
    await db
      .update(codexEntries)
      .set({
        foundCount: newFoundCount,
        discoveredAt: new Date(),
      })
      .where(eq(codexEntries.id, existing.id));
    return { isNew: false, foundCount: newFoundCount };
  } else {
    await db.insert(codexEntries).values({
      playerId,
      type: 'item',
      entityId: itemId,
      killCount: 0,
      foundCount: 1,
      discoveredAt: new Date(),
    });
    return { isNew: true, foundCount: 1 };
  }
}

/**
 * Discover a location in the player's codex.
 */
export async function discoverLocation(playerId: string, locationId: string) {
  const existing = await db.query.codexEntries.findFirst({
    where: and(
      eq(codexEntries.playerId, playerId),
      eq(codexEntries.type, 'location'),
      eq(codexEntries.entityId, locationId)
    ),
  });

  if (existing) {
    return { isNew: false };
  } else {
    await db.insert(codexEntries).values({
      playerId,
      type: 'location',
      entityId: locationId,
      killCount: 0,
      foundCount: 0,
      discoveredAt: new Date(),
    });
    return { isNew: true };
  }
}

/**
 * Get all codex entries of a specific type for a player.
 */
export async function getCodexEntries(playerId: string, type: 'enemy' | 'item' | 'location') {
  return await db.query.codexEntries.findMany({
    where: and(
      eq(codexEntries.playerId, playerId),
      eq(codexEntries.type, type)
    ),
  });
}

/**
 * Get a specific codex entry.
 */
export async function getCodexEntry(playerId: string, type: 'enemy' | 'item' | 'location', entityId: string) {
  return await db.query.codexEntries.findFirst({
    where: and(
      eq(codexEntries.playerId, playerId),
      eq(codexEntries.type, type),
      eq(codexEntries.entityId, entityId)
    ),
  }) || null;
}
