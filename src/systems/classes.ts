/**
 * Minimum player level required to select a class.
 */
export const CLASS_UNLOCK_LEVEL = 5;

/**
 * Cost in gems to reroll (change) your character class.
 */
export const CLASS_REROLL_COST = 50;

export interface ClassDefinition {
  id: string;
  name: string;
  description: string;
  statModifiers: {
    hpMax: number;
    manaMax: number;
    attack: number;
    defense: number;
    critChance: number;
    critDmg: number;
    speed: number;
    luck: number;
  };
}

import { classesCatalog } from '../utils/catalog.js';

export const CLASSES: Record<string, ClassDefinition> = {};

/**
 * Retrieves a class definition by its name/ID.
 */
export function getClassModifiers(className: string): ClassDefinition | undefined {
  return classesCatalog.find((c) => c.id.toLowerCase() === className.toLowerCase());
}

/**
 * Applies percentage-based class modifiers to base stats.
 *
 * Each modifier is applied as: `stat * (1 + modifier)`
 * e.g., a +20% modifier on 100 HP → 100 * 1.20 = 120 HP
 *
 * @returns A new stat object with all modifiers applied.
 */
export function applyClassModifiers(baseStats: any, className: string): any {
  const classDef = getClassModifiers(className);
  if (!classDef) return { ...baseStats };

  const mods = classDef.statModifiers;
  return {
    hpMax: Math.round((baseStats.hpMax ?? 0) * (1 + mods.hpMax)),
    manaMax: Math.round((baseStats.manaMax ?? 0) * (1 + mods.manaMax)),
    attack: Math.round((baseStats.attack ?? 0) * (1 + mods.attack)),
    defense: Math.round((baseStats.defense ?? 0) * (1 + mods.defense)),
    critChance: Math.round(((baseStats.critChance ?? 0) * (1 + mods.critChance)) * 100) / 100,
    critDmg: Math.round(((baseStats.critDmg ?? 0) * (1 + mods.critDmg)) * 100) / 100,
    speed: Math.round((baseStats.speed ?? 0) * (1 + mods.speed)),
    luck: Math.round((baseStats.luck ?? 0) * (1 + mods.luck)),
  };
}

/**
 * Checks whether a player at the given level can select a class.
 */
export function canSelectClass(level: number): boolean {
  return level >= CLASS_UNLOCK_LEVEL;
}

export function getAvailableClasses(): ClassDefinition[] {
  return classesCatalog;
}
