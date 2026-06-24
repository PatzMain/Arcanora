import { eq, and, sql } from 'drizzle-orm';
import { db } from '../client.js';
import { inventory, playerEquipment } from '../schema.js';

/**
 * Add an item to a player's inventory.
 * If the player already owns a non-equipped, non-enhanced stack of the same
 * item, the quantity is incremented instead of inserting a new row.
 */
export async function addItem(
  playerId: string,
  itemId: string,
  quantity: number = 1,
  durability?: number,
) {
  return db.transaction(async (tx) => {
    // Try to find an existing stackable row (not equipped, no enhancement)
    const existing = await tx.query.inventory.findFirst({
      where: and(
        eq(inventory.playerId, playerId),
        eq(inventory.itemId, itemId),
        eq(inventory.equipped, false),
        eq(inventory.enhancement, 0),
      ),
    });

    if (existing && durability === undefined) {
      // Stack onto existing row
      const [updated] = await tx
        .update(inventory)
        .set({ quantity: sql`${inventory.quantity} + ${quantity}` })
        .where(eq(inventory.id, existing.id))
        .returning();
      return updated;
    }

    // Insert new row
    const [inserted] = await tx
      .insert(inventory)
      .values({
        playerId,
        itemId,
        quantity,
        durability: durability ?? null,
      })
      .returning();
    return inserted;
  });
}

/**
 * Remove a given quantity of an item from inventory.
 * Deletes the row entirely if quantity reaches zero or below.
 */
export async function removeItem(
  playerId: string,
  inventoryId: string,
  quantity: number = 1,
) {
  return db.transaction(async (tx) => {
    const item = await tx.query.inventory.findFirst({
      where: and(
        eq(inventory.id, inventoryId),
        eq(inventory.playerId, playerId),
      ),
    });

    if (!item) return null;

    const newQuantity = item.quantity - quantity;

    if (newQuantity <= 0) {
      await tx.delete(inventory).where(eq(inventory.id, inventoryId));
      return { ...item, quantity: 0, deleted: true as const };
    }

    const [updated] = await tx
      .update(inventory)
      .set({ quantity: newQuantity })
      .where(eq(inventory.id, inventoryId))
      .returning();
    return { ...updated, deleted: false as const };
  });
}

/**
 * Get a player's inventory with pagination.
 */
export async function getPlayerInventory(
  playerId: string,
  page: number = 1,
  pageSize: number = 10,
) {
  const offset = (page - 1) * pageSize;

  const [items, countResult] = await Promise.all([
    db
      .select()
      .from(inventory)
      .where(eq(inventory.playerId, playerId))
      .limit(pageSize)
      .offset(offset)
      .orderBy(inventory.acquiredAt),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(inventory)
      .where(eq(inventory.playerId, playerId)),
  ]);

  const total = countResult[0]?.count ?? 0;

  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Get all equipped items for a player.
 */
export async function getEquippedItems(playerId: string) {
  return db
    .select()
    .from(inventory)
    .where(
      and(eq(inventory.playerId, playerId), eq(inventory.equipped, true)),
    );
}

/**
 * Equip an item to a specific slot and update the player_equipment table.
 * Unequips the previously equipped item in that slot, if any.
 */
export async function equipItem(
  playerId: string,
  inventoryId: string,
  slot: string,
) {
  const validSlots = [
    'weapon',
    'helmet',
    'chest',
    'gloves',
    'boots',
    'accessory',
    'pet',
  ] as const;
  type Slot = (typeof validSlots)[number];

  if (!validSlots.includes(slot as Slot)) {
    throw new Error(`Invalid equipment slot: ${slot}`);
  }

  const typedSlot = slot as Slot;

  return db.transaction(async (tx) => {
    // Get current equipment row
    const equip = await tx.query.playerEquipment.findFirst({
      where: eq(playerEquipment.playerId, playerId),
    });

    if (!equip) {
      throw new Error('Player equipment row not found');
    }

    // Unequip old item in the slot if one exists
    const oldInventoryId = equip[typedSlot];
    if (oldInventoryId) {
      await tx
        .update(inventory)
        .set({ equipped: false })
        .where(eq(inventory.id, oldInventoryId));
    }

    // Mark the new item as equipped
    await tx
      .update(inventory)
      .set({ equipped: true })
      .where(
        and(eq(inventory.id, inventoryId), eq(inventory.playerId, playerId)),
      );

    // Update the equipment slot
    await tx
      .update(playerEquipment)
      .set({ [typedSlot]: inventoryId })
      .where(eq(playerEquipment.playerId, playerId));

    return { slot: typedSlot, inventoryId };
  });
}

/**
 * Unequip the item in a given slot.
 */
export async function unequipItem(playerId: string, slot: string) {
  const validSlots = [
    'weapon',
    'helmet',
    'chest',
    'gloves',
    'boots',
    'accessory',
    'pet',
  ] as const;
  type Slot = (typeof validSlots)[number];

  if (!validSlots.includes(slot as Slot)) {
    throw new Error(`Invalid equipment slot: ${slot}`);
  }

  const typedSlot = slot as Slot;

  return db.transaction(async (tx) => {
    const equip = await tx.query.playerEquipment.findFirst({
      where: eq(playerEquipment.playerId, playerId),
    });

    if (!equip) {
      throw new Error('Player equipment row not found');
    }

    const currentInventoryId = equip[typedSlot];
    if (!currentInventoryId) return null; // nothing equipped in this slot

    // Mark the item as unequipped
    await tx
      .update(inventory)
      .set({ equipped: false })
      .where(eq(inventory.id, currentInventoryId));

    // Clear the slot
    await tx
      .update(playerEquipment)
      .set({ [typedSlot]: null })
      .where(eq(playerEquipment.playerId, playerId));

    return { slot: typedSlot, unequippedItemId: currentInventoryId };
  });
}

/**
 * Update the durability of an inventory item.
 */
export async function updateDurability(
  inventoryId: string,
  durability: number,
) {
  const [updated] = await db
    .update(inventory)
    .set({ durability })
    .where(eq(inventory.id, inventoryId))
    .returning();
  return updated;
}

/**
 * Update the enhancement level of an inventory item.
 */
export async function updateEnhancement(
  inventoryId: string,
  enhancement: number,
) {
  const [updated] = await db
    .update(inventory)
    .set({ enhancement })
    .where(eq(inventory.id, inventoryId))
    .returning();
  return updated;
}
