import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  MessageFlags,
  type ButtonInteraction,
  type StringSelectMenuInteraction
} from 'discord.js';
import { db } from '../../database/client.js';
import { players } from '../../database/schema.js';
import { eq } from 'drizzle-orm';
import { getPlayerWithClampedStats } from '../../database/queries/player.js';
import { zonesCatalog, itemsCatalog, enemiesCatalog } from '../../utils/catalog.js';
import { errorEmbed } from '../../utils/embeds.js';
import { buildNavId } from '../../utils/navigation.js';
import {
  discoverLocation,
  getPlayerDiscoveredLocations
} from '../../database/queries/worldQueries.js';
import { travelToNode, exploreNode, huntNode } from './worldExplorer.js';
import { executeRest } from './restService.js';
import { createExplorationSession } from '../../database/queries/exploration.js';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export async function renderWorldMapScreen(
  interaction: any,
  player: any,
  stats: any,
  travelMsg?: string
) {
  // Load player's discovered location IDs
  let discoveredLocIds = await getPlayerDiscoveredLocations(player.id);
  if (discoveredLocIds.length === 0) {
    await discoverLocation(player.id, 'cozy_tavern');
    await discoverLocation(player.id, 'oakhaven_square');
    discoveredLocIds = ['cozy_tavern', 'oakhaven_square'];
  }

  const currentLoc = zonesCatalog.find((z) => z.id === player.currentZoneId) || zonesCatalog.find((z) => z.id === 'cozy_tavern')!;

  // Build destination lines for the "Where to Go" section
  let destinationsText = '';
  const connections = currentLoc.connections || [];
  for (const targetId of connections) {
    const targetLoc = zonesCatalog.find((z) => z.id === targetId);
    if (!targetLoc) continue;
    
    const isDiscovered = discoveredLocIds.includes(targetId);
    let typeIcon = '🌲';
    if (targetLoc.type === 'settlement') typeIcon = '🏠';
    else if (targetLoc.isDungeon) typeIcon = '🏰';
    
    const locDisplay = isDiscovered ? targetLoc.name : 'Unknown Path';
    const typeDisplay = isDiscovered ? capitalize(targetLoc.type) : 'Scout to unlock';
    const lvDisplay = `Lv.${targetLoc.minLevel}+`;
    
    destinationsText += `• ${typeIcon} **${locDisplay}**  ·  ${lvDisplay}  ·  ${typeDisplay}\n`;
  }
  if (!destinationsText) destinationsText = '*No connections available.*';

  // Vitals block
  const vitalsText = `🔋 **${player.stamina}/${player.staminaMax}** Stamina   ❤️ **${player.hpCurrent}/${stats.hpMax}** HP   💧 **${player.manaCurrent}/${stats.manaMax}** MP`;

  // Embed Description
  let msgPrefix = '✅ ';
  if (travelMsg && (travelMsg.startsWith('❌') || travelMsg.startsWith('⚠️') || travelMsg.startsWith('💤') || travelMsg.startsWith('ℹ️'))) {
    msgPrefix = '';
  }
  const descriptionText =
    (travelMsg ? `${msgPrefix}**${travelMsg}**\n\n` : '') +
    `**Lv.${currentLoc.minLevel}-${currentLoc.maxLevel}  ·  ${capitalize(currentLoc.type)}  ·  ${currentLoc.region}**\n\n` +
    `*"${currentLoc.description}"*\n\n` +
    `${vitalsText}\n\n` +
    `── **Where to Go** ──\n` +
    destinationsText;

  const embed = new EmbedBuilder()
    .setColor(0x7C3AED)
    .setTitle(`🗺️ ${currentLoc.name}`)
    .setDescription(descriptionText)
    .setFooter({ text: 'Arcanora — 🔎 Explore: 2 Stamina  ⚔️ Hunt: 5 Stamina  🚶 Travel: 1 Stamina' })
    .setTimestamp();

  const components: any[] = [];

  // Row 1: Exploration & Action buttons
  const actionRow = new ActionRowBuilder<ButtonBuilder>();

  // Explore button (items only, 2 stamina)
  actionRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`map_world_explore_${currentLoc.id}_${player.discordId}`)
      .setLabel('Explore')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🔎')
      .setDisabled(player.stamina < 2)
  );

  // Hunt button (combat only, 5 stamina) — only show in zones with enemies
  const hasEnemies = (currentLoc.enemies || []).length > 0;
  if (hasEnemies) {
    actionRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`map_world_hunt_${currentLoc.id}_${player.discordId}`)
        .setLabel('Hunt')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('⚔️')
        .setDisabled(player.stamina < 5)
    );
  }

  // Rest button — only show in zones with a rest bed (settlements/inns)
  if ((currentLoc as any).hasRestBed) {
    actionRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`map_world_rest_${currentLoc.id}_${player.discordId}`)
        .setLabel('Rest')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🛏️')
    );
  }

  // Dungeon solo & co-op entry buttons
  if (currentLoc.isDungeon) {
    actionRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`map_enter_dungeon_${currentLoc.id}_${player.discordId}`)
        .setLabel('Enter Solo')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🏰')
        .setDisabled(player.stamina < 15),
      new ButtonBuilder()
        .setCustomId(`map_world_coop_${currentLoc.id}_${player.discordId}`)
        .setLabel('Create Lobby')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('👥')
    );
  }

  // Inspect button
  actionRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`map_world_inspect_${player.discordId}`)
      .setLabel('Inspect')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔍')
  );

  components.push(actionRow);

  // Row 2: Travel select menu
  const travelOptions = [];
  for (const targetId of connections) {
    const targetLoc = zonesCatalog.find((z) => z.id === targetId);
    if (!targetLoc) continue;
    
    const isDiscovered = discoveredLocIds.includes(targetId);
    const isLocked = player.level < targetLoc.minLevel || !isDiscovered;
    
    let typeEmoji = '🌲';
    if (targetLoc.type === 'settlement') typeEmoji = '🏠';
    else if (targetLoc.isDungeon) typeEmoji = '🏰';
    
    const statusIcon = isLocked ? '🔒' : '➡️';
    const label = `${statusIcon} ${targetLoc.name}`;
    const description = `${typeEmoji} ${targetLoc.type.toUpperCase()} · Lv.${targetLoc.minLevel}+ ${isDiscovered ? '' : '(Undiscovered)'}`;
    
    travelOptions.push({
      label,
      value: targetId,
      description: description.substring(0, 100)
    });
  }

  if (travelOptions.length > 0) {
    const travelSelect = new StringSelectMenuBuilder()
      .setCustomId(`map_world_travel_select_${player.discordId}`)
      .setPlaceholder('🗺️ Travel to another location...')
      .addOptions(travelOptions);
    components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(travelSelect));
  }

  // Row 3: Shortcuts row
  const shortcutsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(buildNavId('player_profile', player.discordId)).setLabel('Profile').setStyle(ButtonStyle.Secondary).setEmoji('👤'),
    new ButtonBuilder().setCustomId(buildNavId('inventory_bag', player.discordId)).setLabel('Bag').setStyle(ButtonStyle.Secondary).setEmoji('🎒'),
    new ButtonBuilder().setCustomId(buildNavId('economy_shop', player.discordId)).setLabel('Shop').setStyle(ButtonStyle.Secondary).setEmoji('🏪'),
    new ButtonBuilder().setCustomId(buildNavId('quest_board', player.discordId)).setLabel('Quests').setStyle(ButtonStyle.Secondary).setEmoji('📜')
  );
  components.push(shortcutsRow);

  await interaction.editReply({
    embeds: [embed],
    components
  });
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
      await interaction.reply({ content: '❌ Player profile not found.', flags: [MessageFlags.Ephemeral] });
      return;
    }

    const targetZone = zonesCatalog.find((z) => z.id === targetZoneId);
    if (!targetZone) {
      await interaction.reply({ content: '❌ Destination location does not exist.', flags: [MessageFlags.Ephemeral] });
      return;
    }

    if (player.level < targetZone.minLevel) {
      await interaction.reply({
        content: `❌ You cannot travel to ${targetZone.name}. Required Level: ${targetZone.minLevel}.`,
        flags: [MessageFlags.Ephemeral]
      });
      return;
    }

    await db
      .update(players)
      .set({ currentZoneId: targetZoneId })
      .where(eq(players.id, player.id));

    const { runMap } = await import('../../commands/player/map.js');
    await runMap(interaction as any, `You successfully traveled to the ${targetZone.name}!`);

  } catch (error) {
    console.error('Error executing travel interaction:', error);
    await interaction.reply({ content: '❌ An error occurred during travel.', flags: [MessageFlags.Ephemeral] });
  }
}

export async function runTavernRest(
  interaction: ButtonInteraction | StringSelectMenuInteraction
) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate();
    }

    const result = await executeRest(interaction.user.id);
    const { runMap } = await import('../../commands/player/map.js');
    if (!result.success) {
      await runMap(interaction as any, result.error || 'Failed to rest.');
      return;
    }

    await runMap(interaction as any, result.message || '💤 You slept peacefully. HP, Mana, and Stamina fully restored!');
  } catch (error) {
    console.error('Error resting at tavern:', error);
    const err = errorEmbed('Rest Error', 'Failed to rest at the tavern.');
    await interaction.editReply({ embeds: [err] });
  }
}

export async function handleWorldMapInteraction(
  interaction: ButtonInteraction | StringSelectMenuInteraction
) {
  const customId = interaction.customId;
  const parts = customId.split('_'); // map_world_action_...
  const userId = parts[parts.length - 1];

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: '❌ This map interface is not yours!',
      flags: [MessageFlags.Ephemeral]
    });
    return;
  }

  await interaction.deferUpdate();

  try {
    const player = await getPlayerWithClampedStats(interaction.user.id);
    if (!player) return;

    const { runMap } = await import('../../commands/player/map.js');

    if (customId.startsWith('map_world_travel_select_')) {
      const selectMenu = interaction as StringSelectMenuInteraction;
      const targetLocationId = selectMenu.values[0]!;
      const targetLoc = zonesCatalog.find((z) => z.id === targetLocationId);
      if (!targetLoc) return;

      let discoveredLocIds = await getPlayerDiscoveredLocations(player.id);
      if (discoveredLocIds.length === 0) {
        discoveredLocIds = ['cozy_tavern', 'oakhaven_square'];
      }

      const isDiscovered = discoveredLocIds.includes(targetLocationId);
      const levelLocked = player.level < targetLoc.minLevel;
      const lockReason = !isDiscovered 
        ? 'This location is hidden. You must discover it first by exploring adjacent nodes.' 
        : levelLocked 
          ? `Your level is too low. Required: Level ${targetLoc.minLevel}.`
          : player.stamina < 1
            ? 'You do not have enough stamina (1 required).'
            : null;

      const isLocked = !!lockReason;

      let typeEmoji = '🌲';
      if (targetLoc.type === 'settlement') typeEmoji = '🏠';
      else if (targetLoc.isDungeon) typeEmoji = '🏰';

      const previewEmbed = new EmbedBuilder()
        .setColor(isLocked ? 0xEF4444 : 0x10B981)
        .setTitle(`🗺️ Travel Preview: ${targetLoc.name}`)
        .setDescription(
          `**Type**: ${typeEmoji} ${capitalize(targetLoc.type)}\n` +
          `**Region**: ${targetLoc.region} | **Area**: ${targetLoc.area}\n` +
          `**Level Requirement**: Lv.${targetLoc.minLevel}-${targetLoc.maxLevel}\n\n` +
          `*"${targetLoc.description}"*\n\n` +
          `🔋 **Stamina Cost**: 1 Stamina\n` +
          (isLocked ? `\n⚠️ **Cannot Travel**: ${lockReason}` : '')
        )
        .setFooter({ text: 'Confirm travel below' })
        .setTimestamp();

      const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`map_world_travel_confirm_${targetLocationId}_${player.discordId}`)
          .setLabel('Confirm Travel')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅')
          .setDisabled(isLocked),
        new ButtonBuilder()
          .setCustomId(`map_world_travel_cancel_${player.discordId}`)
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('❌')
      );

      await interaction.editReply({
        embeds: [previewEmbed],
        components: [confirmRow]
      });
      return;
    }

    if (customId.startsWith('map_world_travel_confirm_')) {
      const targetLocationId = parts.slice(4, -1).join('_');
      const targetLoc = zonesCatalog.find(z => z.id === targetLocationId);
      
      try {
        await travelToNode(player.id, targetLocationId);
        await runMap(interaction as any, `You traveled to **${targetLoc?.name || targetLocationId}**.`);
      } catch (err: any) {
        await interaction.followUp({ content: `❌ Travel failed: ${err.message || err}`, flags: [MessageFlags.Ephemeral] });
        await runMap(interaction as any);
      }
      return;
    }

    if (customId.startsWith('map_world_travel_cancel_')) {
      await runMap(interaction as any);
      return;
    }

    if (customId.startsWith('map_world_inspect_')) {
      const currentLoc = zonesCatalog.find((z) => z.id === player.currentZoneId) || zonesCatalog.find((z) => z.id === 'cozy_tavern')!;
      
      const inspectEmbed = new EmbedBuilder()
        .setColor(0x7C3AED)
        .setTitle(`🔍 Inspect Location: ${currentLoc.name}`)
        .setDescription(
          `**Region**: ${currentLoc.region} | **Area**: ${currentLoc.area} | **Type**: ${currentLoc.type.toUpperCase()}\n\n` +
          `*"${currentLoc.description}"*\n\n` +
          `📍 **Visual Theme:**\n${currentLoc.visualTheme || 'Unknown'}\n\n` +
          `🌿 **Ecosystem:**\n` +
          `• ☀️ Weather: ${currentLoc.ecosystem?.weather || 'Mild'}\n` +
          `• 📦 Resources: ${currentLoc.ecosystem?.resources?.map((rId: string) => itemsCatalog.find((i) => i.id === rId)?.name || rId).join(', ') || 'None'}\n` +
          `• 👾 Creatures: ${currentLoc.ecosystem?.creatures?.map((cId: string) => {
            const def = enemiesCatalog.find((e) => e.id === cId);
            return def ? `${def.name} (Lv.${def.level})` : cId;
          }).join(', ') || 'None'}`
        )
        .addFields(
          {
            name: '📜 History & Lore',
            value:
              `• *Why built:* ${currentLoc.history?.createdWhy || 'Unknown'}\n` +
              `• *Settler/Builder:* ${currentLoc.history?.builtWho || 'Unknown'}\n` +
              `• *Major event:* ${currentLoc.history?.majorEvents || 'None'}\n` +
              `• *Current conflict:* ${currentLoc.history?.currentConflicts || 'None'}`,
            inline: false
          },
          {
            name: '👥 Social Presence',
            value:
              `• NPCs: ${currentLoc.social?.npcs?.map((n: any) => `**${n.name}** (${n.role})`).join(', ') || 'None'}\n` +
              `• Factions: ${currentLoc.social?.factions?.join(', ') || 'None'}`,
            inline: false
          }
        )
        .setFooter({ text: 'Arcanora — Location Details' })
        .setTimestamp();

      const components: any[] = [];
      const npcs = currentLoc.social?.npcs || [];
      if (npcs.length > 0) {
        const npcSelect = new StringSelectMenuBuilder()
          .setCustomId(`map_world_npc_${player.discordId}`)
          .setPlaceholder('💬 Talk to a local resident...')
          .addOptions(
            npcs.map((n: any) => ({
              label: n.name,
              value: n.id,
              description: n.role
            }))
          );
        components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(npcSelect));
      }

      await interaction.followUp({
        embeds: [inspectEmbed],
        components,
        flags: [MessageFlags.Ephemeral]
      });
      return;
    }

    if (customId.startsWith('map_world_travel_')) {
      const targetLocationId = parts.slice(3, -1).join('_');
      await travelToNode(player.id, targetLocationId);
      const targetLoc = zonesCatalog.find(z => z.id === targetLocationId);
      await runMap(interaction as any, `You traveled to **${targetLoc?.name || targetLocationId}**.`);
      return;
    }

    if (customId.startsWith('map_world_explore_')) {
      try {
        const locationId = parts.slice(3, -1).join('_');
        const result = await exploreNode(player.id, locationId);
        await runMap(interaction as any, result.message);
      } catch (err: any) {
        await interaction.followUp({ content: `❌ ${err.message || err}`, flags: [MessageFlags.Ephemeral] });
        await runMap(interaction as any);
      }
      return;
    }

    if (customId.startsWith('map_world_hunt_')) {
      try {
        const locationId = parts.slice(3, -1).join('_');
        await huntNode(player.id, locationId);
        const { runFight } = await import('../../commands/combat/combat.js');
        await runFight(interaction as any);
      } catch (err: any) {
        await interaction.followUp({ content: `❌ ${err.message || err}`, flags: [MessageFlags.Ephemeral] });
        await runMap(interaction as any);
      }
      return;
    }

    if (customId.startsWith('map_world_npc_')) {
      const selectMenu = interaction as StringSelectMenuInteraction;
      const npcId = selectMenu.values[0]!;
      const currentLoc = zonesCatalog.find(z => z.id === player.currentZoneId)!;
      const npc = currentLoc.social?.npcs?.find((n: any) => n.id === npcId);
      
      if (npc && npc.dialogue.length > 0) {
        const line = npc.dialogue[Math.floor(Math.random() * npc.dialogue.length)]!;
        const embed = new EmbedBuilder()
          .setColor(0x3B82F6)
          .setTitle(`💬 ${npc.name}`)
          .setDescription(`*"${line}"*`);
        await interaction.followUp({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
      }
      return;
    }

    if (customId.startsWith('map_world_rest_')) {
      const locationId = parts.slice(3, -1).join('_');
      if (player.currentZoneId !== locationId) {
        await interaction.followUp({ content: '❌ Location mismatch. You are not at the expected location.', flags: [MessageFlags.Ephemeral] });
        await runMap(interaction as any);
        return;
      }
      await runTavernRest(interaction as any);
      return;
    }

    if (customId.startsWith('map_world_coop_')) {
      const zoneId = parts.slice(3, -1).join('_');
      await createExplorationSession({
        playerId: player.id,
        channelId: interaction.channelId || '',
        zoneId,
        currentNodeId: 'lobby',
        party: {
          leaderId: player.id,
          members: [{ playerId: player.id, username: player.username, level: player.level }]
        },
        mapState: { lobbyOpen: true }
      });
      await runMap(interaction as any, `Created co-op lobby for ${zoneId}!`);
      return;
    }

  } catch (err: any) {
    console.error('Error handling world map interaction:', err);
    await interaction.followUp({ content: `❌ Error: ${err.message || err}`, flags: [MessageFlags.Ephemeral] });
  }
}
