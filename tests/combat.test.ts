import { describe, it, expect } from 'vitest';
import { calculateDamage, calculateDodgeChance, isFleeSuccessful } from '../src/systems/combat/engine.js';

describe('Combat Systems — Engine Formulas', () => {
  describe('Damage Calculations', () => {
    it('should calculate base damage correctly based on attack and defense', () => {
      // Base damage = max(1, atk - def/2) * variance (0.85 to 1.15)
      // At equal stats (10 atk, 6 def), base is 10 - 3 = 7.
      // Expected range: [7 * 0.85, 7 * 1.15] => [5.95, 8.05] => [6, 8] after rounding
      const { damage, isCrit } = calculateDamage(10, 6, 0, 150); // 0% crit chance
      expect(damage).toBeGreaterThanOrEqual(5);
      expect(damage).toBeLessThanOrEqual(9);
      expect(isCrit).toBe(false);
    });

    it('should apply critical hit multiplier when crit rolls success', () => {
      // 100% crit chance, base damage should be multiplied by 1.5 (150% crit dmg)
      const { damage, isCrit } = calculateDamage(10, 6, 100, 150);
      expect(isCrit).toBe(true);
      // Base damage (7) * 1.5 = 10.5 => [9, 12] range
      expect(damage).toBeGreaterThanOrEqual(8);
      expect(damage).toBeLessThanOrEqual(13);
    });
  });

  describe('Dodge Chance', () => {
    it('should clamp dodge chance within [0, 30]%', () => {
      // Base 5% + (defenderSpeed - attackerSpeed) * 0.5
      // Attacker speed: 10, Defender speed: 30 => 5% + (20 * 0.5)% = 15%
      const dodge = calculateDodgeChance(10, 30);
      expect(dodge).toBe(15);

      // Clamped high
      const dodgeHigh = calculateDodgeChance(10, 100);
      expect(dodgeHigh).toBe(30);

      // Clamped low
      const dodgeLow = calculateDodgeChance(100, 10);
      expect(dodgeLow).toBe(0);
    });
  });

  describe('Flee Evasion Chance', () => {
    it('should determine flee success probability correctly', () => {
      // Speed 10 vs Speed 100 (hard to escape)
      // We can mock Math.random to verify or check outcomes over iterations
      const trials = 1000;
      let successCount = 0;
      for (let i = 0; i < trials; i++) {
        if (isFleeSuccessful(10, 100)) {
          successCount++;
        }
      }
      // Speed 10 vs 100: chance = 30% + (10 * 0.5)% = 35% chance
      const rate = successCount / trials;
      expect(rate).toBeGreaterThan(0.25);
      expect(rate).toBeLessThan(0.45);
    });
  });
});
