import { eq, and } from 'drizzle-orm';
import { db } from '../../database/client.js';
import { players, cooldowns, combatSessions } from '../../database/schema.js';
import { getAndUpdatePlayerStamina } from '../../database/queries/player.js';
import { getEquippedItems } from '../../database/queries/inventory.js';
import { computeStats } from '../progression/stats.js';
import { zonesCatalog, itemsCatalog } from '../../utils/catalog.js';

const REST_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes

export interface RestResult {
  success: boolean;
  message?: string;
  error?: string;
  cooldownRemaining?: string;
  locationName?: string;
}

export async function executeRest(playerId: string): Promise<RestResult> {
  const player = await getAndUpdatePlayerStamina(playerId);
  if (!player) {
    return { success: false, error: 'Player profile not found. Please complete the /tutorial first.' };
  }

  // Check current zone has a rest bed
  const currentLoc = zonesCatalog.find((z: any) => z.id === player.currentZoneId);
  if (!currentLoc || !currentLoc.hasRestBed) {
    return {
      success: false,
      error: `There is nowhere to rest in **${currentLoc?.name || 'this area'}**.\n\nTravel to a **settlement or inn** to find a rest bed.\n\n*Settlements with rest beds: Cozy Tavern, Verdant Outpost*`
    };
  }

  // Check 2-minute cooldown
  const now = new Date();
  const existingCooldown = await db.query.cooldowns.findFirst({
    where: and(eq(cooldowns.playerId, player.id), eq(cooldowns.action, 'rest'))
  });

  if (existingCooldown && existingCooldown.expiresAt > now) {
    const remainingMs = existingCooldown.expiresAt.getTime() - now.getTime();
    const remainingSec = Math.ceil(remainingMs / 1000);
    const minutes = Math.floor(remainingSec / 60);
    const seconds = remainingSec % 60;
    const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

    return {
      success: false,
      cooldownRemaining: timeStr,
      error: `You recently rested. You can rest again in **${timeStr}**.`
    };
  }

  // Get player stats for full restore
  const equippedDbItems = await getEquippedItems(player.id);
  const equippedItemsList = equippedDbItems.map((dbItem: any) => {
    const def = itemsCatalog.find((i: any) => i.id === dbItem.itemId);
    return { slot: def?.type || 'accessory', rarity: def?.rarity || 'common', stats: def?.stats || {} };
  });
  const stats = computeStats(player.level, player.prestige, player.playerClass, equippedItemsList, null, []);

  // Restore full stamina, HP, and mana
  await db
    .update(players)
    .set({
      stamina: player.staminaMax,
      hpCurrent: stats.hpMax,
      manaCurrent: stats.manaMax,
      lastStaminaRegen: now
    })
    .where(eq(players.id, player.id));

  // Clear active combat session
  await db.delete(combatSessions).where(eq(combatSessions.playerId, player.id));

  // Upsert 2-minute cooldown
  const expiresAt = new Date(now.getTime() + REST_COOLDOWN_MS);
  if (existingCooldown) {
    await db
      .update(cooldowns)
      .set({ expiresAt })
      .where(and(eq(cooldowns.playerId, player.id), eq(cooldowns.action, 'rest')));
  } else {
    await db
      .insert(cooldowns)
      .values({ playerId: player.id, action: 'rest', expiresAt });
  }

  return {
    success: true,
    locationName: currentLoc.name,
    message: '💤 You slept peacefully. HP, Mana, and Stamina fully restored!'
  };
}
