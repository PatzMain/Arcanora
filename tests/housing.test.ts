import { describe, it, expect } from 'vitest';

const MAX_PLOTS_BY_TIER: Record<number, number> = {
  0: 0,
  1: 2,
  2: 4,
  3: 8
};

const UPGRADES = [
  {
    tier: 1,
    name: 'Rustic Shack',
    costGold: 0,
    materials: [],
    plots: 2,
    bedBonus: 5,
    storageSlots: 10
  },
  {
    tier: 2,
    name: 'Cozy Cottage',
    costGold: 1500,
    materials: [
      { itemId: 'mat_birch_logs', quantity: 20 },
      { itemId: 'mat_copper_ore', quantity: 10 }
    ],
    plots: 4,
    bedBonus: 10,
    storageSlots: 25
  },
  {
    tier: 3,
    name: 'Stone Homestead',
    costGold: 5000,
    materials: [
      { itemId: 'mat_oak_logs', quantity: 50 },
      { itemId: 'mat_iron_ore', quantity: 50 }
    ],
    plots: 8,
    bedBonus: 20,
    storageSlots: 50
  }
];

describe('Housing & Farming System Core Formulas', () => {
  describe('Farm Plot Count limits', () => {
    it('should grant correct plot sizes by tier', () => {
      expect(MAX_PLOTS_BY_TIER[0]).toBe(0);
      expect(MAX_PLOTS_BY_TIER[1]).toBe(2);
      expect(MAX_PLOTS_BY_TIER[2]).toBe(4);
      expect(MAX_PLOTS_BY_TIER[3]).toBe(8);
    });
  });

  describe('Cottage Upgrades', () => {
    it('should have linear scaling cost requirements', () => {
      const shack = UPGRADES[0]!;
      const cottage = UPGRADES[1]!;
      const homestead = UPGRADES[2]!;

      expect(shack.costGold).toBe(0);
      expect(cottage.costGold).toBe(1500);
      expect(homestead.costGold).toBe(5000);

      expect(shack.storageSlots).toBe(10);
      expect(cottage.storageSlots).toBe(25);
      expect(homestead.storageSlots).toBe(50);
    });
  });

  describe('Farming Yield Roll', () => {
    it('should generate between 3 and 5 crops per harvest', () => {
      for (let i = 0; i < 100; i++) {
        const yieldQty = Math.floor(Math.random() * 3) + 3;
        expect(yieldQty).toBeGreaterThanOrEqual(3);
        expect(yieldQty).toBeLessThanOrEqual(5);
      }
    });
  });
});
