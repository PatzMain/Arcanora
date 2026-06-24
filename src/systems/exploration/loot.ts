import { rollChance, rollBetween } from '../../utils/random.js';
import { cacheGet, cacheSet } from '../../utils/cache.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Represents a resolved loot drop with item and quantity.
 */
export interface LootDrop {
  itemId: string;
  quantity: number;
}

/**
 * Represents a single entry in a loot table with drop probability and quantity range.
 */
export interface LootTableEntry {
  itemId: string;
  dropRate: number;
  minQty: number;
  maxQty: number;
}

const ITEMS_CACHE_KEY = 'items_data';

/**
 * Loads the full item catalog from items.json, caching for performance.
 */
export function loadItems(): any[] {
  const cached = cacheGet<any[]>(ITEMS_CACHE_KEY);
  if (cached) return cached;

  const filePath = join(__dirname, '..', '..', '..', 'data', 'items.json');
  const raw = readFileSync(filePath, 'utf-8');
  const items: any[] = JSON.parse(raw);

  cacheSet(ITEMS_CACHE_KEY, items);
  return items;
}

/**
 * Retrieves a single item by its ID from the item catalog.
 */
export function getItemData(itemId: string): any {
  const items = loadItems();
  return items.find((item: any) => item.id === itemId);
}

/**
 * Resolves a loot table into concrete drops.
 *
 * For each entry, the effective drop rate is modified by:
 * - Player luck: `dropRate * (1 + luck / 100)`
 * - Encounter type multiplier: rare = 1.5x, boss = 2x
 *
 * If the roll succeeds, a random quantity between minQty and maxQty is generated.
 */
export function resolveLoot(
  lootTable: LootTableEntry[],
  luck: number,
  encounterType: string,
): LootDrop[] {
  const drops: LootDrop[] = [];

  // Determine encounter multiplier
  let encounterMultiplier = 1;
  if (encounterType === 'rare_mob') {
    encounterMultiplier = 1.5;
  } else if (encounterType === 'boss') {
    encounterMultiplier = 2;
  }

  for (const entry of lootTable) {
    const effectiveRate = entry.dropRate * (1 + luck / 100) * encounterMultiplier;
    const capped = Math.min(effectiveRate, 100);

    if (rollChance(capped)) {
      const quantity = rollBetween(entry.minQty, entry.maxQty);
      drops.push({ itemId: entry.itemId, quantity });
    }
  }

  return drops;
}

/**
 * Generates special loot for treasure encounters.
 *
 * Treasure encounters provide:
 * - Guaranteed gold drop scaled by player level
 * - Chance for rare crafting materials (30% base, modified by luck)
 * - Chance for random equipment (15% base, modified by luck)
 */
export function generateTreasureLoot(playerLevel: number, luck: number): LootDrop[] {
  const drops: LootDrop[] = [];

  // Guaranteed gold drop, scaled by player level
  const goldMin = 50 * playerLevel;
  const goldMax = 150 * playerLevel;
  drops.push({
    itemId: 'gold',
    quantity: rollBetween(goldMin, goldMax),
  });

  // Chance for rare crafting materials (30% base + luck)
  const materialRate = 30 * (1 + luck / 100);
  if (rollChance(Math.min(materialRate, 100))) {
    const materialTiers = [
      { itemId: 'mat_copper_ore', minLevel: 1 },
      { itemId: 'mat_iron_ore', minLevel: 5 },
      { itemId: 'mat_crystal_shard', minLevel: 10 },
      { itemId: 'mat_void_essence', minLevel: 15 },
    ];

    const eligible = materialTiers.filter((m) => playerLevel >= m.minLevel);
    if (eligible.length > 0) {
      const picked = eligible[Math.floor(Math.random() * eligible.length)]!;
      drops.push({
        itemId: picked.itemId,
        quantity: rollBetween(1, Math.ceil(playerLevel / 5)),
      });
    }
  }

  // Chance for equipment (15% base + luck)
  const equipRate = 15 * (1 + luck / 100);
  if (rollChance(Math.min(equipRate, 100))) {
    const equipTiers = [
      { itemId: 'weapon_wooden_sword', minLevel: 1 },
      { itemId: 'weapon_steel_claymore', minLevel: 5 },
      { itemId: 'weapon_excalibur', minLevel: 10 },
      { itemId: 'weapon_void_slayer', minLevel: 15 },
    ];

    const eligible = equipTiers.filter((e) => playerLevel >= e.minLevel);
    if (eligible.length > 0) {
      const picked = eligible[Math.floor(Math.random() * eligible.length)]!;
      drops.push({ itemId: picked.itemId, quantity: 1 });
    }
  }

  return drops;
}
