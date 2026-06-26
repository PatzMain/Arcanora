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
import { zonesCatalog, itemsCatalog, enemiesCatalog, questsCatalog } from '../../utils/catalog.js';
import { errorEmbed } from '../../utils/embeds.js';
import { buildNavId } from '../../utils/navigation.js';
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
      destinationsText += `• ${typeIcon} **${targetLoc.name}**  ·  Lv.${targetLoc.minLevel}+  ·  ${capitalize(targetLoc.type)}\n`;
    }
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

  const activities = [];
  const resources = currentLoc.ecosystem?.resources || [];
  if (resources.length > 0) {
    const resourceNames = resources.map((rId: string) => itemsCatalog.find((i) => i.id === rId)?.name || rId).join(', ');
    activities.push(`• ⛏️ **Gather** (2 Stamina): Harvest ${resourceNames}`);
  }
  const isDocks = currentLoc.id === 'river_docks';
  const isRiver = currentLoc.id === 'silverbrook_river';
  const hasFish = resources.some((r: string) => r.startsWith('fish_'));
  if (isDocks || isRiver || hasFish) {
    activities.push('• 🎣 **Fish** (3 Stamina): Cast a line into the water');
  }
  if (currentLoc.hasRestBed) {
    activities.push('• 💤 **Rest**: Sleep at the Cozy Tavern to fully restore vitals');
  }

  // Build advice / guide text dynamically
  let adviceText = '';

  const hpPct = player.hpCurrent / stats.hpMax;
  if (hpPct < 0.3 || player.stamina < 5) {
    adviceText += `• 💤 **Vitals Low**: You are low on HP or Stamina! Travel to the **Cozy Tavern** and click the **Rest** button to fully recover your vitals.\n`;
  }

  const activeQuests = await getActiveQuests(player.id);
  if (activeQuests.length > 0) {
    for (const q of activeQuests) {
      const qDef = questsCatalog.find((qc) => qc.id === q.questId);
      if (!qDef) continue;

      const progressObj = q.progress as Record<string, number> || {};
      
      for (const cond of qDef.conditions || []) {
        const currentCount = progressObj[cond.target] || 0;
        const needed = cond.required;
        if (currentCount >= needed) continue;

        if (cond.type === 'kill') {
          const zonesWithCreature = zonesCatalog.filter((z) => (z.enemies || []).includes(cond.target));
          const enemyName = enemiesCatalog.find((e) => e.id === cond.target)?.name || cond.target;
          
          if (zonesWithCreature.some((z) => z.id === currentLoc.id)) {
            adviceText += `• ⚔️ **Quest: ${qDef.name}**: Defeat **${enemyName}** (${currentCount}/${needed}). (Tip: Hunt directly in this area using the **Hunt** button!).\n`;
          } else if (zonesWithCreature.length > 0) {
            adviceText += `• ⚔️ **Quest: ${qDef.name}**: Defeat **${enemyName}** (${currentCount}/${needed}). (Go to: **${zonesWithCreature[0].name}**).\n`;
          } else {
            adviceText += `• ⚔️ **Quest: ${qDef.name}**: Defeat **${enemyName}** (${currentCount}/${needed}).\n`;
          }
        } else if (cond.type === 'gather') {
          const itemDef = itemsCatalog.find((i) => i.id === cond.target);
          const itemName = itemDef?.name || cond.target;
          const zonesWithResource = zonesCatalog.filter((z) => (z.ecosystem?.resources || []).includes(cond.target));
          if (zonesWithResource.some((z) => z.id === currentLoc.id)) {
            adviceText += `• ⛏️ **Quest: ${qDef.name}**: Gather **${itemName}** (${currentCount}/${needed}). (Tip: Gather directly in this area using the **Gather** button!).\n`;
          } else if (zonesWithResource.length > 0) {
            adviceText += `• ⛏️ **Quest: ${qDef.name}**: Gather **${itemName}** (${currentCount}/${needed}). (Go to: **${zonesWithResource[0].name}**).\n`;
          } else {
            adviceText += `• ⛏️ **Quest: ${qDef.name}**: Gather **${itemName}** (${currentCount}/${needed}).\n`;
          }
        } else if (cond.type === 'explore') {
          const targetLoc = zonesCatalog.find((z) => z.id === cond.target);
          if (targetLoc) {
            adviceText += `• 🗺️ **Quest: ${qDef.name}**: Travel to **${targetLoc.name}** to discover it (${currentCount}/${needed}).\n`;
          } else {
            adviceText += `• 🗺️ **Quest: ${qDef.name}**: Travel to location (${currentCount}/${needed}).\n`;
          }
        }
      }
    }
  } else {
    adviceText += `• 📜 **No Active Quests**: Visit the Quest Board (click the **Quests** button below) to accept new quests for XP and gold!\n`;
  }

  const levelLockedConns = [];
  for (const connId of currentLoc.connections || []) {
    const connLoc = zonesCatalog.find((z) => z.id === connId);
    if (connLoc && player.level < connLoc.minLevel) {
      levelLockedConns.push(connLoc);
    }
  }
  if (levelLockedConns.length > 0) {
    const lockedNames = levelLockedConns.map((c) => `${c.name} (Requires Lv.${c.minLevel})`).join(', ');
    adviceText += `• 💪 **Level Up**: Adjacent zones locked by level: ${lockedNames}. (Tip: Grind XP by fighting in the **Oakhaven Sewers** dungeon or **Glittering Meadows**!).\n`;
  } else if (player.level === 1 && currentLoc.id === 'cozy_tavern') {
    adviceText += `• 🗺️ **First Steps**: Travel to the **Town Square** using the Travel menu, then check the Quest Board!\n`;
  }

  if (!adviceText) {
    adviceText = `• 🧭 Travel to new zones, take on quests, and hunt monsters to grow stronger!`;
  }

  const embed = new EmbedBuilder()
    .setColor(0x7C3AED)
    .setTitle(`🗺️ ${currentLoc.name}`)
    .setDescription(descriptionText)
    .setFooter({ text: 'Arcanora — ⚔️ Hunt: 5 Stamina  🚶 Travel: Free' })
    .setTimestamp();

  embed.addFields({
    name: '🧭 Next Steps & Advice',
    value: adviceText,
    inline: false
  });

  if (activities.length > 0) {
    embed.addFields({
      name: '⛏️ Available Activities',
      value: activities.join('\n'),
      inline: false
    });
  }

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
    actionRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`map_world_gather_${currentLoc.id}_${player.discordId}`)
        .setLabel('Gather')
        .setStyle(ButtonStyle.Success)
        .setEmoji('⛏️')
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
        await runMap(interaction as any, `You traveled to **${targetLoc.name}**.`);
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
