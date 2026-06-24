/**
 * Minimum player level required to select a class.
 */
export const CLASS_UNLOCK_LEVEL = 5;

/**
 * Cost in gems to reroll (change) your character class.
 */
export const CLASS_REROLL_COST = 50;

/**
 * Defines a character class with percentage-based stat modifiers.
 * Modifiers are expressed as decimal multipliers (e.g., 0.20 = +20%, -0.10 = -10%).
 */
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

/**
 * All available character classes with their stat modifiers.
 */
export const CLASSES: Record<string, ClassDefinition> = {
  warrior: {
    id: 'warrior',
    name: 'Warrior',
    description: 'A stalwart frontline fighter with superior HP and attack power. Sacrifices magical ability and agility for raw resilience.',
    statModifiers: {
      hpMax: 0.20,
      manaMax: -0.10,
      attack: 0.15,
      defense: 0.10,
      critChance: 0,
      critDmg: 0,
      speed: -0.05,
      luck: 0,
    },
  },
  mage: {
    id: 'mage',
    name: 'Mage',
    description: 'A master of arcane arts with devastating critical strikes and deep mana reserves. Fragile, but rewards skillful play.',
    statModifiers: {
      hpMax: -0.10,
      manaMax: 0.30,
      attack: 0,
      defense: -0.05,
      critChance: 0,
      critDmg: 0.20,
      speed: 0.10,
      luck: 0,
    },
  },
  rogue: {
    id: 'rogue',
    name: 'Rogue',
    description: 'A swift shadow striker who excels at critical hits and finding rare loot. Glass cannon with unmatched speed.',
    statModifiers: {
      hpMax: -0.15,
      manaMax: 0,
      attack: 0,
      defense: -0.10,
      critChance: 0.25,
      critDmg: 0,
      speed: 0.20,
      luck: 0.15,
    },
  },
  ranger: {
    id: 'ranger',
    name: 'Ranger',
    description: 'A versatile outdoorsman balanced between offense and evasion. Keen eyes grant improved critical strikes and fortune.',
    statModifiers: {
      hpMax: 0,
      manaMax: 0,
      attack: 0.10,
      defense: -0.10,
      critChance: 0.15,
      critDmg: 0,
      speed: 0.15,
      luck: 0.10,
    },
  },
  healer: {
    id: 'healer',
    name: 'Healer',
    description: 'A devoted support specialist with deep mana and high survivability. Sacrifices offensive power for team sustain.',
    statModifiers: {
      hpMax: 0.20,
      manaMax: 0.25,
      attack: -0.15,
      defense: 0.10,
      critChance: 0,
      critDmg: -0.10,
      speed: 0,
      luck: 0,
    },
  },
};

/**
 * Retrieves a class definition by its name/ID.
 */
export function getClassModifiers(className: string): ClassDefinition | undefined {
  return CLASSES[className.toLowerCase()];
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

/**
 * Returns all available character classes as an array.
 */
export function getAvailableClasses(): ClassDefinition[] {
  return Object.values(CLASSES);
}
