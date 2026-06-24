import { describe, it, expect } from 'vitest';
import { computeStats } from '../src/systems/progression/stats.js';
import { getStatGrowth } from '../src/systems/progression/leveling.js';
import { scaleEnemyStats } from '../src/systems/combat/enemy.js';

describe('Stats and Scaling Alignment', () => {
  describe('Player Stat Growth Multiples of 10', () => {
    it('should return base stats that are multiples of 10 for all levels 1 to 20', () => {
      for (let level = 1; level <= 20; level++) {
        const stats = getStatGrowth(level);
        expect(stats.hpMax % 10).toBe(0);
        expect(stats.manaMax % 10).toBe(0);
        expect(stats.attack % 10).toBe(0);
        expect(stats.defense % 10).toBe(0);
        expect(stats.speed % 10).toBe(0);
        expect(stats.luck % 10).toBe(0);
      }
    });
  });

  describe('Player Compute Stats Rounding', () => {
    it('should round final computed stats to the nearest multiple of 10', () => {
      // Setup some odd flat bonuses from equipment
      const equippedItems = [
        { slot: 'weapon', rarity: 'common', stats: { hpMax: 13, attack: 7, speed: 2 } },
        { slot: 'chest', rarity: 'common', stats: { defense: 4, manaMax: 9 } }
      ];

      const stats = computeStats(
        1,       // level 1
        0,       // prestige 0
        'novice',// novice class
        equippedItems,
        null,
        []
      );

      // Level 1 base stats: HP 80, Mana 40, Atk 10, Def 10, Spd 10, Luck 10
      // Expected with gear: HP 80+13=93 -> 90. Mana 40+9=49 -> 50. Atk 10+7=17 -> 20. Def 10+4=14 -> 10. Spd 10+2=12 -> 10.
      expect(stats.hpMax).toBe(90);
      expect(stats.manaMax).toBe(50);
      expect(stats.attack).toBe(20);
      expect(stats.defense).toBe(10);
      expect(stats.speed).toBe(10);
    });
  });

  describe('Enemy Stats Scaling Multiples of 10', () => {
    it('should scale and round enemy stats to multiples of 10', () => {
      const dummyEnemy = {
        id: 'dummy',
        name: 'Dummy',
        description: 'Test dummy',
        zone: 'verdant_meadows',
        rarity: 'normal' as const,
        level: 1,
        stats: { hp: 50, attack: 10, defense: 10, speed: 10 },
        abilities: [],
        lootTable: [],
        expReward: 10,
        goldReward: 10
      };

      const scaled = scaleEnemyStats(dummyEnemy, 3); // Level difference 2 => 1.1x multiplier
      // hp: 50 * 1.1 = 55 -> 60
      // attack: 10 * 1.1 = 11 -> 10
      // defense: 10 * 1.1 = 11 -> 10
      expect(scaled.hp).toBe(60);
      expect(scaled.attack).toBe(10);
      expect(scaled.defense).toBe(10);
      expect(scaled.hp % 10).toBe(0);
      expect(scaled.attack % 10).toBe(0);
      expect(scaled.defense % 10).toBe(0);
    });
  });
});
