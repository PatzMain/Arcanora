import type { ElementalAffinity } from './elements.js';

export type EnemyIntentType = 'heavy_attack' | 'spell_cast' | 'defensive_stance' | 'charge_ultimate' | 'basic';

export interface EnemyIntent {
  type: EnemyIntentType;
  name: string;
  element: ElementalAffinity;
  damageMultiplier: number;
  description: string;
  recommendedCounter: 'guard' | 'parry' | 'attack' | 'flee';
  isTelegraphed: boolean;
}

export type PlayerDefensiveStance = 'none' | 'guard' | 'parry';

export interface DefenseMitigationResult {
  damageTaken: number;
  damageReflected: number;
  isStaggered: boolean;
  staminaRestored: number;
  manaRestored: number;
  message: string;
}

/**
 * Determines enemy telegraphed intent based on turn number, monster health, and enemy abilities.
 */
export function generateEnemyIntent(round: number, enemyHpPercent: number, abilities: Array<{ name: string; type?: string; element?: string }>): EnemyIntent {
  // Every 3 turns or when low HP, telegraph heavy attack or charge
  if (round % 3 === 0 || enemyHpPercent <= 30) {
    if (abilities.some(a => a.name.toLowerCase().includes('flame') || a.name.toLowerCase().includes('fire') || a.name.toLowerCase().includes('spark'))) {
      return {
        type: 'spell_cast',
        name: 'Incinerating Flare',
        element: 'Fire',
        damageMultiplier: 1.8,
        description: 'Channelling blazing runes... Heavy fire blast incoming next turn!',
        recommendedCounter: 'guard',
        isTelegraphed: true
      };
    }

    if (abilities.some(a => a.name.toLowerCase().includes('slam') || a.name.toLowerCase().includes('strike') || a.name.toLowerCase().includes('smash'))) {
      return {
        type: 'heavy_attack',
        name: 'Crushing Overhead Smash',
        element: 'Physical',
        damageMultiplier: 2.0,
        description: 'Winding up an earth-shattering blow! Timing a Parry will stagger them.',
        recommendedCounter: 'parry',
        isTelegraphed: true
      };
    }

    return {
      type: 'charge_ultimate',
      name: 'Enraged Fury',
      element: 'Physical',
      damageMultiplier: 2.2,
      description: 'Eyes glowing with blind rage! Prepare to mitigate devastating damage.',
      recommendedCounter: 'guard',
      isTelegraphed: true
    };
  }

  if (round % 4 === 2) {
    return {
      type: 'defensive_stance',
      name: 'Ironhide Guard',
      element: 'Physical',
      damageMultiplier: 0.5,
      description: 'Hardening hide and preparing a counter-deflection posture.',
      recommendedCounter: 'attack',
      isTelegraphed: false
    };
  }

  return {
    type: 'basic',
    name: 'Standard Strike',
    element: 'Physical',
    damageMultiplier: 1.0,
    description: 'Looking for an opening for standard attack.',
    recommendedCounter: 'attack',
    isTelegraphed: false
  };
}

/**
 * Calculates defensive mitigation when player executes Guard or Parry against an enemy attack.
 */
export function resolveDefensiveStance(
  incomingRawDamage: number,
  stance: PlayerDefensiveStance,
  playerSpeed: number,
  enemySpeed: number
): DefenseMitigationResult {
  if (stance === 'guard') {
    const mitigated = Math.round(incomingRawDamage * 0.45); // 55% reduction
    return {
      damageTaken: mitigated,
      damageReflected: 0,
      isStaggered: false,
      staminaRestored: 15,
      manaRestored: 10,
      message: `🛡️ Firm Guard! Reduced damage by 55% (took ${mitigated} dmg) and restored 15 Stamina / 10 Mana.`
    };
  }

  if (stance === 'parry') {
    // Speed-based parry success window
    const parryChance = Math.min(85, Math.max(50, 60 + (playerSpeed - enemySpeed) * 2));
    const roll = Math.random() * 100;
    const isSuccess = roll <= parryChance;

    if (isSuccess) {
      const damageTaken = Math.round(incomingRawDamage * 0.20); // 80% reduction
      const damageReflected = Math.round(incomingRawDamage * 0.45); // 45% reflected
      return {
        damageTaken,
        damageReflected,
        isStaggered: true,
        staminaRestored: 20,
        manaRestored: 15,
        message: `⚡ PERFECT PARRY! Deflected 80% damage, staggered the enemy, and riposted for ${damageReflected} reflected damage!`
      };
    } else {
      // Partial parry failure (glancing block)
      const damageTaken = Math.round(incomingRawDamage * 0.70);
      return {
        damageTaken,
        damageReflected: 0,
        isStaggered: false,
        staminaRestored: 5,
        manaRestored: 0,
        message: `⚠️ Glancing Parry! Blocked 30% damage, but failed to stagger the enemy.`
      };
    }
  }

  // No defensive stance
  return {
    damageTaken: incomingRawDamage,
    damageReflected: 0,
    isStaggered: false,
    staminaRestored: 0,
    manaRestored: 0,
    message: ''
  };
}
