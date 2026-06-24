import { describe, it, expect } from 'vitest';
import { getXpForLevel, checkLevelUp, getStatGrowth } from '../src/systems/progression/leveling.js';

describe('Progression Systems — Leveling & Growth', () => {
  describe('XP Table thresholds', () => {
    it('should return 0 XP requirement for level 1', () => {
      expect(getXpForLevel(1)).toBe(0);
    });

    it('should return correct threshold for level 2', () => {
      expect(getXpForLevel(2)).toBe(100);
    });

    it('should return correct threshold for level 3', () => {
      expect(getXpForLevel(3)).toBe(150);
    });
  });

  describe('Level Up Calculations', () => {
    it('should not level up if experience is insufficient', () => {
      const result = checkLevelUp(1, 50);
      expect(result.levelsGained).toBe(0);
      expect(result.newLevel).toBe(1);
      expect(result.remainingExp).toBe(50);
    });

    it('should level up once if experience meets threshold', () => {
      // Level 2 requires 100 XP
      const result = checkLevelUp(1, 120);
      expect(result.levelsGained).toBe(1);
      expect(result.newLevel).toBe(2);
      expect(result.remainingExp).toBe(20);
    });

    it('should handle multi-level ups correctly', () => {
      // Level 2 requires 100 XP. Remaining: 220 XP.
      // Level 3 requires 150 XP. Remaining: 70 XP.
      // Total XP needed for 1 -> 3 is 250 XP. Input 320 XP.
      const result = checkLevelUp(1, 320);
      expect(result.levelsGained).toBe(2);
      expect(result.newLevel).toBe(3);
      expect(result.remainingExp).toBe(70);
    });
  });

  describe('Stat Growth Calculations', () => {
    it('should return correct base stats for level 1', () => {
      const stats = getStatGrowth(1);
      expect(stats.hpMax).toBe(65);
      expect(stats.manaMax).toBe(28);
      expect(stats.attack).toBe(8);
      expect(stats.defense).toBe(5);
    });

    it('should increase stats linearly with level', () => {
      const lv1 = getStatGrowth(1);
      const lv2 = getStatGrowth(2);
      expect(lv2.hpMax - lv1.hpMax).toBe(15);
      expect(lv2.manaMax - lv1.manaMax).toBe(8);
      expect(lv2.attack - lv1.attack).toBe(3);
      expect(lv2.defense - lv1.defense).toBe(2);
    });
  });
});
