import { getStatGrowth } from './leveling.js';
import { applyClassModifiers } from '../classes.js';
import { getPrestigeBonus } from './prestige.js';

export const STAT_KEYS = [
  'hpMax',
  'manaMax',
  'attack',
  'defense',
  'critChance',
  'critDmg',
  'speed',
  'luck'
] as const;

export type StatKey = typeof STAT_KEYS[number];
export type StatBlock = Record<StatKey, number>;

/**
 * Fully computed character stats after all modifiers are applied.
 */
export interface ComputedStats extends StatBlock {}

/**
 * Helper to add stats from a source block into a target block.
 */
export function addStats(target: StatBlock, source: Partial<Record<StatKey, number>>): void {
  if (!source) return;
  for (const key of STAT_KEYS) {
    target[key] += source[key] ?? 0;
  }
}

/**
 * Helper to multiply all stats by a factor.
 */
export function scaleStats(target: StatBlock, factor: number): void {
  for (const key of STAT_KEYS) {
    target[key] *= factor;
  }
}

/**
 * Helper to apply percentage bonuses (e.g. from active buffs).
 */
export function applyPercentBonus(target: StatBlock, bonuses: Partial<Record<StatKey, number>>): void {
  if (!bonuses) return;
  for (const key of STAT_KEYS) {
    target[key] *= 1 + (bonuses[key] ?? 0) / 100;
  }
}

/**
 * Helper to round all final values.
 * HP, Mana, Attack, Defense, Speed, Luck are rounded to the nearest multiple of 10.
 * Crit Chance and Crit Damage are rounded to 2 decimal places.
 */
export function roundStats(target: StatBlock): void {
  for (const key of STAT_KEYS) {
    if (key === 'critChance' || key === 'critDmg') {
      target[key] = Math.round(target[key] * 100) / 100;
    } else {
      target[key] = Math.round(target[key] / 10) * 10;
    }
  }
}

/**
 * Computes the total effective stats for a character by layering
 * all stat sources in order:
 *
 * 1. Base stats from level (via getStatGrowth)
 * 2. Class percentage modifiers
 * 3. Equipment flat stat bonuses
 * 4. Pet passive stat bonuses
 * 5. Prestige percentage multiplier (+5% per prestige level)
 * 6. Active buff modifiers
 *
 * All final values are rounded appropriately.
 */
export function computeStats(
  baseLevel: number,
  prestige: number,
  playerClass: string,
  equippedItems: any[],
  petStats: any | null,
  activeBuffs: any[],
): ComputedStats {
  // Step 1: Base stats from level
  const base = getStatGrowth(baseLevel);
  const stats: ComputedStats = {
    hpMax: base.hpMax,
    manaMax: base.manaMax,
    attack: base.attack,
    defense: base.defense,
    critChance: 5, // Base 5% crit chance
    critDmg: 150, // Base 150% crit damage
    speed: base.speed,
    luck: base.luck,
  };

  // Step 2: Apply class modifiers (percentage-based)
  if (playerClass) {
    const modified = applyClassModifiers(stats, playerClass);
    for (const key of STAT_KEYS) {
      stats[key] = modified[key];
    }
  }

  // Step 3: Add equipment stats
  for (const item of equippedItems) {
    if (item?.stats) {
      addStats(stats, item.stats);
    }
  }

  // Step 4: Add pet passive stats
  if (petStats) {
    addStats(stats, petStats);
  }

  // Step 5: Apply prestige multiplier
  const prestigeMultiplier = getPrestigeBonus(prestige);
  scaleStats(stats, prestigeMultiplier);

  // Step 6: Apply active buffs
  for (const buff of activeBuffs) {
    if (!buff) continue;

    // Flat bonuses
    if (buff.flatBonus) {
      addStats(stats, buff.flatBonus);
    }

    // Percentage bonuses
    if (buff.percentBonus) {
      applyPercentBonus(stats, buff.percentBonus);
    }
  }

  // Step 7: Round final values
  roundStats(stats);

  return stats;
}
