import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../client.js';
import { guilds, guildMembers, players } from '../schema.js';

/**
 * Create a new guild and automatically add the leader as a member
 * with rank 'leader'.
 */
export async function createGuild(name: string, leaderId: string) {
  return db.transaction(async (tx) => {
    const [guild] = await tx
      .insert(guilds)
      .values({ name, leaderId })
      .returning();

    if (!guild) {
      throw new Error('Failed to create guild');
    }

    await tx.insert(guildMembers).values({
      guildId: guild.id,
      playerId: leaderId,
      rank: 'leader',
    });

    return guild;
  });
}

/**
 * Get a guild by its name, including a count of members.
 */
export async function getGuildByName(name: string) {
  const result = await db
    .select({
      id: guilds.id,
      name: guilds.name,
      level: guilds.level,
      exp: guilds.exp,
      treasury: guilds.treasury,
      leaderId: guilds.leaderId,
      createdAt: guilds.createdAt,
      memberCount: sql<number>`count(${guildMembers.playerId})::int`,
    })
    .from(guilds)
    .leftJoin(guildMembers, eq(guilds.id, guildMembers.guildId))
    .where(eq(guilds.name, name))
    .groupBy(guilds.id);

  return result[0] ?? null;
}

/**
 * Get the guild a player belongs to, or null.
 */
export async function getPlayerGuild(playerId: string) {
  const membership = await db
    .select({
      guildId: guildMembers.guildId,
      rank: guildMembers.rank,
      joinedAt: guildMembers.joinedAt,
      guildName: guilds.name,
      guildLevel: guilds.level,
      guildExp: guilds.exp,
      guildTreasury: guilds.treasury,
      guildLeaderId: guilds.leaderId,
    })
    .from(guildMembers)
    .innerJoin(guilds, eq(guildMembers.guildId, guilds.id))
    .where(eq(guildMembers.playerId, playerId));

  return membership[0] ?? null;
}

/**
 * Add a player to a guild as a regular member.
 */
export async function addMember(guildId: string, playerId: string) {
  const [member] = await db
    .insert(guildMembers)
    .values({ guildId, playerId, rank: 'member' })
    .returning();
  return member;
}

/**
 * Remove a player from a guild.
 */
export async function removeMember(guildId: string, playerId: string) {
  const deleted = await db
    .delete(guildMembers)
    .where(
      sql`${guildMembers.guildId} = ${guildId} AND ${guildMembers.playerId} = ${playerId}`,
    )
    .returning();
  return deleted[0] ?? null;
}

/**
 * Get all members of a guild with basic player info.
 */
export async function getGuildMembers(guildId: string) {
  return db
    .select({
      playerId: guildMembers.playerId,
      rank: guildMembers.rank,
      joinedAt: guildMembers.joinedAt,
      username: players.username,
      level: players.level,
      playerClass: players.playerClass,
    })
    .from(guildMembers)
    .innerJoin(players, eq(guildMembers.playerId, players.id))
    .where(eq(guildMembers.guildId, guildId))
    .orderBy(guildMembers.joinedAt);
}

/**
 * Adjust a guild's treasury by an amount (positive to deposit, negative to withdraw).
 */
export async function updateTreasury(guildId: string, amount: number) {
  const [updated] = await db
    .update(guilds)
    .set({ treasury: sql`${guilds.treasury} + ${amount}` })
    .where(eq(guilds.id, guildId))
    .returning({ treasury: guilds.treasury });
  return updated;
}

/**
 * Get the top N guilds ordered by level (descending), then by exp (descending).
 */
export async function getGuildLeaderboard(limit: number = 10) {
  return db
    .select({
      id: guilds.id,
      name: guilds.name,
      level: guilds.level,
      exp: guilds.exp,
      treasury: guilds.treasury,
      memberCount: sql<number>`count(${guildMembers.playerId})::int`,
    })
    .from(guilds)
    .leftJoin(guildMembers, eq(guilds.id, guildMembers.guildId))
    .groupBy(guilds.id)
    .orderBy(desc(guilds.level), desc(guilds.exp))
    .limit(limit);
}
