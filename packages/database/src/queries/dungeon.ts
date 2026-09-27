import { eq, asc, desc } from 'drizzle-orm';
import { db } from '../client.js';
import { dungeonLeaderboard } from '../schema.js';

/**
 * Fetch top dungeon runs sorted by floor (descending) and timeTaken (ascending).
 */
export async function getDungeonLeaderboard(dungeonId: string, limitNum: number = 10) {
  return db.query.dungeonLeaderboard.findMany({
    where: eq(dungeonLeaderboard.dungeonId, dungeonId),
    orderBy: [
      desc(dungeonLeaderboard.floor),
      asc(dungeonLeaderboard.timeTaken)
    ],
    limit: limitNum,
    with: {
      player: {
        columns: {
          username: true
        }
      }
    }
  });
}

/**
 * Insert a new dungeon run completion record.
 */
export async function recordDungeonRun(data: {
  playerId: string;
  dungeonId: string;
  floor: number;
  timeTaken: number;
}) {
  const [record] = await db
    .insert(dungeonLeaderboard)
    .values({
      playerId: data.playerId,
      dungeonId: data.dungeonId,
      floor: data.floor,
      timeTaken: data.timeTaken
    })
    .returning();
  return record;
}
