import { getStatGrowth } from './leveling.js';
import { applyClassModifiers } from '../classes.js';
import { getPrestigeBonus } from './prestige.js';

/**
 * Fully computed character stats after all modifiers are applied.
 */
export interface ComputedStats {
  hpMax: number;
  manaMax: number;
  attack: number;
  defense: number;
  critChance: number;
  critDmg: number;
  speed: number;
  luck: number;
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
 * All final values are rounded to integers.
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
    stats.hpMax = modified.hpMax;
    stats.manaMax = modified.manaMax;
    stats.attack = modified.attack;
    stats.defense = modified.defense;
    stats.critChance = modified.critChance;
    stats.critDmg = modified.critDmg;
    stats.speed = modified.speed;
    stats.luck = modified.luck;
  }

  // Step 3: Add equipment stats
  for (const item of equippedItems) {
    if (!item?.stats) continue;
    stats.hpMax += item.stats.hpMax ?? 0;
    stats.manaMax += item.stats.manaMax ?? 0;
    stats.attack += item.stats.attack ?? 0;
    stats.defense += item.stats.defense ?? 0;
    stats.critChance += item.stats.critChance ?? 0;
    stats.critDmg += item.stats.critDmg ?? 0;
    stats.speed += item.stats.speed ?? 0;
    stats.luck += item.stats.luck ?? 0;
  }

  // Step 4: Add pet passive stats
  if (petStats) {
    stats.hpMax += petStats.hpMax ?? 0;
    stats.manaMax += petStats.manaMax ?? 0;
    stats.attack += petStats.attack ?? 0;
    stats.defense += petStats.defense ?? 0;
    stats.critChance += petStats.critChance ?? 0;
    stats.critDmg += petStats.critDmg ?? 0;
    stats.speed += petStats.speed ?? 0;
    stats.luck += petStats.luck ?? 0;
  }

  // Step 5: Apply prestige multiplier
  const prestigeMultiplier = getPrestigeBonus(prestige);
  stats.hpMax *= prestigeMultiplier;
  stats.manaMax *= prestigeMultiplier;
  stats.attack *= prestigeMultiplier;
  stats.defense *= prestigeMultiplier;
  stats.critChance *= prestigeMultiplier;
  stats.critDmg *= prestigeMultiplier;
  stats.speed *= prestigeMultiplier;
  stats.luck *= prestigeMultiplier;

  // Step 6: Apply active buffs
  for (const buff of activeBuffs) {
    if (!buff) continue;

    // Flat bonuses
    if (buff.flatBonus) {
      stats.hpMax += buff.flatBonus.hpMax ?? 0;
      stats.manaMax += buff.flatBonus.manaMax ?? 0;
      stats.attack += buff.flatBonus.attack ?? 0;
      stats.defense += buff.flatBonus.defense ?? 0;
      stats.critChance += buff.flatBonus.critChance ?? 0;
      stats.critDmg += buff.flatBonus.critDmg ?? 0;
      stats.speed += buff.flatBonus.speed ?? 0;
      stats.luck += buff.flatBonus.luck ?? 0;
    }

    // Percentage bonuses
    if (buff.percentBonus) {
      stats.hpMax *= 1 + (buff.percentBonus.hpMax ?? 0) / 100;
      stats.manaMax *= 1 + (buff.percentBonus.manaMax ?? 0) / 100;
      stats.attack *= 1 + (buff.percentBonus.attack ?? 0) / 100;
      stats.defense *= 1 + (buff.percentBonus.defense ?? 0) / 100;
      stats.critChance *= 1 + (buff.percentBonus.critChance ?? 0) / 100;
      stats.critDmg *= 1 + (buff.percentBonus.critDmg ?? 0) / 100;
      stats.speed *= 1 + (buff.percentBonus.speed ?? 0) / 100;
      stats.luck *= 1 + (buff.percentBonus.luck ?? 0) / 100;
    }
  }

  // Step 7: Round all final values (stats in multiples of 10, except crits)
  stats.hpMax = Math.round(stats.hpMax / 10) * 10;
  stats.manaMax = Math.round(stats.manaMax / 10) * 10;
  stats.attack = Math.round(stats.attack / 10) * 10;
  stats.defense = Math.round(stats.defense / 10) * 10;
  stats.critChance = Math.round(stats.critChance * 100) / 100; // Keep 2 decimals for %
  stats.critDmg = Math.round(stats.critDmg * 100) / 100; // Keep 2 decimals for %
  stats.speed = Math.round(stats.speed / 10) * 10;
  stats.luck = Math.round(stats.luck / 10) * 10;

  return stats;
}
