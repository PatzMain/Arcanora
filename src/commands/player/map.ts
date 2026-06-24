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
import { players, combatSessions } from '../../database/schema.js';
import { eq } from 'drizzle-orm';
import { getPlayerWithClampedStats } from '../../database/queries/player.js';
import { getEquippedItems } from '../../database/queries/inventory.js';
import { computeStats } from '../../systems/progression/stats.js';
import { zonesCatalog, itemsCatalog } from '../../utils/catalog.js';
import { errorEmbed } from '../../utils/embeds.js';
import { buildNavId } from '../../utils/navigation.js';

export const data = new SlashCommandBuilder()
  .setName('map')
  .setDescription('View the world map, travel between regions and locations, and explore.');

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
        'Select an unlocked destination to travel, or select an interaction under your current location.'
      )
      .setFooter({ text: 'Arcanora — Travel and Exploration' })
      .setTimestamp();

    // Emojis for each location
    const zoneEmojis: Record<string, string> = {
      cozy_tavern: '🛌',
      verdant_meadows: '🌿',
      shadow_forest: '🌲',
      goblin_sanctuary: '🏰',
      crystal_caverns: '💎',
      ancient_mine: '🏰',
      volcanic_wastes: '🌋',
      lava_keep: '🏰',
      abyssal_depths: '🌊',
      sunken_temple: '🏰'
    };

    // Group locations by region
    const regions: Record<string, typeof zonesCatalog> = {};
    zonesCatalog.forEach((zone) => {
      const reg = zone.region || 'The Whispering Wilds';
      if (!regions[reg]) {
        regions[reg] = [];
      }
      regions[reg].push(zone);
    });

    const regionOrder = [
      'The Whispering Wilds',
      'The Subterranean Core',
      'The Infernal Peaks',
      'The Sunken Abysses'
    ];

    for (const rName of regionOrder) {
      const locs = regions[rName];
      if (!locs || locs.length === 0) continue;

      let locsText = '';
      for (const loc of locs) {
        const isCurrent = loc.id === currentZoneId;
        const isUnlocked = player.level >= loc.minLevel;
        const emoji = loc.isDungeon ? '🏰' : (zoneEmojis[loc.id] || '📍');
        const typeLabel = loc.isDungeon ? 'Dungeon' : 'Location';

        let status = '';
        if (isCurrent) {
          status = '📍 **You are currently here**';
        } else if (!isUnlocked) {
          status = `🔒 *Locked (Requires Lv. ${loc.minLevel})*`;
        } else {
          status = `🚗 *Available to Travel (Lv. ${loc.minLevel}-${loc.maxLevel})*`;
        }

        locsText += `${emoji} **${loc.name}** (Lv. ${loc.minLevel}-${loc.maxLevel}) [${typeLabel}]\n` +
                    `*${loc.description}*\n` +
                    `⤷ ${status}\n\n`;
      }

      embed.addFields({
        name: `✨ ${rName}`,
        value: locsText.trim(),
        inline: false
      });
    }

    const components: any[] = [];

    // 1. Explore/Raid/Rest button for current location
    if (currentZone) {
      const actionRow = new ActionRowBuilder<ButtonBuilder>();
      
      if (currentZone.id === 'cozy_tavern') {
        const restBtn = new ButtonBuilder()
          .setCustomId(buildNavId('tavern_rest', player.discordId))
          .setLabel('Rest & Sleep')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🛌');
        actionRow.addComponents(restBtn);
      } else {
        const exploreBtn = new ButtonBuilder()
          .setCustomId(buildNavId('combat_explore', player.discordId, currentZone.id));
        
        if (currentZone.isDungeon) {
          exploreBtn
            .setLabel(`Raid ${currentZone.name}`)
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🏰');
        } else {
          exploreBtn
            .setLabel(`Explore ${currentZone.name}`)
            .setStyle(ButtonStyle.Success)
            .setEmoji('⚔️');
        }
        actionRow.addComponents(exploreBtn);
      }
      
      components.push(actionRow);
    }

    // 2. Navigation Hub Buttons row
    const navHubRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(buildNavId('player_profile', player.discordId))
        .setLabel('Profile')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('👤'),
      new ButtonBuilder()
        .setCustomId(buildNavId('inventory_bag', player.discordId))
        .setLabel('Bag')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🎒'),
      new ButtonBuilder()
        .setCustomId(buildNavId('economy_shop', player.discordId))
        .setLabel('Shop')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🏪'),
      new ButtonBuilder()
        .setCustomId(buildNavId('quest_board', player.discordId))
        .setLabel('Quests')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📜')
    );
    components.push(navHubRow);

    // 3. Select menu for travel options
    const travelOptions = zonesCatalog
      .filter((zone) => zone.id !== currentZoneId)
      .map((zone) => {
        const isUnlocked = player.level >= zone.minLevel;
        const emoji = zone.isDungeon ? '🏰' : (zoneEmojis[zone.id] || '📍');
        const typeLabel = zone.isDungeon ? 'Dungeon' : 'Location';
        return {
          label: zone.name,
          value: zone.id,
          description: isUnlocked 
            ? `Travel to ${zone.name} (${typeLabel} - Lv. ${zone.minLevel})` 
            : `Locked - Requires Level ${zone.minLevel}`,
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
        content: '❌ Destination location does not exist.',
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

export async function runTavernRest(
  interaction: ButtonInteraction | StringSelectMenuInteraction
) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    }

    const player = await getPlayerWithClampedStats(interaction.user.id);
    if (!player) {
      const err = errorEmbed('Rest Error', 'Player profile not found. Please complete the /tutorial first.');
      await interaction.editReply({ embeds: [err] });
      return;
    }

    // 1. Fetch equipped items and compute player's max stats
    const equippedDbItems = await getEquippedItems(player.id);
    const equippedItemsList = equippedDbItems.map((dbItem) => {
      const def = itemsCatalog.find((i: any) => i.id === dbItem.itemId);
      return { slot: def?.type || 'accessory', rarity: def?.rarity || 'common', stats: def?.stats || {} };
    });

    const stats = computeStats(
      player.level,
      player.prestige,
      player.playerClass,
      equippedItemsList,
      null,
      []
    );

    // 2. Replenish stats in database
    await db
      .update(players)
      .set({
        hpCurrent: stats.hpMax,
        manaCurrent: stats.manaMax
      })
      .where(eq(players.id, player.id));

    // 3. Clear active combat session (this removes any status ailments or active battles)
    await db
      .delete(combatSessions)
      .where(eq(combatSessions.playerId, player.id));

    // 4. Send a success embed
    const embed = new EmbedBuilder()
      .setColor(0x10B981) // Emerald green
      .setTitle('🛌 Cozy Tavern Rest')
      .setDescription(
        `You rent a comfortable room at the **Cozy Tavern** and get a peaceful night of sleep.\n\n` +
        `💖 **HP fully restored**: \`${stats.hpMax}/${stats.hpMax}\`\n` +
        `🧪 **Mana fully restored**: \`${stats.manaMax}/${stats.manaMax}\`\n` +
        `✨ **All status ailments and active combat sessions cleared!**`
      )
      .setFooter({ text: 'Arcanora — Rest & Recovery' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error resting at tavern:', error);
    const err = errorEmbed('Rest Error', 'Failed to rest at the tavern.');
    await interaction.editReply({ embeds: [err] });
  }
}
