import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  type StringSelectMenuInteraction
} from 'discord.js';
import { getPlayerWithClampedStats, getAndUpdatePlayerStamina } from '../../database/queries/player.js';
import { getExplorationSessionByPlayerId } from '../../database/queries/exploration.js';
import { getEquippedItems } from '../../database/queries/inventory.js';
import { computeStats } from '../../systems/progression/stats.js';
import { itemsCatalog } from '../../utils/catalog.js';
import { errorEmbed } from '../../utils/embeds.js';
import { renderWorldMapScreen } from '../../systems/exploration/mapRenderer.js';
import { renderDungeonScreen } from '../../systems/exploration/dungeonController.js';
import { db } from '../../database/client.js';
import { combatSessions } from '../../database/schema.js';
import { eq } from 'drizzle-orm';

export { handleMapTravelInteraction, handleWorldMapInteraction, runTavernRest } from '../../systems/exploration/mapRenderer.js';
export { handleDungeonInteraction } from '../../systems/exploration/dungeonController.js';

export const data = new SlashCommandBuilder()
  .setName('map')
  .setDescription('View the world map, travel between regions and locations, and explore.');

export async function execute(interaction: ChatInputCommandInteraction) {
  await runMap(interaction);
}

export async function runMap(
  interaction: ChatInputCommandInteraction | ButtonInteraction | StringSelectMenuInteraction,
  travelMsg?: string,
  overridePlayerId?: string
) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      if (interaction.isButton() || interaction.isStringSelectMenu()) {
        await interaction.deferUpdate();
      } else {
        await interaction.deferReply();
      }
    }

    const discordId = overridePlayerId || interaction.user.id;
    // Load player and ensure stats are clamped, update stamina
    const initialPlayer = await getPlayerWithClampedStats(discordId);
    if (!initialPlayer) {
      const err = errorEmbed('Error', 'Player profile not found. Please complete the /tutorial first.');
      await interaction.editReply({ embeds: [err] });
      return;
    }

    // Refresh stamina passively
    const player = await getAndUpdatePlayerStamina(initialPlayer.id);
    if (!player) {
      const err = errorEmbed('Error', 'Player profile not found.');
      await interaction.editReply({ embeds: [err] });
      return;
    }

    // Check if player is in combat
    const activeSession = await db.query.combatSessions.findFirst({
      where: eq(combatSessions.playerId, player.id),
    });

    if (activeSession) {
      const expiresAt = new Date(activeSession.expiresAt).getTime();
      if (expiresAt > Date.now()) {
        const err = errorEmbed(
          'In Combat',
          '❌ You cannot access the map while you are in combat! Use `/combat fight` to resume the battle or finish/flee it first.'
        );
        await interaction.editReply({ embeds: [err], components: [] });
        return;
      } else {
        // Clean up expired session
        await db.delete(combatSessions).where(eq(combatSessions.id, activeSession.id));
      }
    }

    // Check if player has an active exploration session
    const session = await getExplorationSessionByPlayerId(player.id);

    // Load stats for HP/Mana/Stamina display
    const equippedDbItems = await getEquippedItems(player.id);
    const equippedItemsList = equippedDbItems.map((dbItem) => {
      const def = itemsCatalog.find((i) => i.id === dbItem.itemId);
      return { slot: def?.type || 'accessory', rarity: def?.rarity || 'common', stats: def?.stats || {} };
    });
    const stats = computeStats(player.level, player.prestige, player.playerClass, equippedItemsList, null, []);

    if (session) {
      await renderDungeonScreen(interaction, session, player, stats);
    } else {
      await renderWorldMapScreen(interaction, player, stats, travelMsg);
    }

  } catch (error) {
    console.error('Error displaying world map:', error);
    const err = errorEmbed('Map Error', 'Failed to load the world map.');
    await interaction.editReply({ embeds: [err], components: [] });
  }
}
