/**
 * Calculates the total HP for a world boss, scaled by server population.
 *
 * Formula: baseHp * (1 + serverMemberCount * 0.1)
 * Minimum HP is 10,000 regardless of inputs.
 */
export function calculateWorldBossHp(
  bossBaseHp: number,
  serverMemberCount: number,
  isGlobal = false
): number {
  if (isGlobal) {
    // Global bosses are server-agnostic and fought by many servers.
    // Scale HP as if there were 150 participants.
    const scaledHp = bossBaseHp * (1 + 150 * 0.1); // 16x baseHP
    return Math.max(scaledHp, 80000); // Minimum 80,000 HP for global bosses
  }
  const scaledHp = bossBaseHp * (1 + serverMemberCount * 0.1);
  return Math.max(scaledHp, 10000); // Minimum 10,000 HP for local world bosses
}

/**
 * Calculates rewards for a player who participated in a world boss fight.
 *
 * Rewards are proportional to the player's damage contribution:
 * - Base gold: bossLevel * 100 * (playerDamage / totalDamage)
 * - Base exp:  bossLevel * 200 * (playerDamage / totalDamage)
 * - Top contributor gets 2x multiplier on all rewards
 * - Bonus loot chance if damage contribution >= 10%
 */
export function calculateBossRewards(
  totalDamage: number,
  playerDamage: number,
  bossLevel: number,
): {
  gold: number;
  exp: number;
  bonusLoot: boolean;
} {
  if (totalDamage <= 0) {
    return { gold: 0, exp: 0, bonusLoot: false };
  }

  const damagePercent = playerDamage / totalDamage;

  // Is this player the top contributor?
  // Note: Caller should pass this as playerDamage === max(allDamages).
  // We treat contribution >= totalDamage as top contributor for solo kills.
  const isTopContributor = playerDamage >= totalDamage;

  const multiplier = isTopContributor ? 2 : 1;

  const baseGold = bossLevel * 100;
  const baseExp = bossLevel * 200;

  const gold = Math.floor(baseGold * damagePercent * multiplier);
  const exp = Math.floor(baseExp * damagePercent * multiplier);
  const bonusLoot = damagePercent >= 0.1;

  return { gold, exp, bonusLoot };
}

/**
 * Returns the top N contributors from a list of boss fight participants,
 * sorted by damage dealt (descending) and assigned a rank.
 */
export function getTopContributors(
  participants: { playerId: string; damageDealt: number }[],
  count: number,
): { playerId: string; damageDealt: number; rank: number }[] {
  const sorted = [...participants].sort((a, b) => b.damageDealt - a.damageDealt);
  const top = sorted.slice(0, count);

  return top.map((p, index) => ({
    playerId: p.playerId,
    damageDealt: p.damageDealt,
    rank: index + 1,
  }));
}
