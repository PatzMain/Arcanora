import { rollChance, rollBetween } from '../utils/random.js';
import { recipesCatalog } from '../utils/catalog.js';

/**
 * A crafting recipe definition.
 */
export interface Recipe {
  id: string;
  name: string;
  description: string;
  resultItemId: string;
  resultQuantity: number;
  materials: { itemId: string; quantity: number }[];
  levelReq: number;
  successRate: number;
  craftingExpReward: number;
}

const RECIPES_CACHE_KEY = 'recipes_data';

/**
 * Loads all crafting recipes from recipes.json, caching for performance.
 */
export function loadRecipes(): Recipe[] {
  return recipesCatalog;
}

export function getRecipeById(id: string): Recipe | undefined {
  return recipesCatalog.find((r) => r.id === id);
}

/**
 * Checks whether a player can craft a recipe given their level and inventory.
 *
 * @returns Whether the craft is possible, plus details on any missing materials.
 */
export function canCraft(
  recipe: Recipe,
  playerLevel: number,
  inventory: { itemId: string; quantity: number }[],
): {
  canCraft: boolean;
  missingMaterials: { itemId: string; need: number; have: number }[];
} {
  const missingMaterials: { itemId: string; need: number; have: number }[] = [];

  // Check level requirement
  if (playerLevel < recipe.levelReq) {
    return {
      canCraft: false,
      missingMaterials: [],
    };
  }

  // Check material requirements
  for (const material of recipe.materials) {
    const owned = inventory.find((i) => i.itemId === material.itemId);
    const have = owned?.quantity ?? 0;

    if (have < material.quantity) {
      missingMaterials.push({
        itemId: material.itemId,
        need: material.quantity,
        have,
      });
    }
  }

  return {
    canCraft: missingMaterials.length === 0,
    missingMaterials,
  };
}

/**
 * Executes a crafting attempt.
 *
 * 1. Rolls against the recipe's success rate
 * 2. If successful, rolls for quality tier:
 *    - Normal:  70% base
 *    - Quality: 25% base
 *    - Perfect:  5% base
 *    Luck adds to quality/perfect chances (shifted from normal).
 * 3. Perfect quality grants +50% result quantity (rounded up)
 *
 * @param recipe - The recipe being crafted
 * @param luck   - Player's luck stat
 */
export function executeCraft(
  recipe: Recipe,
  luck: number,
): {
  success: boolean;
  quality: 'normal' | 'quality' | 'perfect';
  resultItemId: string;
  resultQuantity: number;
} {
  // Roll for success
  if (!rollChance(recipe.successRate)) {
    return {
      success: false,
      quality: 'normal',
      resultItemId: recipe.resultItemId,
      resultQuantity: 0,
    };
  }

  // Roll for quality — luck shifts probability toward higher tiers
  const luckBonus = luck / 100;
  const perfectChance = 5 + 5 * luckBonus;
  let qualityChance = 25 + 10 * luckBonus;
  // Ensure we don't exceed 100 total
  if (perfectChance + qualityChance > 80) {
    qualityChance = 80 - perfectChance;
  }

  let quality: 'normal' | 'quality' | 'perfect' = 'normal';
  const qualityRoll = Math.random() * 100;

  if (qualityRoll < perfectChance) {
    quality = 'perfect';
  } else if (qualityRoll < perfectChance + qualityChance) {
    quality = 'quality';
  }

  // Calculate result quantity
  let resultQuantity = recipe.resultQuantity;
  if (quality === 'perfect') {
    resultQuantity = Math.ceil(resultQuantity * 1.5);
  }

  return {
    success: true,
    quality,
    resultItemId: recipe.resultItemId,
    resultQuantity,
  };
}
