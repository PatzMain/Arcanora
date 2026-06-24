import { describe, it, expect } from 'vitest';
import {
  calculateRepairCost,
  calculateEnhancementCost,
  getEnhancementSuccessRate,
  calculateDurabilityLoss,
  getAuctionFee,
  calculateGuildDues
} from '../src/economy/antiInflation.js';

describe('Economy Systems — Anti-Inflation Sinks', () => {
  describe('Repair Costs', () => {
    it('should cost 0 gold to repair a fully durable item', () => {
      const cost = calculateRepairCost(5, 'common', 50, 50);
      expect(cost).toBe(0);
    });

    it('should scale repair cost based on level, rarity, and damage', () => {
      // 50% damaged common item: base cost 10 * 0.5 * (1 + 1 * 0.1) => 5 * 1.1 = 5.5 => 5 gold
      const cost = calculateRepairCost(1, 'common', 25, 50);
      expect(cost).toBe(5);

      // Same damage, higher rarity (rare = 50 base): 50 * 0.5 * 1.1 = 27.5 => 27 gold
      const costRare = calculateRepairCost(1, 'rare', 25, 50);
      expect(costRare).toBe(27);
    });
  });

  describe('Enhancement (Upgrades)', () => {
    it('should increase cost exponentially for higher upgrade tiers', () => {
      // +0 to +1: base * (0 + 1)^1.5 = base cost
      const cost0 = calculateEnhancementCost(0, 'uncommon'); // uncommon base is 100
      expect(cost0).toBe(100);

      // +4 to +5: base * (4 + 1)^1.5 = 100 * 5^1.5 = 100 * 11.18 = 1118
      const cost4 = calculateEnhancementCost(4, 'uncommon');
      expect(cost4).toBe(1118);
    });

    it('should scale down success chance as upgrade level grows', () => {
      // +0 -> +1: 95%
      expect(getEnhancementSuccessRate(0)).toBe(95);
      // +9 -> +10: 5%
      expect(getEnhancementSuccessRate(9)).toBe(5);
      // +10+: 0%
      expect(getEnhancementSuccessRate(10)).toBe(0);
    });
  });

  describe('Combat Durability Decay', () => {
    it('should lose 1 durability per 3 combat rounds (minimum 1)', () => {
      expect(calculateDurabilityLoss(1)).toBe(1);
      expect(calculateDurabilityLoss(3)).toBe(1);
      expect(calculateDurabilityLoss(5)).toBe(1);
      expect(calculateDurabilityLoss(6)).toBe(2);
      expect(calculateDurabilityLoss(15)).toBe(5);
    });
  });

  describe('Auction listing fees', () => {
    it('should take 5% fee (minimum 1 gold)', () => {
      expect(getAuctionFee(10)).toBe(1); // 5% of 10 is 0.5 => clamp to 1
      expect(getAuctionFee(100)).toBe(5);
      expect(getAuctionFee(2000)).toBe(100);
    });
  });

  describe('Guild weekly dues', () => {
    it('should scale with guild level', () => {
      expect(calculateGuildDues(1)).toBe(100);
      expect(calculateGuildDues(5)).toBe(500);
    });
  });
});
