import { deductGold } from './currency.js';

// ─── RARITY BASE COSTS ──────────────────────────────────────────

const REPAIR_BASE_COST: Record<string, number> = {
  common: 10,
  uncommon: 25,
  rare: 50,
  epic: 100,
  mythic: 200,
};

const ENHANCEMENT_BASE_COST: Record<string, number> = {
  common: 50,
  uncommon: 100,
  rare: 200,
  epic: 500,
  mythic: 1000,
};

// ─── ENHANCEMENT SUCCESS RATES ───────────────────────────────────

/**
 * Map of current enhancement level → success rate (%).
 * +0 → +1 is 95%, +9 → +10 is 5%.
 */
const ENHANCEMENT_SUCCESS: Record<number, number> = {
  0: 95,
  1: 90,
  2: 80,
  3: 70,
  4: 60,
  5: 45,
  6: 30,
  7: 20,
  8: 10,
  9: 5,
};

// ─── REPAIR ──────────────────────────────────────────────────────

/**
 * Calculate the gold cost to repair an item.
 *
 * Formula: baseCost(rarity) × (maxDur − curDur) / maxDur × (1 + itemLevel × 0.1)
 *
 * Higher rarity and higher item level both increase the cost.
 * Returns 0 if the item is already at full durability.
 */
export function calculateRepairCost(
  itemLevel: number,
  rarity: string,
  currentDurability: number,
  maxDurability: number,
): number {
  if (currentDurability >= maxDurability) return 0;

  const baseCost = REPAIR_BASE_COST[rarity.toLowerCase()] ?? REPAIR_BASE_COST.common!;
  const damageFraction = (maxDurability - currentDurability) / maxDurability;
  const levelMultiplier = 1 + itemLevel * 0.1;

  return Math.max(1, Math.floor(baseCost * damageFraction * levelMultiplier));
}

// ─── ENHANCEMENT ─────────────────────────────────────────────────

/**
 * Calculate the gold cost to attempt the next enhancement level.
 *
 * Formula: baseCost(rarity) × (currentEnhancement + 1)^1.5
 *
 * Costs escalate sharply at higher enhancement levels to act as a
 * gold sink.
 */
export function calculateEnhancementCost(
  currentEnhancement: number,
  rarity: string,
): number {
  const baseCost = ENHANCEMENT_BASE_COST[rarity.toLowerCase()] ?? ENHANCEMENT_BASE_COST.common!;
  return Math.floor(baseCost * Math.pow(currentEnhancement + 1, 1.5));
}

/**
 * Get the success rate (0–100) for upgrading from the current enhancement
 * level to the next one.
 *
 * Returns 0 for enhancements at or beyond +10 (cannot go higher).
 */
export function getEnhancementSuccessRate(currentEnhancement: number): number {
  return ENHANCEMENT_SUCCESS[currentEnhancement] ?? 0;
}

// ─── DURABILITY ──────────────────────────────────────────────────

/**
 * Calculate how much durability an item loses from combat.
 *
 * Rule: 1 durability per 3 combat rounds, minimum 1.
 */
export function calculateDurabilityLoss(combatRounds: number): number {
  return Math.max(1, Math.floor(combatRounds / 3));
}

// ─── AUCTION HOUSE ───────────────────────────────────────────────

/**
 * Calculate the listing / sale fee for the auction house.
 *
 * Fee: 5 % of the sale price, minimum 1 gold.
 */
export function getAuctionFee(salePrice: number): number {
  return Math.max(1, Math.floor(salePrice * 0.05));
}

// ─── GUILD ───────────────────────────────────────────────────────

/**
 * Calculate the weekly guild dues per member based on the guild's level.
 *
 * Formula: 100 × guildLevel gold per member per week.
 */
export function calculateGuildDues(guildLevel: number): number {
  return 100 * guildLevel;
}

// ─── REPAIR ACTION ───────────────────────────────────────────────

/**
 * Deduct the repair cost from the player's gold.
 *
 * This is a convenience wrapper — callers should have already computed
 * the cost via `calculateRepairCost` and should update the item's
 * durability after this call succeeds.
 */
export async function repairItem(
  playerId: string,
  itemId: string,
  cost: number,
): Promise<{ success: boolean; message: string }> {
  if (cost <= 0) {
    return { success: true, message: 'No repair needed.' };
  }

  const result = await deductGold(playerId, cost, `Repair item ${itemId}`);

  if (!result.success) {
    return {
      success: false,
      message: `Not enough gold to repair. Cost: **${cost}g**, balance: **${result.newBalance}g**.`,
    };
  }

  return {
    success: true,
    message: `Item repaired for **${cost}g**. Remaining gold: **${result.newBalance}g**.`,
  };
}
