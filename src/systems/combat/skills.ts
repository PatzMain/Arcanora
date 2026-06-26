import type { CombatStats, StatusEffect } from './engine.js';
import { rollChance, rollBetween } from '../../utils/random.js';
import { Registry } from '../../utils/registry.js';

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

export interface SkillBehavior {
  execute(skill: SkillDefinition, casterStats: CombatStats, targetStats: CombatStats): SkillResult;
}

export const skillsRegistry = new Registry<SkillDefinition>();
export const skillBehaviorRegistry = new Registry<SkillBehavior>();

// ─── Initial Skill Definitions ──────────────────────────────────────────────

import { INITIAL_SKILLS } from './skillsData.js';

// Populate the registry with initial skills
for (const skill of INITIAL_SKILLS) {
  skillsRegistry.register(skill.id, skill);
}

// Backward-compatible Proxy array for SKILLS
export const SKILLS: SkillDefinition[] = new Proxy([] as SkillDefinition[], {
  get(target, prop) {
    const all = skillsRegistry.getAll();
    const value = Reflect.get(all, prop);
    if (typeof value === 'function') {
      return value.bind(all);
    }
    return value;
  },
  getOwnPropertyDescriptor(target, prop) {
    const all = skillsRegistry.getAll();
    return Reflect.getOwnPropertyDescriptor(all, prop);
  },
  ownKeys() {
    const all = skillsRegistry.getAll();
    return Reflect.ownKeys(all);
  },
  has(target, prop) {
    const all = skillsRegistry.getAll();
    return Reflect.has(all, prop);
  }
});

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
  const customBehavior = skillBehaviorRegistry.get(skill.id);
  if (customBehavior) {
    return customBehavior.execute(skill, casterStats, _targetStats);
  }

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
