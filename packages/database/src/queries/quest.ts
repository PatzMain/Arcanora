import { eq, and, isNull, isNotNull, sql } from 'drizzle-orm';
import { db } from '../client.js';
import { playerQuests } from '../schema.js';

/**
 * Start a new quest for a player.
 */
export async function startQuest(playerId: string, questId: string) {
  const [quest] = await db
    .insert(playerQuests)
    .values({
      playerId,
      questId,
      progress: {},
    })
    .returning();
  return quest;
}

/**
 * Get all active (incomplete) quests for a player.
 */
export async function getActiveQuests(playerId: string) {
  return db
    .select()
    .from(playerQuests)
    .where(
      and(
        eq(playerQuests.playerId, playerId),
        isNull(playerQuests.completedAt),
      ),
    )
    .orderBy(playerQuests.startedAt);
}

/**
 * Update the JSONB progress for a quest entry.
 * Merges the provided progress keys into the existing progress object
 * using PostgreSQL's `||` JSONB concatenation operator.
 */
export async function updateQuestProgress(
  questEntryId: string,
  progress: Record<string, number>,
) {
  const [updated] = await db
    .update(playerQuests)
    .set({
      progress: sql`${playerQuests.progress} || ${JSON.stringify(progress)}::jsonb`,
    })
    .where(eq(playerQuests.id, questEntryId))
    .returning();
  return updated;
}

/**
 * Mark a quest as completed by setting the completed_at timestamp.
 */
export async function completeQuest(questEntryId: string) {
  const [completed] = await db
    .update(playerQuests)
    .set({ completedAt: new Date() })
    .where(eq(playerQuests.id, questEntryId))
    .returning();
  return completed;
}

/**
 * Get all completed quest IDs for a player.
 */
export async function getCompletedQuests(playerId: string) {
  const results = await db
    .select({ questId: playerQuests.questId })
    .from(playerQuests)
    .where(
      and(
        eq(playerQuests.playerId, playerId),
        isNotNull(playerQuests.completedAt),
      ),
    );
  return results.map((r) => r.questId);
}
