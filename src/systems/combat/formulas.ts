import { rollChance, rollBetween } from '../../utils/random.js';
import type { CombatStats, StatusEffect } from './engine.js';

/**
 * Calculates damage dealt from an attacker to a defender.
 * Formula: baseDmg = max(1, atk - def/2) * randomVariance(0.85–1.15)
 * If crit rolls, multiply by critDmg / 100.
 */
export function calculateDamage(
  attackerAtk: number,
  defenderDef: number,
  critChance: number,
  critDmg: number,
): { damage: number; isCrit: boolean } {
  const rawBase = Math.max(1, attackerAtk - defenderDef / 2);
  const varianceRoll = rollBetween(85, 115);
  const variance = varianceRoll / 100;

  let damage = Math.round(rawBase * variance);

  const isCrit = rollChance(critChance);
  if (isCrit) {
    damage = Math.round(damage * (critDmg / 100));
  }

  damage = Math.max(1, damage);
  return { damage, isCrit };
}

/**
 * Calculates dodge chance based on speed differential.
 * Base 5% + (defenderSpeed - attackerSpeed) * 0.5, clamped 0–30%.
 */
export function calculateDodgeChance(
  attackerSpeed: number,
  defenderSpeed: number,
): number {
  const raw = 5 + (defenderSpeed - attackerSpeed) * 0.5;
  return Math.min(30, Math.max(0, raw));
}

/**
 * Determines if a flee attempt is successful.
 * Chance = 30% + (playerSpeed * 0.5)%, capped at 90%.
 */
export function isFleeSuccessful(
  playerSpeed: number,
  _enemySpeed: number,
): boolean {
  const chance = 30 + playerSpeed * 0.5;
  return rollChance(Math.min(chance, 90));
}

/**
 * Returns the total flat modifier for a given stat from active buffs/debuffs.
 */
export function getStatModifier(effects: StatusEffect[], stat: keyof CombatStats): number {
  let total = 0;
  for (const eff of effects) {
    if (eff.stat === stat && eff.value !== undefined) {
      total += eff.type === 'buff' ? eff.value : -eff.value;
    }
  }
  return total;
}
