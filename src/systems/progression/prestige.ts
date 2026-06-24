/**
 * Player must be this level to prestige.
 */
export const PRESTIGE_LEVEL_REQ = 20;

/**
 * Each prestige level adds this percentage bonus to all stats.
 * 0.05 = 5% per prestige level.
 */
export const PRESTIGE_MULTIPLIER = 0.05;

/**
 * Checks whether a player at the given level is eligible to prestige.
 */
export function canPrestige(level: number): boolean {
  return level >= PRESTIGE_LEVEL_REQ;
}

/**
 * Returns the total stat multiplier for a given prestige level.
 *
 * Prestige 0 = 1.00 (no bonus)
 * Prestige 1 = 1.05 (+5%)
 * Prestige 2 = 1.10 (+10%)
 * ...
 */
export function getPrestigeBonus(prestigeLevel: number): number {
  return 1 + prestigeLevel * PRESTIGE_MULTIPLIER;
}

/**
 * Returns the rewards granted upon reaching a new prestige level.
 *
 * Rewards escalate with each prestige:
 * - P1: 1,000 gold, 10 gems
 * - P2: 2,500 gold, 25 gems, "Ascendant" title
 * - P3: 5,000 gold, 50 gems, "Transcendent" title
 * - P4: 10,000 gold, 100 gems, "Eternal" title
 * - P5+: 15,000 gold, 150 gems, "Immortal" title
 */
export function getPrestigeRewards(prestigeLevel: number): {
  gold: number;
  gems: number;
  title?: string;
} {
  const rewardTiers: { gold: number; gems: number; title?: string }[] = [
    { gold: 0, gems: 0 }, // P0 — no rewards
    { gold: 1000, gems: 10 },
    { gold: 2500, gems: 25, title: 'Ascendant' },
    { gold: 5000, gems: 50, title: 'Transcendent' },
    { gold: 10000, gems: 100, title: 'Eternal' },
  ];

  if (prestigeLevel >= rewardTiers.length) {
    return { gold: 15000, gems: 150, title: 'Immortal' };
  }

  return rewardTiers[prestigeLevel] ?? { gold: 0, gems: 0 };
}

/**
 * Returns the reset state for a prestige reset.
 *
 * On prestige:
 * - Level resets to 1
 * - Experience resets to 0
 * - Gold is reduced to 10% of current amount
 * - All items are retained
 */
export function calculatePrestigeReset(): {
  level: number;
  exp: number;
  gold: number;
  retainedItems: boolean;
} {
  return {
    level: 1,
    exp: 0,
    gold: 0.1, // Multiplier — caller applies as: Math.floor(currentGold * 0.1)
    retainedItems: true,
  };
}
