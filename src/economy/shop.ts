import { itemsCatalog } from '../utils/catalog.js';
import { deductGold, awardGold } from './currency.js';
import { addItem, removeItem } from '../database/queries/inventory.js';
import { db } from '../database/client.js';
import { players, inventory } from '../database/schema.js';
import { eq, and } from 'drizzle-orm';


// ─── TYPES ───────────────────────────────────────────────────────

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  type: string;
  rarity: string;
  buyPrice: number;
  sellPrice: number;
  levelReq: number;
  stats?: Record<string, number>;
}

// ─── ITEM CATALOG ────────────────────────────────────────────────

const CACHE_KEY = 'shop:items_catalog';

/**
 * Load and cache the full item catalog from data/items.json.
 * Returns the cached copy on subsequent calls within the TTL window.
 */
function loadItemCatalog(): ShopItem[] {
  return itemsCatalog;
}

// ─── SHOP BROWSING ───────────────────────────────────────────────

/**
 * Returns buyable items filtered by the player's level, paginated.
 * Only items with a buyPrice > 0 are listed.
 */
export function getShopItems(
  playerLevel: number,
  page: number = 1,
  pageSize: number = 10,
): { items: ShopItem[]; totalPages: number } {
  const catalog = loadItemCatalog();

  const available = catalog.filter(
    (item) => item.buyPrice > 0 && item.levelReq <= playerLevel,
  );

  const totalPages = Math.max(1, Math.ceil(available.length / pageSize));
  const safePage = Math.max(1, Math.min(page, totalPages));
  const start = (safePage - 1) * pageSize;
  const items = available.slice(start, start + pageSize);

  return { items, totalPages };
}

// ─── PRICE HELPERS ───────────────────────────────────────────────

/**
 * Look up the buy price for an item ID. Returns 0 if the item is not buyable.
 */
export function getItemBuyPrice(itemId: string): number {
  const catalog = loadItemCatalog();
  const item = catalog.find((i) => i.id === itemId);
  return item?.buyPrice ?? 0;
}

/**
 * Look up the sell price for an item ID. Returns 0 if the item cannot be sold.
 */
export function getItemSellPrice(itemId: string): number {
  const catalog = loadItemCatalog();
  const item = catalog.find((i) => i.id === itemId);
  return item?.sellPrice ?? 0;
}

// ─── BUY ─────────────────────────────────────────────────────────

/**
 * Purchase an item from the NPC shop.
 *
 * Validates:
 * 1. Item exists and is buyable (buyPrice > 0)
 * 2. Player meets the level requirement
 * 3. Player has enough gold
 *
 * On success the gold is deducted and the item is added to inventory.
 */
export async function buyItem(
  playerId: string,
  itemId: string,
  quantity: number = 1,
): Promise<{ success: boolean; message: string; spent?: number }> {
  if (quantity <= 0) {
    return { success: false, message: 'Quantity must be at least 1.' };
  }

  const catalog = loadItemCatalog();
  const item = catalog.find((i) => i.id === itemId);

  if (!item || item.buyPrice <= 0) {
    return { success: false, message: 'That item is not available for purchase.' };
  }

  // Check player level
  const player = await db.query.players.findFirst({
    where: eq(players.id, playerId),
    columns: { level: true },
  });

  if (!player) {
    return { success: false, message: 'Player not found.' };
  }

  if (player.level < item.levelReq) {
    return {
      success: false,
      message: `You need to be level ${item.levelReq} to buy **${item.name}**.`,
    };
  }

  const totalCost = item.buyPrice * quantity;

  // Deduct gold
  const deduction = await deductGold(
    playerId,
    totalCost,
    `Shop purchase: ${item.name} x${quantity}`,
  );

  if (!deduction.success) {
    return {
      success: false,
      message: `Not enough gold. You need **${totalCost}g** but only have **${deduction.newBalance}g**.`,
    };
  }

  // Add item(s) to inventory
  await addItem(playerId, itemId, quantity);

  return {
    success: true,
    message: `Purchased **${item.name}** x${quantity} for **${totalCost}g**.`,
    spent: totalCost,
  };
}

// ─── SELL ────────────────────────────────────────────────────────

/**
 * Sell an item from the player's inventory to the NPC shop.
 *
 * Looks up the item's sell price from the catalog, awards gold, and
 * removes the specified quantity from inventory.
 */
export async function sellItem(
  playerId: string,
  inventoryId: string,
  quantity: number = 1,
): Promise<{ success: boolean; message: string; earned?: number }> {
  if (quantity <= 0) {
    return { success: false, message: 'Quantity must be at least 1.' };
  }

  // Look up the inventory row to get the itemId and current quantity
  const invRow = await db.query.inventory.findFirst({
    where: and(
      eq(inventory.id, inventoryId),
      eq(inventory.playerId, playerId),
    ),
  });

  if (!invRow) {
    return { success: false, message: 'Item not found in your inventory.' };
  }

  if (invRow.equipped) {
    return { success: false, message: 'Unequip the item before selling it.' };
  }

  if (invRow.quantity < quantity) {
    return {
      success: false,
      message: `You only have **${invRow.quantity}** of that item.`,
    };
  }

  const sellPrice = getItemSellPrice(invRow.itemId);
  if (sellPrice <= 0) {
    return { success: false, message: 'That item cannot be sold.' };
  }

  const totalEarned = sellPrice * quantity;

  // Remove from inventory first
  await removeItem(playerId, inventoryId, quantity);

  // Award gold
  const catalog = loadItemCatalog();
  const itemDef = catalog.find((i) => i.id === invRow.itemId);
  const itemName = itemDef?.name ?? invRow.itemId;

  await awardGold(
    playerId,
    totalEarned,
    `Shop sale: ${itemName} x${quantity}`,
  );

  return {
    success: true,
    message: `Sold **${itemName}** x${quantity} for **${totalEarned}g**.`,
    earned: totalEarned,
  };
}
