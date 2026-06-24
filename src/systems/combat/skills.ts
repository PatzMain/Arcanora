import type { CombatStats, StatusEffect } from './engine.js';
import { rollChance, rollBetween } from '../../utils/random.js';

// ─── Skill Types ─────────────────────────────────────────────────────

export interface SkillEffect {
  type: 'damage' | 'heal' | 'buff' | 'debuff' | 'dot' | 'hot';
  target: 'self' | 'enemy';
  stat?: keyof CombatStats;
  value: number;
  duration?: number;  // turns
  scaling?: number;   // attack scaling multiplier
}

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  class: 'warrior' | 'mage' | 'rogue' | 'ranger' | 'healer' | 'all';
  manaCost: number;
  cooldown: number; // turns
  levelReq: number;
  effects: SkillEffect[];
}

export interface SkillResult {
  damage: number;
  healing: number;
  effects: StatusEffect[];
  description: string;
}

// ─── Skill Definitions ──────────────────────────────────────────────

export const SKILLS: SkillDefinition[] = [
  // ── Warrior Skills ──
  {
    id: 'warrior_power_strike',
    name: 'Power Strike',
    description: 'A devastating overhead blow that deals 1.5× damage.',
    class: 'warrior',
    manaCost: 8,
    cooldown: 2,
    levelReq: 1,
    effects: [
      { type: 'damage', target: 'enemy', value: 0, scaling: 1.5 },
    ],
  },
  {
    id: 'warrior_shield_bash',
    name: 'Shield Bash',
    description: 'Slam your shield into the enemy, dealing damage and reducing their speed.',
    class: 'warrior',
    manaCost: 12,
    cooldown: 3,
    levelReq: 3,
    effects: [
      { type: 'damage', target: 'enemy', value: 0, scaling: 1.0 },
      { type: 'debuff', target: 'enemy', stat: 'speed', value: 5, duration: 2 },
    ],
  },
  {
    id: 'warrior_battle_cry',
    name: 'Battle Cry',
    description: 'Roar with fury, boosting your attack for 3 turns.',
    class: 'warrior',
    manaCost: 10,
    cooldown: 4,
    levelReq: 5,
    effects: [
      { type: 'buff', target: 'self', stat: 'attack', value: 8, duration: 3 },
    ],
  },
  {
    id: 'warrior_iron_fortress',
    name: 'Iron Fortress',
    description: 'Harden your stance, greatly increasing defense for 3 turns.',
    class: 'warrior',
    manaCost: 14,
    cooldown: 4,
    levelReq: 8,
    effects: [
      { type: 'buff', target: 'self', stat: 'defense', value: 12, duration: 3 },
    ],
  },
  {
    id: 'warrior_berserker_rage',
    name: 'Berserker Rage',
    description: 'Enter a berserker frenzy — massive attack and speed boost, but defense drops.',
    class: 'warrior',
    manaCost: 25,
    cooldown: 6,
    levelReq: 12,
    effects: [
      { type: 'buff', target: 'self', stat: 'attack', value: 15, duration: 3 },
      { type: 'buff', target: 'self', stat: 'speed', value: 8, duration: 3 },
      { type: 'debuff', target: 'self', stat: 'defense', value: 8, duration: 3 },
    ],
  },

  // ── Mage Skills ──
  {
    id: 'mage_fireball',
    name: 'Fireball',
    description: 'Hurl a blazing fireball that scorches the enemy.',
    class: 'mage',
    manaCost: 10,
    cooldown: 1,
    levelReq: 1,
    effects: [
      { type: 'damage', target: 'enemy', value: 0, scaling: 1.4 },
    ],
  },
  {
    id: 'mage_frost_nova',
    name: 'Frost Nova',
    description: 'Unleash a wave of frost, dealing damage and slowing the enemy.',
    class: 'mage',
    manaCost: 15,
    cooldown: 3,
    levelReq: 4,
    effects: [
      { type: 'damage', target: 'enemy', value: 0, scaling: 1.1 },
      { type: 'debuff', target: 'enemy', stat: 'speed', value: 6, duration: 2 },
    ],
  },
  {
    id: 'mage_arcane_shield',
    name: 'Arcane Shield',
    description: 'Conjure a magical barrier that boosts your defense.',
    class: 'mage',
    manaCost: 12,
    cooldown: 4,
    levelReq: 6,
    effects: [
      { type: 'buff', target: 'self', stat: 'defense', value: 10, duration: 3 },
    ],
  },
  {
    id: 'mage_mana_surge',
    name: 'Mana Surge',
    description: 'Channel arcane energy to restore a burst of mana.',
    class: 'mage',
    manaCost: 0,
    cooldown: 5,
    levelReq: 7,
    effects: [
      { type: 'heal', target: 'self', value: 30 }, // restores 30 mana (handled specially)
    ],
  },
  {
    id: 'mage_meteor_strike',
    name: 'Meteor Strike',
    description: 'Call down a devastating meteor from the heavens.',
    class: 'mage',
    manaCost: 35,
    cooldown: 6,
    levelReq: 12,
    effects: [
      { type: 'damage', target: 'enemy', value: 0, scaling: 2.5 },
    ],
  },

  // ── Rogue Skills ──
  {
    id: 'rogue_backstab',
    name: 'Backstab',
    description: 'Strike from the shadows with a high critical chance.',
    class: 'rogue',
    manaCost: 8,
    cooldown: 2,
    levelReq: 1,
    effects: [
      { type: 'damage', target: 'enemy', value: 0, scaling: 1.3 },
      { type: 'buff', target: 'self', stat: 'critChance', value: 25, duration: 1 },
    ],
  },
  {
    id: 'rogue_poison_strike',
    name: 'Poison Strike',
    description: 'Coat your blade in venom, dealing damage and applying poison.',
    class: 'rogue',
    manaCost: 10,
    cooldown: 3,
    levelReq: 3,
    effects: [
      { type: 'damage', target: 'enemy', value: 0, scaling: 0.8 },
      { type: 'dot', target: 'enemy', value: 4, duration: 3 },
    ],
  },
  {
    id: 'rogue_smoke_bomb',
    name: 'Smoke Bomb',
    description: 'Throw a smoke bomb to increase your evasion.',
    class: 'rogue',
    manaCost: 10,
    cooldown: 4,
    levelReq: 5,
    effects: [
      { type: 'buff', target: 'self', stat: 'speed', value: 10, duration: 2 },
    ],
  },
  {
    id: 'rogue_shadow_step',
    name: 'Shadow Step',
    description: 'Teleport behind the enemy, boosting your speed and next attack.',
    class: 'rogue',
    manaCost: 12,
    cooldown: 3,
    levelReq: 7,
    effects: [
      { type: 'buff', target: 'self', stat: 'speed', value: 8, duration: 2 },
      { type: 'buff', target: 'self', stat: 'attack', value: 5, duration: 1 },
    ],
  },
  {
    id: 'rogue_assassinate',
    name: 'Assassinate',
    description: 'Execute a lethal strike — deals massive damage to low HP enemies.',
    class: 'rogue',
    manaCost: 30,
    cooldown: 6,
    levelReq: 12,
    effects: [
      { type: 'damage', target: 'enemy', value: 0, scaling: 3.0 }, // huge scaling, meant for finishers
    ],
  },

  // ── Ranger Skills ──
  {
    id: 'ranger_quick_shot',
    name: 'Quick Shot',
    description: 'Fire a swift arrow at the enemy.',
    class: 'ranger',
    manaCost: 6,
    cooldown: 1,
    levelReq: 1,
    effects: [
      { type: 'damage', target: 'enemy', value: 0, scaling: 1.2 },
    ],
  },
  {
    id: 'ranger_poison_arrow',
    name: 'Poison Arrow',
    description: 'Shoot a poison-tipped arrow that inflicts damage over time.',
    class: 'ranger',
    manaCost: 10,
    cooldown: 3,
    levelReq: 3,
    effects: [
      { type: 'damage', target: 'enemy', value: 0, scaling: 0.6 },
      { type: 'dot', target: 'enemy', value: 5, duration: 3 },
    ],
  },
  {
    id: 'ranger_natures_embrace',
    name: "Nature's Embrace",
    description: 'Call upon nature to heal your wounds over time.',
    class: 'ranger',
    manaCost: 14,
    cooldown: 4,
    levelReq: 5,
    effects: [
      { type: 'hot', target: 'self', value: 6, duration: 3 },
    ],
  },
  {
    id: 'ranger_eagle_eye',
    name: 'Eagle Eye',
    description: 'Sharpen your focus, boosting critical hit chance.',
    class: 'ranger',
    manaCost: 10,
    cooldown: 4,
    levelReq: 7,
    effects: [
      { type: 'buff', target: 'self', stat: 'critChance', value: 15, duration: 3 },
    ],
  },
  {
    id: 'ranger_volley',
    name: 'Volley',
    description: 'Rain down a volley of arrows on the enemy.',
    class: 'ranger',
    manaCost: 28,
    cooldown: 6,
    levelReq: 12,
    effects: [
      { type: 'damage', target: 'enemy', value: 0, scaling: 0.8 },
      { type: 'damage', target: 'enemy', value: 0, scaling: 0.8 },
      { type: 'damage', target: 'enemy', value: 0, scaling: 0.8 },
    ],
  },

  // ── Healer Skills ──
  {
    id: 'healer_holy_light',
    name: 'Holy Light',
    description: 'Channel divine light to heal your wounds.',
    class: 'healer',
    manaCost: 10,
    cooldown: 1,
    levelReq: 1,
    effects: [
      { type: 'heal', target: 'self', value: 20 },
    ],
  },
  {
    id: 'healer_blessing',
    name: 'Blessing',
    description: 'Bestow a holy blessing, boosting attack power.',
    class: 'healer',
    manaCost: 12,
    cooldown: 4,
    levelReq: 3,
    effects: [
      { type: 'buff', target: 'self', stat: 'attack', value: 6, duration: 3 },
    ],
  },
  {
    id: 'healer_purify',
    name: 'Purify',
    description: 'Cleanse all debuffs with holy energy.',
    class: 'healer',
    manaCost: 15,
    cooldown: 4,
    levelReq: 6,
    effects: [
      // Special: removes all debuffs — handled in executeSkill
      { type: 'heal', target: 'self', value: 0 },
    ],
  },
  {
    id: 'healer_divine_shield',
    name: 'Divine Shield',
    description: 'Surround yourself with holy energy, greatly boosting defense.',
    class: 'healer',
    manaCost: 18,
    cooldown: 5,
    levelReq: 8,
    effects: [
      { type: 'buff', target: 'self', stat: 'defense', value: 15, duration: 3 },
    ],
  },
  {
    id: 'healer_resurrection',
    name: 'Resurrection',
    description: 'Call upon the divine — fully heal yourself and gain powerful buffs.',
    class: 'healer',
    manaCost: 40,
    cooldown: 8,
    levelReq: 12,
    effects: [
      { type: 'heal', target: 'self', value: 9999 }, // full heal (clamped to maxHp)
      { type: 'buff', target: 'self', stat: 'attack', value: 10, duration: 3 },
      { type: 'buff', target: 'self', stat: 'defense', value: 10, duration: 3 },
      { type: 'buff', target: 'self', stat: 'speed', value: 5, duration: 3 },
    ],
  },
];

// ─── Lookup Helpers ──────────────────────────────────────────────────

/**
 * Returns a skill definition by ID, or undefined if not found.
 */
export function getSkillById(id: string): SkillDefinition | undefined {
  return SKILLS.find((s) => s.id === id);
}

/**
 * Returns all skills available to a given class (includes 'all' class skills).
 */
export function getSkillsForClass(playerClass: string): SkillDefinition[] {
  const cls = playerClass.toLowerCase();
  return SKILLS.filter((s) => s.class === cls || s.class === 'all');
}

/**
 * Returns all skills available to a class at or below a given level.
 */
export function getAvailableSkills(
  playerClass: string,
  playerLevel: number,
): SkillDefinition[] {
  return getSkillsForClass(playerClass).filter((s) => s.levelReq <= playerLevel);
}

// ─── Skill Execution ────────────────────────────────────────────────

/**
 * Executes a skill and returns the computed damage, healing, applied effects,
 * and a human-readable description of what happened.
 */
export function executeSkill(
  skill: SkillDefinition,
  casterStats: CombatStats,
  _targetStats: CombatStats,
): SkillResult {
  let totalDamage = 0;
  let totalHealing = 0;
  const appliedEffects: StatusEffect[] = [];
  const descriptions: string[] = [];

  // Special handling for Purify: remove all debuffs
  if (skill.id === 'healer_purify') {
    descriptions.push('✨ All debuffs have been cleansed!');
    // The caller is responsible for clearing the debuff array on the caster's state
  }

  for (const effect of skill.effects) {
    switch (effect.type) {
      case 'damage': {
        // Scaling-based damage: baseDmg * scaling * random variance
        const base = Math.max(1, casterStats.attack - 2); // slightly offset for skill balance
        const scaling = effect.scaling ?? 1.0;
        const varianceRoll = rollBetween(90, 110);
        const variance = varianceRoll / 100;
        const dmg = Math.max(1, Math.round(base * scaling * variance));
        totalDamage += dmg;
        descriptions.push(`💥 ${skill.name} deals ${dmg} damage!`);
        break;
      }

      case 'heal': {
        // Flat heal value, clamped to max HP by the caller
        const healAmt = effect.value;
        totalHealing += healAmt;
        if (healAmt > 0) {
          descriptions.push(`💚 ${skill.name} heals for ${healAmt} HP!`);
        }
        break;
      }

      case 'buff': {
        if (effect.stat && effect.duration) {
          const statusEffect: StatusEffect = {
            id: `${skill.id}_${effect.stat}_buff`,
            name: `${skill.name} (${effect.stat} ↑)`,
            type: 'buff',
            stat: effect.stat,
            value: effect.value,
            turnsRemaining: effect.duration,
          };
          appliedEffects.push(statusEffect);
          descriptions.push(`⬆️ ${skill.name} boosts ${effect.stat} by ${effect.value} for ${effect.duration} turns!`);
        }
        break;
      }

      case 'debuff': {
        if (effect.stat && effect.duration) {
          const statusEffect: StatusEffect = {
            id: `${skill.id}_${effect.stat}_debuff`,
            name: `${skill.name} (${effect.stat} ↓)`,
            type: 'debuff',
            stat: effect.stat,
            value: effect.value,
            turnsRemaining: effect.duration,
          };
          appliedEffects.push(statusEffect);

          // Determine which target gets the debuff
          if (effect.target === 'self') {
            descriptions.push(`⬇️ ${skill.name} reduces your ${effect.stat} by ${effect.value} for ${effect.duration} turns!`);
          } else {
            descriptions.push(`⬇️ ${skill.name} reduces enemy ${effect.stat} by ${effect.value} for ${effect.duration} turns!`);
          }
        }
        break;
      }

      case 'dot': {
        if (effect.duration) {
          const statusEffect: StatusEffect = {
            id: `${skill.id}_dot`,
            name: `${skill.name} (Poison)`,
            type: 'debuff',
            damagePerTurn: effect.value,
            turnsRemaining: effect.duration,
          };
          appliedEffects.push(statusEffect);
          descriptions.push(`☠️ ${skill.name} poisons the enemy for ${effect.value} damage/turn for ${effect.duration} turns!`);
        }
        break;
      }

      case 'hot': {
        if (effect.duration) {
          const statusEffect: StatusEffect = {
            id: `${skill.id}_hot`,
            name: `${skill.name} (Regen)`,
            type: 'buff',
            healPerTurn: effect.value,
            turnsRemaining: effect.duration,
          };
          appliedEffects.push(statusEffect);
          descriptions.push(`🌿 ${skill.name} heals ${effect.value} HP/turn for ${effect.duration} turns!`);
        }
        break;
      }
    }
  }

  return {
    damage: totalDamage,
    healing: totalHealing,
    effects: appliedEffects,
    description: descriptions.join(' '),
  };
}
