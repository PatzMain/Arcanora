import { eq, and } from 'drizzle-orm';
import { db } from '../client.js';
import { playerWorldDiscoveries } from '../schema.js';

/**
 * Marks a location as discovered for a player, avoiding conflicts if already discovered.
 */
export async function discoverLocation(playerId: string, locationId: string) {
  const existing = await db.query.playerWorldDiscoveries.findFirst({
    where: and(
      eq(playerWorldDiscoveries.playerId, playerId),
      eq(playerWorldDiscoveries.locationId, locationId)
    )
  });

  if (existing) {
    return existing;
  }

  const [inserted] = await db
    .insert(playerWorldDiscoveries)
    .values({
      playerId,
      locationId
    })
    .returning();
  return inserted;
}

/**
 * Retrieves the list of all location IDs discovered by a player.
 */
export async function getPlayerDiscoveredLocations(playerId: string): Promise<string[]> {
  const discoveries = await db.query.playerWorldDiscoveries.findMany({
    where: eq(playerWorldDiscoveries.playerId, playerId)
  });
  return discoveries.map(d => d.locationId);
}

/**
 * Checks if a specific location is discovered by a player.
 */
export async function isLocationDiscovered(playerId: string, locationId: string): Promise<boolean> {
  const existing = await db.query.playerWorldDiscoveries.findFirst({
    where: and(
      eq(playerWorldDiscoveries.playerId, playerId),
      eq(playerWorldDiscoveries.locationId, locationId)
    )
  });
  return !!existing;
}
