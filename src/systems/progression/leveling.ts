/**
 * Maximum character level.
 */
export const MAX_LEVEL = 20;

/**
 * XP thresholds for each level (1-indexed, index 0 unused).
 * Level N requires: Math.floor(100 * 1.5^(N-1)) XP
 *
 * Level  2:     100
 * Level  3:     150
 * Level  4:     225
 * ...
 * Level 20: ~96,000
 */
export const XP_TABLE: number[] = Array.from({ length: MAX_LEVEL + 1 }, (_, i) => {
  if (i <= 1) return 0; // Level 0 and 1 have no XP requirement
  return Math.floor(100 * Math.pow(1.5, i - 2));
});

/**
 * Returns the XP required to reach the given level.
 * Level 1 requires 0 XP. Returns 0 for out-of-range levels.
 */
export function getXpForLevel(level: number): number {
  if (level < 1 || level > MAX_LEVEL) return 0;
  return XP_TABLE[level]!;
}

/**
 * Checks if a player has enough XP to level up, handling multi-level ups.
 *
 * @returns The number of levels gained, the new level, remaining XP after
 *          all level-ups, and the total XP needed for the next level.
 */
export function checkLevelUp(
  currentLevel: number,
  currentExp: number,
): {
  levelsGained: number;
  newLevel: number;
  remainingExp: number;
  totalExpNeeded: number;
} {
  let level = currentLevel;
  let exp = currentExp;
  let levelsGained = 0;

  while (level < MAX_LEVEL) {
    const needed = XP_TABLE[level + 1]!;
    if (exp >= needed) {
      exp -= needed;
      level++;
      levelsGained++;
    } else {
      break;
    }
  }

  // If at max level, any remaining exp stays
  const totalExpNeeded = level < MAX_LEVEL ? XP_TABLE[level + 1]! : 0;

  return {
    levelsGained,
    newLevel: level,
    remainingExp: exp,
    totalExpNeeded,
  };
}

/**
 * Returns the total base stats for a character at the given level.
 *
 * Growth per level (approximate):
 * - HP:      +15 per level
 * - Mana:    +8  per level
 * - Attack:  +3  per level
 * - Defense: +2  per level
 * - Speed:   +1  per level
 * - Luck:    +1  per level
 */
export function getStatGrowth(level: number): {
  hpMax: number;
  manaMax: number;
  attack: number;
  defense: number;
  speed: number;
  luck: number;
} {
  return {
    hpMax: 50 + 15 * level,
    manaMax: 20 + 8 * level,
    attack: 5 + 3 * level,
    defense: 3 + 2 * level,
    speed: 2 + 1 * level,
    luck: 1 + 1 * level,
  };
}

/**
 * Returns the number of skill points earned at a given level.
 * Players gain 1 skill point every 2 levels, starting at level 2.
 *
 * Level 2 = 1 point, Level 4 = 2 points, ..., Level 20 = 10 points
 */
export function getSkillPointsForLevel(level: number): number {
  if (level < 2) return 0;
  return Math.floor(level / 2);
}
