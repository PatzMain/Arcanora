import { eq, and, sql } from 'drizzle-orm';
import { db } from '../database/client.js';
import { cooldowns } from '../database/schema.js';

/**
 * Checks whether a specific action is on cooldown for a player.
 * Returns the cooldown status and remaining time in milliseconds.
 */
export async function checkCooldown(
  playerId: string,
  action: string,
): Promise<{ onCooldown: boolean; remainingMs: number }> {
  const [row] = await db
    .select()
    .from(cooldowns)
    .where(and(eq(cooldowns.playerId, playerId), eq(cooldowns.action, action)))
    .limit(1);

  if (!row) {
    return { onCooldown: false, remainingMs: 0 };
  }

  const now = Date.now();
  const expiresAt = new Date(row.expiresAt).getTime();
  const remainingMs = expiresAt - now;

  if (remainingMs <= 0) {
    return { onCooldown: false, remainingMs: 0 };
  }

  return { onCooldown: true, remainingMs };
}

/**
 * Sets (or resets) a cooldown for a player action.
 * Uses an upsert (ON CONFLICT) to update the expiry if a row already exists.
 */
export async function setCooldown(
  playerId: string,
  action: string,
  durationMs: number,
): Promise<void> {
  const expiresAt = new Date(Date.now() + durationMs);

  await db
    .insert(cooldowns)
    .values({ playerId, action, expiresAt })
    .onConflictDoUpdate({
      target: [cooldowns.playerId, cooldowns.action],
      set: { expiresAt },
    });
}

/**
 * Clears a cooldown for a player action, allowing immediate reuse.
 */
export async function clearCooldown(
  playerId: string,
  action: string,
): Promise<void> {
  await db
    .delete(cooldowns)
    .where(and(eq(cooldowns.playerId, playerId), eq(cooldowns.action, action)));
}
