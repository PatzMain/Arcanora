import {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
  type ChatInputCommandInteraction
} from 'discord.js';
import { eq, and } from 'drizzle-orm';
import { db } from '../../database/client.js';
import { players, cooldowns } from '../../database/schema.js';
import { getPlayerWithClampedStats, getAndUpdatePlayerStamina } from '../../database/queries/player.js';
import { getEquippedItems } from '../../database/queries/inventory.js';
import { computeStats } from '../../systems/progression/stats.js';
import { zonesCatalog, itemsCatalog } from '../../utils/catalog.js';
import { errorEmbed } from '../../utils/embeds.js';

const REST_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes

export const data = new SlashCommandBuilder()
  .setName('rest')
  .setDescription('Rest at a nearby inn or settlement to fully restore your stamina.');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    const player = await getAndUpdatePlayerStamina(interaction.user.id);
    if (!player) {
      const err = errorEmbed('Error', 'Player profile not found. Please complete the /tutorial first.');
      await interaction.editReply({ embeds: [err] });
      return;
    }

    // Check current zone has a rest bed
    const currentLoc = zonesCatalog.find(z => z.id === player.currentZoneId);
    if (!currentLoc || !currentLoc.hasRestBed) {
      const err = errorEmbed(
        'No Rest Bed Here',
        `There is nowhere to rest in **${currentLoc?.name || 'this area'}**.\n\nTravel to a **settlement or inn** to find a rest bed.\n\n*Settlements with rest beds: Cozy Tavern, Verdant Outpost*`
      );
      await interaction.editReply({ embeds: [err] });
      return;
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

      const err = errorEmbed(
        'Still Resting',
        `You recently rested. You can rest again in **${timeStr}**.`
      );
      await interaction.editReply({ embeds: [err] });
      return;
    }

    // Get player stats for full restore
    const equippedDbItems = await getEquippedItems(player.id);
    const equippedItemsList = equippedDbItems.map((dbItem) => {
      const def = itemsCatalog.find((i) => i.id === dbItem.itemId);
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

    const embed = new EmbedBuilder()
      .setColor(0x10B981)
      .setTitle(`Rested at ${currentLoc.name}`)
      .setDescription(
        `You settle into a comfortable bed at **${currentLoc.name}** and wake up fully refreshed.\n\n` +
        `HP restored to **${stats.hpMax}/${stats.hpMax}**\n` +
        `Mana restored to **${stats.manaMax}/${stats.manaMax}**\n` +
        `Stamina restored to **${player.staminaMax}/${player.staminaMax}**`
      )
      .setFooter({ text: 'Arcanora — You can rest again in 2 minutes' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Error executing /rest:', error);
    const err = errorEmbed('Rest Error', 'Something went wrong while resting.');
    await interaction.editReply({ embeds: [err] });
  }
}
