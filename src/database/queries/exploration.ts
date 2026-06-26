import { eq } from 'drizzle-orm';
import { db } from '../client.js';
import { explorationSessions } from '../schema.js';

/**
 * Create a new exploration session.
 */
export async function createExplorationSession(data: {
  playerId: string;
  channelId: string;
  zoneId: string;
  currentNodeId: string;
  previousNodeId?: string | null;
  party: any;
  mapState: any;
}) {
  const [session] = await db
    .insert(explorationSessions)
    .values({
      playerId: data.playerId,
      channelId: data.channelId,
      zoneId: data.zoneId,
      currentNodeId: data.currentNodeId,
      previousNodeId: data.previousNodeId || null,
      party: data.party,
      mapState: data.mapState,
    })
    .returning();
  return session;
}

/**
 * Get an exploration session by Player ID, searching both as owner/leader and as a party member.
 */
export async function getExplorationSessionByPlayerId(playerId: string) {
  const sessions = await db.query.explorationSessions.findMany({
    with: { player: true },
  });

  return sessions.find(s => {
    if (s.playerId === playerId) return true;
    const party = s.party as any;
    if (party && Array.isArray(party.members)) {
      return party.members.some((m: any) => m.playerId === playerId);
    }
    return false;
  }) || null;
}

/**
 * Update an exploration session.
 */
export async function updateExplorationSession(
  sessionId: string,
  patch: Partial<{
    currentNodeId: string;
    previousNodeId: string | null;
    mapState: any;
    updatedAt: Date;
  }>,
) {
  const [updated] = await db
    .update(explorationSessions)
    .set({
      ...patch,
      updatedAt: patch.updatedAt || new Date(),
    })
    .where(eq(explorationSessions.id, sessionId))
    .returning();
  return updated;
}

/**
 * Delete an exploration session.
 */
export async function deleteExplorationSession(sessionId: string) {
  const [deleted] = await db
    .delete(explorationSessions)
    .where(eq(explorationSessions.id, sessionId))
    .returning();
  return deleted;
}

/**
 * Mark a node as cleared in the exploration session's mapState.
 */
export async function markNodeCleared(sessionId: string, nodeId: string) {
  const session = await db.query.explorationSessions.findFirst({
    where: eq(explorationSessions.id, sessionId),
  });
  if (!session) return null;

  const mapState = session.mapState as any;
  if (mapState && mapState.nodes && mapState.nodes[nodeId]) {
    mapState.nodes[nodeId].status = 'cleared';
    return await updateExplorationSession(sessionId, { mapState });
  }
  return null;
}

