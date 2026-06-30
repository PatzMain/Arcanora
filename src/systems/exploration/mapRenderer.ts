import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  MessageFlags,
  AttachmentBuilder,
  type ButtonInteraction,
  type StringSelectMenuInteraction
} from 'discord.js';
import { db } from '../../database/client.js';
import { players } from '../../database/schema.js';
import { eq } from 'drizzle-orm';
import { getPlayerWithClampedStats } from '../../database/queries/player.js';
import { zonesCatalog, itemsCatalog, enemiesCatalog, questsCatalog } from '../../utils/catalog.js';
import { errorEmbed, COLORS, baseEmbed } from '../../utils/embeds.js';
import { buildNavId } from '../../utils/navigation.js';
import { renderWorldMap } from '../../utils/mapVisual.js';
import { renderMapImage } from '../../utils/mapCanvas.js';
import {
  discoverLocation,
  getPlayerDiscoveredLocations
} from '../../database/queries/worldQueries.js';
import { getActiveQuests } from '../../database/queries/quest.js';
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
  // Load player's discovered location IDs and auto-discover all starter town locations
  const starterTownLocs = ['cozy_tavern', 'oakhaven_square', 'river_docks', 'oakhaven_forge', 'apothecary'];
  const discoveredLocIds = await getPlayerDiscoveredLocations(player.id);
  const missingStarterLocs = starterTownLocs.filter((locId) => !discoveredLocIds.includes(locId));
  if (missingStarterLocs.length > 0) {
    for (const locId of missingStarterLocs) {
      await discoverLocation(player.id, locId);
      discoveredLocIds.push(locId);
    }
  }

  const currentLoc = zonesCatalog.find((z) => z.id === player.currentZoneId) || zonesCatalog.find((z) => z.id === 'cozy_tavern')!;

  // Auto-discover current location and its connections to prevent any travel locking
  if (!discoveredLocIds.includes(currentLoc.id)) {
    await discoverLocation(player.id, currentLoc.id);
    discoveredLocIds.push(currentLoc.id);
  }
  for (const connId of currentLoc.connections || []) {
    if (!discoveredLocIds.includes(connId)) {
      await discoverLocation(player.id, connId);
      discoveredLocIds.push(connId);
    }
  }

  // Synchronize codex locations
  const { discoverLocation: discoverCodexLocation } = await import('../../database/queries/codex.js');
  for (const locId of discoveredLocIds) {
    await discoverCodexLocation(player.id, locId);
  }

  // Build destination lines for the "Where to Go" section
  let destinationsText = '';
  const connections = currentLoc.connections || [];
  for (const targetId of connections) {
    const targetLoc = zonesCatalog.find((z) => z.id === targetId);
    if (!targetLoc) continue;
    
    const isDiscovered = discoveredLocIds.includes(targetId);
    const levelLocked = player.level < targetLoc.minLevel;
    
    let typeIcon = '🌲';
    if (targetLoc.type === 'settlement') typeIcon = '🏠';
    else if (targetLoc.isDungeon) typeIcon = '🏰';
    
    if (!isDiscovered) {
      destinationsText += `• 🔒 ~~*${targetLoc.name}*~~  ·  *(Explore ${currentLoc.name} to discover)*\n`;
    } else if (levelLocked) {
      destinationsText += `• 🔒 ~~*${targetLoc.name}*~~  ·  *(Requires Level ${targetLoc.minLevel})*\n`;
    } else {
      let typeLabel = capitalize(targetLoc.type);
      if (targetLoc.type === 'settlement') typeLabel = 'Town';
      else if (targetLoc.type === 'combat') typeLabel = 'Wilderness';
      destinationsText += `• ${typeIcon} **${targetLoc.name}**  ·  Lv.${targetLoc.minLevel}+  ·  ${typeLabel}\n`;
    }
  }
  if (!destinationsText) destinationsText = '*No connections available.*';

  // Vitals block
  const compactVitals = `❤️ **HP** ${player.hpCurrent}/${stats.hpMax}   💧 **MP** ${player.manaCurrent}/${stats.manaMax}   🔋 **ST** ${player.stamina}/${player.staminaMax}`;

  // Embed Description
  let msgPrefix = '✅ ';
  if (travelMsg && (travelMsg.startsWith('❌') || travelMsg.startsWith('⚠️') || travelMsg.startsWith('💤') || travelMsg.startsWith('ℹ️'))) {
    msgPrefix = '';
  }
  const statusLine = travelMsg ? `${msgPrefix}**${travelMsg}**\n\n` : '';
  const embedDescription = `${statusLine}*"${currentLoc.description.split('\n')[0]}"*\n\n${compactVitals}`;

  // Build guidance dynamically
  let guidanceLine = 'Travel to new zones, take on quests, and hunt monsters to grow stronger!';
  const hpPct = player.hpCurrent / stats.hpMax;

  const activeQuests = await getActiveQuests(player.id);
  if (hpPct < 0.3 || player.stamina < 5) {
    guidanceLine = '⚠️ Vitals Low! Travel to Cozy Tavern to Rest and recover.';
  } else if (activeQuests.length > 0) {
    const activeQ = activeQuests[0]!;
    const qDef = questsCatalog.find((qc) => qc.id === activeQ.questId);
    if (qDef) {
      const progressObj = activeQ.progress as Record<string, number> || {};
      let conditionText = '';
      for (const cond of qDef.conditions || []) {
        const currentCount = progressObj[cond.target] || 0;
        const needed = cond.required;
        if (currentCount < needed) {
          if (cond.type === 'kill') {
            const enemyName = enemiesCatalog.find((e) => e.id === cond.target)?.name || cond.target;
            conditionText = `Defeat ${enemyName} (${currentCount}/${needed})`;
          } else if (cond.type === 'gather') {
            const itemDef = itemsCatalog.find((i) => i.id === cond.target);
            const itemName = itemDef?.name || cond.target;
            conditionText = `Gather ${itemName} (${currentCount}/${needed})`;
          } else if (cond.type === 'explore') {
            const targetLoc = zonesCatalog.find((z) => z.id === cond.target);
            conditionText = `Travel to ${targetLoc ? targetLoc.name : cond.target}`;
          }
          break;
        }
      }
      if (conditionText) {
        guidanceLine = (qDef as any).narrative?.hint
          ? `📜 **${qDef.name}**: ${(qDef as any).narrative.hint}`
          : `📜 **${qDef.name}**: ${conditionText}`;
      } else {
        guidanceLine = `📜 **${qDef.name}**: Ready to turn in!`;
      }
    }
  } else {
    if (currentLoc.id !== 'oakhaven_square') {
      guidanceLine = '🧭 Travel to Oakhaven Square and check the Quest Board!';
    } else {
      guidanceLine = '🧭 Check the Quest Board here to accept a new quest!';
    }
  }

  const embed = baseEmbed()
    .setColor(COLORS.EXPLORATION)
    .setTitle(`📍 ${currentLoc.name}`)
    .setDescription(embedDescription);

  let mapAttachment: AttachmentBuilder | null = null;
  const mapBuffer = await renderMapImage(player.currentZoneId, discoveredLocIds, player.id);
  if (mapBuffer) {
    mapAttachment = new AttachmentBuilder(mapBuffer, { name: 'map.png' });
    embed.setImage('attachment://map.png');
  } else {
    const asciiMap = renderWorldMap(player.currentZoneId, discoveredLocIds);
    embed.addFields({
      name: '🗺️ World Map',
      value: `\`\`\`\n${asciiMap}\n\`\`\``,
      inline: false
    });
  }

  if (destinationsText) {
    embed.addFields({
      name: '🧭 Nearby Destinations',
      value: destinationsText.trim(),
      inline: false
    });
  }

  embed.addFields({
    name: '📜 Guidance',
    value: guidanceLine,
    inline: false
  });

  const resources = currentLoc.ecosystem?.resources || [];
  const isDocks = currentLoc.id === 'river_docks';
  const isRiver = currentLoc.id === 'silverbrook_river';
  const hasFish = resources.some((r: string) => r.startsWith('fish_'));

  const components: any[] = [];

  // Row 1: Exploration & Action buttons
  const actionRow = new ActionRowBuilder<ButtonBuilder>();

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

  // Gather button — only show if zone has resources
  if (resources.length > 0) {
    const isWoodOnly = resources.length === 1 && resources[0] === 'mat_wood';
    const isWoodPrimary = resources.includes('mat_wood') && !resources.some((r: string) => r.includes('ore'));
    const gatherEmoji = (isWoodOnly || isWoodPrimary) ? '🪓' : '⛏️';
    actionRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`map_world_gather_${currentLoc.id}_${player.discordId}`)
        .setLabel('Gather')
        .setStyle(ButtonStyle.Success)
        .setEmoji(gatherEmoji)
        .setDisabled(player.stamina < 2)
    );
  }

  // Fish button — only show if zone is river_docks, silverbrook_river, or has fish resources
  if (isDocks || isRiver || hasFish) {
    actionRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`map_world_fish_${currentLoc.id}_${player.discordId}`)
        .setLabel('Fish')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎣')
        .setDisabled(player.stamina < 3)
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
    let typeLabel = targetLoc.type.toUpperCase();
    if (targetLoc.type === 'settlement') typeLabel = 'TOWN';
    else if (targetLoc.type === 'combat') typeLabel = 'WILDERNESS';
    const description = `${typeEmoji} ${typeLabel} · Lv.${targetLoc.minLevel}+ ${isDiscovered ? '' : '(Undiscovered)'}`;
    
    travelOptions.push({
      label,
      value: targetId,
      description: description.substring(0, 100)
    });
  }

  if (travelOptions.length > 0) {
    if (travelOptions.length <= 2) {
      const travelButtonsRow = new ActionRowBuilder<ButtonBuilder>();
      for (const opt of travelOptions) {
        const targetLoc = zonesCatalog.find((z) => z.id === opt.value)!;
        const isLocked = player.level < targetLoc.minLevel;
        
        let typeEmoji = '🌲';
        if (targetLoc.type === 'settlement') typeEmoji = '🏠';
        else if (targetLoc.isDungeon) typeEmoji = '🏰';
        
        const button = new ButtonBuilder()
          .setCustomId(`map_world_travel_${opt.value}_${player.discordId}`)
          .setLabel(`Travel to ${targetLoc.name}`)
          .setEmoji(typeEmoji)
          .setStyle(ButtonStyle.Primary)
          .setDisabled(isLocked);
        travelButtonsRow.addComponents(button);
      }
      components.push(travelButtonsRow);
    } else {
      const travelSelect = new StringSelectMenuBuilder()
        .setCustomId(`map_world_travel_select_${player.discordId}`)
        .setPlaceholder('🗺️ Travel to another location...')
        .addOptions(travelOptions);
      components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(travelSelect));
    }
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
    components,
    files: mapAttachment ? [mapAttachment] : []
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

      const discoveredLocIds = await getPlayerDiscoveredLocations(player.id);
      const isDiscovered = discoveredLocIds.includes(targetLocationId);
      const levelLocked = player.level < targetLoc.minLevel;

      if (!isDiscovered) {
        await runMap(interaction as any, `⚠️ Travel failed: **${targetLoc.name}** is hidden. Explore adjacent areas to discover it.`);
        return;
      }
      if (levelLocked) {
        await runMap(interaction as any, `⚠️ Travel failed: You need to be **Level ${targetLoc.minLevel}** to enter **${targetLoc.name}**.`);
        return;
      }

      try {
        await travelToNode(player.id, targetLocationId);
        const arrivalText = (targetLoc as any).arrivalText ? `\n*"${(targetLoc as any).arrivalText}"*` : '';
        await runMap(interaction as any, `You traveled to **${targetLoc.name}**.${arrivalText}`);
      } catch (err: any) {
        await runMap(interaction as any, `❌ Travel failed: ${err.message || err}`);
      }
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
      const arrivalText = (targetLoc as any)?.arrivalText ? `\n*"${(targetLoc as any).arrivalText}"*` : '';
      await runMap(interaction as any, `You traveled to **${targetLoc?.name || targetLocationId}**.${arrivalText}`);
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

    if (customId.startsWith('map_world_gather_')) {
      try {
        const { executeGather } = await import('../../commands/combat/gather.js');
        const result = await executeGather(player.id, interaction);
        await runMap(interaction as any, result.message);
      } catch (err: any) {
        await interaction.followUp({ content: `❌ ${err.message || err}`, flags: [MessageFlags.Ephemeral] });
        await runMap(interaction as any);
      }
      return;
    }

    if (customId.startsWith('map_world_fish_')) {
      try {
        const { executeFish } = await import('../../commands/combat/fish.js');
        const result = await executeFish(player.id, interaction);
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
