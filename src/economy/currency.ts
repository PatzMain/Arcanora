import { db } from '../database/client.js';
import { players, transactions } from '../database/schema.js';
import { eq, sql } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

// ─── GOLD ────────────────────────────────────────────────────────

/**
 * Award gold to a player and log the transaction.
 * Uses an atomic SQL increment to avoid race conditions.
 * @returns The player's new gold balance.
 */
export async function awardGold(
  playerId: string,
  amount: number,
  reason: string,
): Promise<number> {
  if (amount <= 0) {
    throw new Error(`awardGold: amount must be > 0, received ${amount}`);
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(players)
      .set({ gold: sql`${players.gold} + ${amount}` })
      .where(eq(players.id, playerId))
      .returning({ gold: players.gold });

    if (!updated) {
      throw new Error(`awardGold: player ${playerId} not found`);
    }

    await tx.insert(transactions).values({
      playerId,
      type: 'award',
      amount,
      currency: 'gold',
      description: reason,
    });

    logger.debug({ playerId, amount, reason, newBalance: updated.gold }, 'Gold awarded');
    return updated.gold;
  });
}

/**
 * Deduct gold from a player if they have sufficient balance.
 * @returns `success: false` when the player cannot afford the deduction.
 */
export async function deductGold(
  playerId: string,
  amount: number,
  reason: string,
): Promise<{ success: boolean; newBalance: number }> {
  if (amount <= 0) {
    throw new Error(`deductGold: amount must be > 0, received ${amount}`);
  }

  return db.transaction(async (tx) => {
    // Lock the row by selecting within the transaction
    const player = await tx.query.players.findFirst({
      where: eq(players.id, playerId),
      columns: { gold: true },
    });

    if (!player) {
      throw new Error(`deductGold: player ${playerId} not found`);
    }

    if (player.gold < amount) {
      return { success: false, newBalance: player.gold };
    }

    const [updated] = await tx
      .update(players)
      .set({ gold: sql`${players.gold} - ${amount}` })
      .where(eq(players.id, playerId))
      .returning({ gold: players.gold });

    if (!updated) {
      throw new Error(`deductGold: failed to update player ${playerId}`);
    }

    await tx.insert(transactions).values({
      playerId,
      type: 'deduct',
      amount: -amount,
      currency: 'gold',
      description: reason,
    });

    logger.debug({ playerId, amount, reason, newBalance: updated.gold }, 'Gold deducted');
    return { success: true, newBalance: updated.gold };
  });
}

// ─── GEMS ────────────────────────────────────────────────────────

/**
 * Award gems to a player and log the transaction.
 * @returns The player's new gem balance.
 */
export async function awardGems(
  playerId: string,
  amount: number,
  reason: string,
): Promise<number> {
  if (amount <= 0) {
    throw new Error(`awardGems: amount must be > 0, received ${amount}`);
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(players)
      .set({ gems: sql`${players.gems} + ${amount}` })
      .where(eq(players.id, playerId))
      .returning({ gems: players.gems });

    if (!updated) {
      throw new Error(`awardGems: player ${playerId} not found`);
    }

    await tx.insert(transactions).values({
      playerId,
      type: 'award',
      amount,
      currency: 'gems',
      description: reason,
    });

    logger.debug({ playerId, amount, reason, newBalance: updated.gems }, 'Gems awarded');
    return updated.gems;
  });
}

/**
 * Deduct gems from a player if they have sufficient balance.
 * @returns `success: false` when the player cannot afford the deduction.
 */
export async function deductGems(
  playerId: string,
  amount: number,
  reason: string,
): Promise<{ success: boolean; newBalance: number }> {
  if (amount <= 0) {
    throw new Error(`deductGems: amount must be > 0, received ${amount}`);
  }

  return db.transaction(async (tx) => {
    const player = await tx.query.players.findFirst({
      where: eq(players.id, playerId),
      columns: { gems: true },
    });

    if (!player) {
      throw new Error(`deductGems: player ${playerId} not found`);
    }

    if (player.gems < amount) {
      return { success: false, newBalance: player.gems };
    }

    const [updated] = await tx
      .update(players)
      .set({ gems: sql`${players.gems} - ${amount}` })
      .where(eq(players.id, playerId))
      .returning({ gems: players.gems });

    if (!updated) {
      throw new Error(`deductGems: failed to update player ${playerId}`);
    }

    await tx.insert(transactions).values({
      playerId,
      type: 'deduct',
      amount: -amount,
      currency: 'gems',
      description: reason,
    });

    logger.debug({ playerId, amount, reason, newBalance: updated.gems }, 'Gems deducted');
    return { success: true, newBalance: updated.gems };
  });
}

// ─── BALANCE ─────────────────────────────────────────────────────

/**
 * Retrieve the current gold and gem balances for a player.
 */
export async function getBalance(
  playerId: string,
): Promise<{ gold: number; gems: number }> {
  const player = await db.query.players.findFirst({
    where: eq(players.id, playerId),
    columns: { gold: true, gems: true },
  });

  if (!player) {
    throw new Error(`getBalance: player ${playerId} not found`);
  }

  return { gold: player.gold, gems: player.gems };
}

// ─── TRANSFER ────────────────────────────────────────────────────

/**
 * Atomically transfer gold between two players within a single DB
 * transaction. Both the deduction and the credit succeed or fail together.
 */
export async function transferGold(
  fromPlayerId: string,
  toPlayerId: string,
  amount: number,
  reason: string,
): Promise<{ success: boolean }> {
  if (amount <= 0) {
    throw new Error(`transferGold: amount must be > 0, received ${amount}`);
  }

  if (fromPlayerId === toPlayerId) {
    throw new Error('transferGold: cannot transfer gold to yourself');
  }

  return db.transaction(async (tx) => {
    // Check sender balance
    const sender = await tx.query.players.findFirst({
      where: eq(players.id, fromPlayerId),
      columns: { gold: true },
    });

    if (!sender) {
      throw new Error(`transferGold: sender ${fromPlayerId} not found`);
    }

    if (sender.gold < amount) {
      return { success: false };
    }

    // Verify recipient exists
    const recipient = await tx.query.players.findFirst({
      where: eq(players.id, toPlayerId),
      columns: { id: true },
    });

    if (!recipient) {
      throw new Error(`transferGold: recipient ${toPlayerId} not found`);
    }

    // Deduct from sender
    await tx
      .update(players)
      .set({ gold: sql`${players.gold} - ${amount}` })
      .where(eq(players.id, fromPlayerId));

    // Credit to recipient
    await tx
      .update(players)
      .set({ gold: sql`${players.gold} + ${amount}` })
      .where(eq(players.id, toPlayerId));

    // Log both sides of the transfer
    await tx.insert(transactions).values([
      {
        playerId: fromPlayerId,
        type: 'transfer_out',
        amount: -amount,
        currency: 'gold',
        description: `${reason} (to ${toPlayerId})`,
      },
      {
        playerId: toPlayerId,
        type: 'transfer_in',
        amount,
        currency: 'gold',
        description: `${reason} (from ${fromPlayerId})`,
      },
    ]);

    logger.debug({ fromPlayerId, toPlayerId, amount, reason }, 'Gold transferred');
    return { success: true };
  });
}
