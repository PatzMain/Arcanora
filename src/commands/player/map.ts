import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  type StringSelectMenuInteraction
} from 'discord.js';
import { db } from '../../database/client.js';
import { players } from '../../database/schema.js';
import { eq } from 'drizzle-orm';
import { getPlayerWithClampedStats } from '../../database/queries/player.js';
import { zonesCatalog } from '../../utils/catalog.js';
import { errorEmbed } from '../../utils/embeds.js';
import { buildNavId } from '../../utils/navigation.js';

export const data = new SlashCommandBuilder()
  .setName('map')
  .setDescription('View the world map, travel between zones, and explore.');

export async function execute(interaction: ChatInputCommandInteraction) {
  await runMap(interaction);
}

export async function runMap(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  travelMsg?: string
) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      if (interaction.isButton() || interaction.isStringSelectMenu()) {
        await interaction.deferUpdate();
      } else {
        await interaction.deferReply();
      }
    }

    const discordId = interaction.user.id;
    // Load player and ensure stats are clamped
    const player = await getPlayerWithClampedStats(discordId);
    if (!player) {
      const err = errorEmbed('Error', 'Player profile not found. Please complete the /tutorial first.');
      await interaction.editReply({ embeds: [err] });
      return;
    }

    const currentZoneId = player.currentZoneId || 'verdant_meadows';
    const currentZone = zonesCatalog.find(z => z.id === currentZoneId);

    // Build the Map Embed
    const embed = new EmbedBuilder()
      .setColor(0x7C3AED) // Premium purple theme
      .setTitle('🗺️ Arcanora World Map')
      .setDescription(
        (travelMsg ? `✅ **${travelMsg}**\n\n` : '') +
        'Select an unlocked destination from the dropdown to travel, or click **Explore** to start an encounter in your current location.'
      )
      .setFooter({ text: 'Arcanora — Travel and Exploration' })
      .setTimestamp();

    // Emojis for each zone
    const zoneEmojis: Record<string, string> = {
      verdant_meadows: '🌿',
      shadow_forest: '🌲',
      crystal_caverns: '💎',
      volcanic_wastes: '🌋',
      abyssal_depths: '🌊'
    };

    zonesCatalog.forEach((zone) => {
      const isCurrent = zone.id === currentZoneId;
      const isUnlocked = player.level >= zone.minLevel;
      const emoji = zoneEmojis[zone.id] || '📍';

      // Add field details for each zone
      let statusText = '';
      if (isCurrent) {
        statusText = '📍 **You are currently here**';
      } else if (!isUnlocked) {
        statusText = `🔒 *Locked (Requires Lv. ${zone.minLevel})*`;
      } else {
        statusText = `🚗 *Available to Travel (Lv. ${zone.minLevel}-${zone.maxLevel})*`;
      }

      embed.addFields({
        name: `${emoji} ${zone.name} (Lv. ${zone.minLevel}-${zone.maxLevel})`,
        value: `${zone.description}\n${statusText}`,
        inline: false
      });
    });

    const components: any[] = [];

    // 1. Explore button for current zone
    if (currentZone) {
      const exploreBtn = new ButtonBuilder()
        .setCustomId(buildNavId('combat_explore', player.discordId, currentZone.id))
        .setLabel(`Explore ${currentZone.name}`)
        .setStyle(ButtonStyle.Success)
        .setEmoji('⚔️');
      
      const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(exploreBtn);
      components.push(btnRow);
    }

    // 2. Select menu for travel options
    const travelOptions = zonesCatalog
      .filter((zone) => zone.id !== currentZoneId)
      .map((zone) => {
        const isUnlocked = player.level >= zone.minLevel;
        const emoji = zoneEmojis[zone.id] || '📍';
        return {
          label: zone.name,
          value: zone.id,
          description: isUnlocked ? `Travel to ${zone.name} (Lv. ${zone.minLevel})` : `Locked - Requires Level ${zone.minLevel}`,
          emoji: isUnlocked ? emoji : '🔒',
        };
      });

    if (travelOptions.length > 0) {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`map_travel_select_${player.discordId}`)
        .setPlaceholder('🗺️ Choose a destination to travel...')
        .addOptions(travelOptions);
      
      const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
      components.push(selectRow);
    }

    await interaction.editReply({
      embeds: [embed],
      components
    });

  } catch (error) {
    console.error('Error displaying world map:', error);
    const err = errorEmbed('Map Error', 'Failed to load the world map.');
    await interaction.editReply({ embeds: [err], components: [] });
  }
}

export async function handleMapTravelInteraction(interaction: ButtonInteraction | StringSelectMenuInteraction) {
  let targetZoneId = '';
  let userId = '';

  if (interaction.isStringSelectMenu()) {
    const parts = interaction.customId.split('_'); // map_travel_select_{userId}
    userId = parts[3] || '';
    targetZoneId = interaction.values[0]!;
  } else {
    // Custom ID format: map_travel_{zoneId}_{userId}
    const lastUnderscoreIndex = interaction.customId.lastIndexOf('_');
    userId = interaction.customId.substring(lastUnderscoreIndex + 1);
    targetZoneId = interaction.customId.substring(11, lastUnderscoreIndex);
  }

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: '❌ This map interface is not yours!',
      flags: [MessageFlags.Ephemeral]
    });
    return;
  }

  try {
    const player = await getPlayerWithClampedStats(interaction.user.id);
    if (!player) {
      await interaction.reply({
        content: '❌ Player profile not found.',
        flags: [MessageFlags.Ephemeral]
      });
      return;
    }

    const targetZone = zonesCatalog.find((z) => z.id === targetZoneId);
    if (!targetZone) {
      await interaction.reply({
        content: '❌ Destination zone does not exist.',
        flags: [MessageFlags.Ephemeral]
      });
      return;
    }

    // Check level gate
    if (player.level < targetZone.minLevel) {
      await interaction.reply({
        content: `❌ You cannot travel to ${targetZone.name}. Required Level: ${targetZone.minLevel}.`,
        flags: [MessageFlags.Ephemeral]
      });
      return;
    }

    // Update database
    await db
      .update(players)
      .set({ currentZoneId: targetZoneId })
      .where(eq(players.id, player.id));

    // Re-render map with a success header
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
      await runMap(interaction as any, `You successfully traveled to the ${targetZone.name}!`);
    } else {
      await runMap(interaction as any, `You successfully traveled to the ${targetZone.name}!`);
    }

  } catch (error) {
    console.error('Error executing travel interaction:', error);
    await interaction.reply({
      content: '❌ An error occurred during travel.',
      flags: [MessageFlags.Ephemeral]
    });
  }
}
