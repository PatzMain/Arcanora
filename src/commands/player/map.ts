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
import { players, combatSessions, inventory } from '../../database/schema.js';
import { eq, and } from 'drizzle-orm';
import { getPlayerWithClampedStats, getAndUpdatePlayerStamina, deductPlayerStamina } from '../../database/queries/player.js';
import { getEquippedItems, addItem, removeItem } from '../../database/queries/inventory.js';
import { computeStats } from '../../systems/progression/stats.js';
import { zonesCatalog, itemsCatalog } from '../../utils/catalog.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { buildNavId } from '../../utils/navigation.js';
import { generateDungeonMap, updateFogOfWar } from '../../systems/exploration/dungeonGenerator.js';
import {
  createExplorationSession,
  getExplorationSessionByPlayerId,
  updateExplorationSession,
  deleteExplorationSession
} from '../../database/queries/exploration.js';
import { dungeonNodeRegistry } from '../../systems/exploration/dungeonInteractions.js';

export const data = new SlashCommandBuilder()
  .setName('map')
  .setDescription('View the world map, travel between regions and locations, and explore.');

export async function execute(interaction: ChatInputCommandInteraction) {
  await runMap(interaction);
}

// Draw the text map representation
function drawDungeonMapVisual(mapState: any, currentNodeId: string, previousNodeId: string | null): string {
  const currNode = mapState.nodes[currentNodeId];
  if (!currNode) return 'Unknown Room';

  const getSymbol = (type: string) => {
    switch (type) {
      case 'campsite': return '🏕️';
      case 'treasure': return '🪙';
      case 'merchant': return '🏪';
      case 'puzzle': return '🧩';
      case 'event': return '✨';
      case 'elite': return '⚔️';
      case 'boss': return '☠️';
      default: return '🚪';
    }
  };

  let text = '```\n';
  if (previousNodeId && mapState.nodes[previousNodeId]) {
    const prevNode = mapState.nodes[previousNodeId];
    text += `   [${getSymbol(prevNode.type)} Visited: ${prevNode.name}]\n        │\n`;
  }
  
  text += `📍 YOU: [${getSymbol(currNode.type)} ${currNode.name}]\n`;
  
  const connIds = currNode.connections || [];
  if (connIds.length === 0) {
    text += `        (Final Chamber)\n`;
  } else {
    connIds.forEach((connId: string, idx: number) => {
      const nextNode = mapState.nodes[connId];
      if (nextNode) {
        const isLast = idx === connIds.length - 1;
        const prefix = connIds.length === 1 ? '        └──' : (isLast ? '        └──' : '        ├──');
        if (nextNode.status === 'hidden') {
          text += `${prefix} [❓ Unknown Room]\n`;
        } else {
          text += `${prefix} [${getSymbol(nextNode.type)} ${nextNode.name}]\n`;
        }
      }
    });
  }
  text += '```';
  return text;
}

export async function runMap(
  interaction: ChatInputCommandInteraction | ButtonInteraction | StringSelectMenuInteraction,
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
    // Load player and ensure stats are clamped, update stamina
    let player = await getPlayerWithClampedStats(discordId);
    if (!player) {
      const err = errorEmbed('Error', 'Player profile not found. Please complete the /tutorial first.');
      await interaction.editReply({ embeds: [err] });
      return;
    }

    // Refresh stamina passively
    player = await getAndUpdatePlayerStamina(player.id);

    // Check if player has an active exploration session
    const session = await getExplorationSessionByPlayerId(player.id);

    if (session) {
      let mapState = session.mapState as any;
      if (mapState.lobbyOpen) {
        // Render Co-op Lobby Screen
        const party = session.party as any;
        const zone = zonesCatalog.find(z => z.id === session.zoneId);
        const dungeonName = zone ? zone.name : 'Unknown Dungeon';

        const embed = new EmbedBuilder()
          .setColor(0x3B82F6)
          .setTitle('🏰 Co-op Dungeon Lobby')
          .setDescription(
            `**Dungeon:** ${dungeonName} (Lv. ${zone?.minLevel}-${zone?.maxLevel})\n` +
            `**Leader:** **${party.members[0]?.username || 'Unknown'}**\n\n` +
            `**Party Members (${party.members.length}/4):**\n` +
            party.members.map((m: any, i: number) => `${i + 1}. **${m.username}** (Lv.${m.level})`).join('\n') +
            `\n\n🔋 *All players must have at least 15 Stamina to start the run.*`
          )
          .setFooter({ text: 'Arcanora — Co-op Adventures' })
          .setTimestamp();

        const components: any[] = [];
        const row = new ActionRowBuilder<ButtonBuilder>();

        const isLeader = player.id === session.playerId;
        const isMember = party.members.some((m: any) => m.playerId === player.id);

        if (!isMember && party.members.length < 4) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`dungeon_lobby_join_${session.id}_${player.discordId}`)
              .setLabel('Join Party')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('👥')
          );
        } else if (isMember && !isLeader) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`dungeon_lobby_leave_${session.id}_${player.discordId}`)
              .setLabel('Leave Party')
              .setStyle(ButtonStyle.Danger)
              .setEmoji('🚪')
          );
        }

        if (isLeader) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`dungeon_lobby_start_${session.id}_${player.discordId}`)
              .setLabel('Start Dungeon')
              .setStyle(ButtonStyle.Success)
              .setEmoji('🚀'),
            new ButtonBuilder()
              .setCustomId(`dungeon_lobby_cancel_${session.id}_${player.discordId}`)
              .setLabel('Cancel Lobby')
              .setStyle(ButtonStyle.Danger)
              .setEmoji('❌')
          );
        }

        if (row.components.length > 0) {
          components.push(row);
        }

        await interaction.editReply({
          embeds: [embed],
          components
        });
        return;
      }

      // ──────────────────────────────────────────
      // ACTIVE DUNGEON RUN SCREEN
      // ──────────────────────────────────────────
      mapState = session.mapState as any;
      const currentNodeId = session.currentNodeId;
      const currNode = mapState.nodes[currentNodeId];

      const equippedDbItems = await getEquippedItems(player.id);
      const equippedItemsList = equippedDbItems.map((dbItem) => {
        const def = itemsCatalog.find((i) => i.id === dbItem.itemId);
        return { slot: def?.type || 'accessory', rarity: def?.rarity || 'common', stats: def?.stats || {} };
      });
      const stats = computeStats(player.level, player.prestige, player.playerClass, equippedItemsList, null, []);

      // Build Dungeon Embed
      const embed = new EmbedBuilder()
        .setColor(0x7C3AED) // Premium purple
        .setTitle(`🏰 Dungeon: ${session.zoneId === 'verdant_meadows' ? 'Verdant Outpost' : session.zoneId === 'shadow_forest' ? 'Whispering Canopy' : session.zoneId === 'crystal_caverns' ? 'Glittering Depths' : session.zoneId === 'volcanic_wastes' ? 'Volcanic Wastes' : 'Abyssal Depths'}`)
        .setDescription(
          `🔋 **Stamina**: \`${player.stamina}/${player.staminaMax}\`   ` +
          `❤️ **HP**: \`${player.hpCurrent}/${stats.hpMax}\`   ` +
          `💧 **Mana**: \`${player.manaCurrent}/${stats.manaMax}\`\n\n` +
          `🗺️ **Dungeon Map Layout:**\n${drawDungeonMapVisual(mapState, currentNodeId, session.previousNodeId)}`
        )
        .setFooter({ text: `Current Room: ${currNode.name} | Layer ${currNode.layer + 1} / ${mapState.layersCount}` })
        .setTimestamp();

      const components: any[] = [];

      // Determine if combat must be cleared first
      const isCombat = ['room', 'elite', 'boss'].includes(currNode.type);
      const isCleared = currNode.status === 'cleared' || currNode.status === 'visited';
      const mustFight = isCombat && !isCleared;

      // 1. Movement Row (if not blocked by combat)
      const moveRow = new ActionRowBuilder<ButtonBuilder>();
      const connIds = currNode.connections || [];
      
      connIds.forEach((connId: string) => {
        const nextNode = mapState.nodes[connId];
        if (nextNode) {
          const isHidden = nextNode.status === 'hidden';
          const label = isHidden ? '❓ Unknown Room' : nextNode.name;
          const moveBtn = new ButtonBuilder()
            .setCustomId(`dungeon_move_${connId}_${player.discordId}`)
            .setLabel(`${label} (-10 🔋)`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(mustFight || player.stamina < 10);
          moveRow.addComponents(moveBtn);
        }
      });

      if (connIds.length > 0) {
        components.push(moveRow);
      }

      // 2. Action Row (Node-specific interaction)
      const actionRow = new ActionRowBuilder<ButtonBuilder>();
      let hasAction = false;

      if (currNode.type === 'campsite' && !isCleared) {
        actionRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`dungeon_action_campsite_rest_${player.discordId}`)
            .setLabel('🏕️ Rest & Recover')
            .setStyle(ButtonStyle.Success)
        );
        hasAction = true;
      } else if (currNode.type === 'treasure' && !isCleared) {
        actionRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`dungeon_action_treasure_loot_${player.discordId}`)
            .setLabel('🪙 Open Chest')
            .setStyle(ButtonStyle.Primary)
        );
        hasAction = true;
      } else if (currNode.type === 'merchant') {
        actionRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`dungeon_action_merchant_browse_${player.discordId}`)
            .setLabel('🏪 Browse Wares')
            .setStyle(ButtonStyle.Primary)
        );
        hasAction = true;
      } else if (currNode.type === 'puzzle' && !isCleared) {
        actionRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`dungeon_action_puzzle_solve_${player.discordId}`)
            .setLabel('🧩 Solve Riddle')
            .setStyle(ButtonStyle.Primary)
        );
        hasAction = true;
      } else if (currNode.type === 'event' && !isCleared) {
        actionRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`dungeon_action_event_examine_${player.discordId}`)
            .setLabel('✨ Examine Event')
            .setStyle(ButtonStyle.Primary)
        );
        hasAction = true;
      } else if (isCombat && !isCleared) {
        actionRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`dungeon_action_combat_engage_${player.discordId}`)
            .setLabel('⚔️ Engage Enemy')
            .setStyle(ButtonStyle.Danger)
        );
        hasAction = true;
      }

      if (hasAction) {
        components.push(actionRow);
      }

      // 3. Utility Row
      const utilityRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`dungeon_use_potion_${player.discordId}`)
          .setLabel('🎒 Use Potion')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`dungeon_abandon_${player.discordId}`)
          .setLabel('🚪 Abandon Run')
          .setStyle(ButtonStyle.Danger)
      );
      components.push(utilityRow);

      await interaction.editReply({
        embeds: [embed],
        components
      });
      return;
    }

    // ──────────────────────────────────────────
    // NO ACTIVE SESSION — LOBBY SELECTOR SCREEN
    // ──────────────────────────────────────────
    const embed = new EmbedBuilder()
      .setColor(0x7C3AED)
      .setTitle('🗺️ Arcanora Dungeon Explorer')
      .setDescription(
        (travelMsg ? `✅ **${travelMsg}**\n\n` : '') +
        `🔋 **Current Stamina**: \`${player.stamina}/${player.staminaMax}\`\n\n` +
        'Choose a procedural dungeon to enter. Entering a dungeon costs **15 Stamina**.\n' +
        'Deeper dungeons scale in length, risk, and epic loot drops.'
      )
      .setFooter({ text: 'Arcanora — Travel and Dungeon Crawls' })
      .setTimestamp();

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

    for (const rName of regionOrder) {
      const locs = regions[rName];
      if (!locs || locs.length === 0) continue;

      let locsText = '';
      for (const loc of locs) {
        const isCurrent = loc.id === player.currentZoneId;
        const isUnlocked = player.level >= loc.minLevel;
        const emoji = zoneEmojis[loc.id] || '📍';
        let status = '';
        if (isCurrent) {
          status = '📍 **Current Location**';
        } else if (!isUnlocked) {
          status = `🔒 *Locked (Requires Lv. ${loc.minLevel})*`;
        } else {
          status = `🚗 *Available (Lv. ${loc.minLevel}-${loc.maxLevel})*`;
        }

        locsText += `${emoji} **${loc.name}** (Lv. ${loc.minLevel}-${loc.maxLevel})\n` +
                    `⤷ ${status}\n\n`;
      }

      embed.addFields({
        name: `✨ ${rName}`,
        value: locsText.trim(),
        inline: false
      });
    }

    const components: any[] = [];

    // Travel menu
    const travelOptions = zonesCatalog
      .filter((zone) => zone.id !== player.currentZoneId)
      .map((zone) => {
        const isUnlocked = player.level >= zone.minLevel;
        const emoji = zoneEmojis[zone.id] || '📍';
        return {
          label: zone.name,
          value: zone.id,
          description: isUnlocked 
            ? `Travel here (Lv. ${zone.minLevel})` 
            : `Locked - Requires Level ${zone.minLevel}`,
          emoji: isUnlocked ? emoji : '🔒',
        };
      });

    if (travelOptions.length > 0) {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`map_travel_select_${player.discordId}`)
        .setPlaceholder('🗺️ Travel to another location...')
        .addOptions(travelOptions);
      
      components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu));
    }

    // Dungeon selector buttons
    const dungeons = [
      { id: 'verdant_meadows', name: 'Verdant Outpost', lv: 1 },
      { id: 'shadow_forest', name: 'Whispering Canopy', lv: 3 },
      { id: 'crystal_caverns', name: 'Glittering Depths', lv: 6 },
      { id: 'volcanic_wastes', name: 'Volcanic Wastes', lv: 10 },
      { id: 'abyssal_depths', name: 'Abyssal Depths', lv: 15 }
    ];

    // Add Create Co-op Lobby selector
    const lobbyOptions = dungeons
      .filter((d: any) => player.level >= d.lv)
      .map((d: any) => ({
        label: `Lobby: ${d.name}`,
        value: d.id,
        description: `Create a co-op lobby for ${d.name}`
      }));

    if (lobbyOptions.length > 0) {
      const lobbySelect = new StringSelectMenuBuilder()
        .setCustomId(`dungeon_lobby_create_select_${player.discordId}`)
        .setPlaceholder('👥 Create a Co-op Dungeon Lobby...')
        .addOptions(lobbyOptions);
      components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(lobbySelect));
    }

    const dungeonRow1 = new ActionRowBuilder<ButtonBuilder>();
    const dungeonRow2 = new ActionRowBuilder<ButtonBuilder>();

    dungeons.forEach((d, idx) => {
      const btn = new ButtonBuilder()
        .setCustomId(`map_enter_dungeon_${d.id}_${player.discordId}`)
        .setLabel(`${d.name} (Lv.${d.lv})`)
        .setStyle(ButtonStyle.Primary);

      if (player.level < d.lv) {
        btn.setStyle(ButtonStyle.Secondary).setLabel(`🔒 ${d.name} (Lv.${d.lv})`).setDisabled(true);
      } else if (player.stamina < 15) {
        btn.setLabel(`${d.name} (15 🔋 Required)`).setDisabled(true);
      }

      if (idx < 3) {
        dungeonRow1.addComponents(btn);
      } else {
        dungeonRow2.addComponents(btn);
      }
    });

    components.push(dungeonRow1);
    if (dungeonRow2.components.length > 0) {
      components.push(dungeonRow2);
    }

    // Rest at Cozy Tavern Button (if currently at Tavern)
    if (player.currentZoneId === 'cozy_tavern') {
      const restRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(buildNavId('tavern_rest', player.discordId))
          .setLabel('Rest & Sleep at Tavern')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🛌')
      );
      components.push(restRow);
    }

    // Profile & Bag shortcuts
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
      await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    }

    const player = await getPlayerWithClampedStats(interaction.user.id);
    if (!player) {
      const err = errorEmbed('Rest Error', 'Player profile not found. Please complete the /tutorial first.');
      await interaction.editReply({ embeds: [err] });
      return;
    }

    const equippedDbItems = await getEquippedItems(player.id);
    const equippedItemsList = equippedDbItems.map((dbItem) => {
      const def = itemsCatalog.find((i: any) => i.id === dbItem.itemId);
      return { slot: def?.type || 'accessory', rarity: def?.rarity || 'common', stats: def?.stats || {} };
    });

    const stats = computeStats(player.level, player.prestige, player.playerClass, equippedItemsList, null, []);

    // Full restore HP/Mana, replenish stamina to max, set lastStaminaRegen to now
    await db
      .update(players)
      .set({
        hpCurrent: stats.hpMax,
        manaCurrent: stats.manaMax,
        stamina: player.staminaMax,
        lastStaminaRegen: new Date()
      })
      .where(eq(players.id, player.id));

    await db.delete(combatSessions).where(eq(combatSessions.playerId, player.id));

    const embed = new EmbedBuilder()
      .setColor(0x10B981)
      .setTitle('🛌 Cozy Tavern Rest')
      .setDescription(
        `You rent a comfortable room at the **Cozy Tavern** and get a peaceful night of sleep.\n\n` +
        `💖 **HP fully restored**: \`${stats.hpMax}/${stats.hpMax}\`\n` +
        `🧪 **Mana fully restored**: \`${stats.manaMax}/${stats.manaMax}\`\n` +
        `🔋 **Stamina fully restored**: \`${player.staminaMax}/${player.staminaMax}\`\n` +
        `✨ **All active combat sessions cleared!**`
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

// ──────────────────────────────────────────
// DUNGEON INTERACTIONS HANDLER
// ──────────────────────────────────────────
export async function handleDungeonInteraction(
  interaction: ButtonInteraction | StringSelectMenuInteraction
) {
  const customId = interaction.customId;
  const parts = customId.split('_'); // dungeon_{action}_{extra}_{userId}
  
  // Format: dungeon_move_{nodeId}_{userId}
  // Format: dungeon_action_{nodeType}_{nodeAction}_{userId}
  // Format: dungeon_use_potion_{userId}
  // Format: dungeon_potion_select_{userId}
  // Format: dungeon_abandon_{userId}
  
  const action = parts[1];
  let userId = '';

  if (action === 'move') {
    userId = parts[3];
  } else if (action === 'action') {
    userId = parts[4];
  } else if (action === 'use' || action === 'abandon' || action === 'potion') {
    userId = parts[3];
  } else if (customId.startsWith('map_enter_dungeon_')) {
    const dungeonParts = customId.split('_'); // map_enter_dungeon_{zoneId}_{userId}
    userId = dungeonParts[4];
  } else if (action === 'lobby') {
    userId = parts[4];
  } else if (customId.startsWith('dungeon_lobby_create_select_')) {
    const lobbyParts = customId.split('_'); // dungeon_lobby_create_select_{userId}
    userId = lobbyParts[4];
  }

  if (interaction.user.id !== userId) {
    await interaction.reply({ content: '❌ This dungeon session is not yours!', flags: [MessageFlags.Ephemeral] });
    return;
  }

  try {
    const player = await getPlayerWithClampedStats(interaction.user.id);
    if (!player) return;

    if (customId.startsWith('dungeon_lobby_create_select_')) {
      const zoneId = (interaction as StringSelectMenuInteraction).values[0];
      const zone = zonesCatalog.find(z => z.id === zoneId);
      if (!zone || player.level < zone.minLevel) {
        await interaction.reply({ content: `❌ Dungeon locked. Required Level: ${zone?.minLevel || 1}`, flags: [MessageFlags.Ephemeral] });
        return;
      }

      // Create co-op lobby session
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

      await interaction.reply({ content: `✅ Created co-op lobby for **${zone.name}**!`, flags: [MessageFlags.Ephemeral] });
      await runMap(interaction as any);
      return;
    }

    if (action === 'lobby') {
      const lobbyAction = parts[2];
      const sessionId = parts[3];

      const lobbySession = await db.query.explorationSessions.findFirst({
        where: eq(explorationSessions.id, sessionId)
      });

      if (!lobbySession) {
        await interaction.reply({ content: '❌ Lobby not found.', flags: [MessageFlags.Ephemeral] });
        return;
      }

      const party = lobbySession.party as any;

      if (lobbyAction === 'join') {
        if (party.members.length >= 4) {
          await interaction.reply({ content: '❌ Party is already full.', flags: [MessageFlags.Ephemeral] });
          return;
        }

        if (party.members.some((m: any) => m.playerId === player.id)) {
          await interaction.reply({ content: '❌ You are already in this party.', flags: [MessageFlags.Ephemeral] });
          return;
        }

        party.members.push({ playerId: player.id, username: player.username, level: player.level });
        await db
          .update(explorationSessions)
          .set({ party })
          .where(eq(explorationSessions.id, sessionId));

        await interaction.reply({ content: '✅ You joined the party!', flags: [MessageFlags.Ephemeral] });
        await runMap(interaction as any);
        return;
      }

      if (lobbyAction === 'leave') {
        party.members = party.members.filter((m: any) => m.playerId !== player.id);
        await db
          .update(explorationSessions)
          .set({ party })
          .where(eq(explorationSessions.id, sessionId));

        await interaction.reply({ content: '✅ You left the party.', flags: [MessageFlags.Ephemeral] });
        await runMap(interaction as any);
        return;
      }

      if (lobbyAction === 'cancel') {
        if (lobbySession.playerId !== player.id) {
          await interaction.reply({ content: '❌ Only the leader can cancel the lobby.', flags: [MessageFlags.Ephemeral] });
          return;
        }

        await deleteExplorationSession(sessionId);
        await interaction.reply({ content: '✅ Lobby cancelled.', flags: [MessageFlags.Ephemeral] });
        await runMap(interaction as any);
        return;
      }

      if (lobbyAction === 'start') {
        if (lobbySession.playerId !== player.id) {
          await interaction.reply({ content: '❌ Only the leader can start the dungeon.', flags: [MessageFlags.Ephemeral] });
          return;
        }

        // Check stamina of all members
        const missingStamina: string[] = [];
        for (const member of party.members) {
          const mPlayer = await getPlayerWithClampedStats(member.playerId);
          if (!mPlayer || mPlayer.stamina < 15) {
            missingStamina.push(member.username);
          }
        }

        if (missingStamina.length > 0) {
          await interaction.reply({
            content: `❌ Cannot start. The following members need at least 15 Stamina: **${missingStamina.join(', ')}**`,
            flags: [MessageFlags.Ephemeral]
          });
          return;
        }

        // Deduct stamina from all members
        for (const member of party.members) {
          await deductPlayerStamina(member.playerId, 15);
        }

        // Generate map using average level
        const avgLevel = Math.round(
          party.members.reduce((sum: number, m: any) => sum + m.level, 0) / party.members.length
        );
        const mapState = generateDungeonMap(lobbySession.zoneId, avgLevel);

        await db
          .update(explorationSessions)
          .set({
            currentNodeId: 'start',
            mapState
          })
          .where(eq(explorationSessions.id, sessionId));

        await interaction.reply({ content: '🚀 Dungeon started! Good luck!', flags: [MessageFlags.Ephemeral] });
        await runMap(interaction as any);
        return;
      }
    }

    if (customId.startsWith('map_enter_dungeon_')) {
      const dungeonParts = customId.split('_');
      const zoneId = dungeonParts[3];

      // Check level requirement
      const zone = zonesCatalog.find(z => z.id === zoneId);
      if (!zone || player.level < zone.minLevel) {
        await interaction.reply({ content: `❌ Dungeon locked. Required Level: ${zone?.minLevel || 1}`, flags: [MessageFlags.Ephemeral] });
        return;
      }

      // Deduct stamina
      const deducted = await deductPlayerStamina(player.id, 15);
      if (!deducted) {
        await interaction.reply({ content: '❌ Insufficient Stamina! Entering a dungeon costs 15 Stamina.', flags: [MessageFlags.Ephemeral] });
        return;
      }

      // Generate dungeon map
      const mapState = generateDungeonMap(zoneId, player.level);
      
      // Create session
      await createExplorationSession({
        playerId: player.id,
        channelId: interaction.channelId || '',
        zoneId,
        currentNodeId: 'start',
        party: { leaderId: player.id, members: [{ playerId: player.id, username: player.username, level: player.level }] },
        mapState
      });

      await interaction.deferUpdate();
      await runMap(interaction as any);
      return;
    }

    const session = await getExplorationSessionByPlayerId(player.id);
    if (!session) {
      await interaction.reply({ content: '❌ No active exploration session found.', flags: [MessageFlags.Ephemeral] });
      return;
    }

    if (action === 'move') {
      const targetNodeId = parts[2];

      // Deduct stamina
      const deducted = await deductPlayerStamina(player.id, 10);
      if (!deducted) {
        await interaction.reply({ content: '❌ Insufficient Stamina! Moving costs 10 Stamina.', flags: [MessageFlags.Ephemeral] });
        return;
      }

      // Update session
      const mapState = session.mapState as any;
      mapState.nodes = updateFogOfWar(mapState.nodes, targetNodeId);

      await updateExplorationSession(session.id, {
        currentNodeId: targetNodeId,
        previousNodeId: session.currentNodeId,
        mapState
      });

      await interaction.deferUpdate();
      await runMap(interaction as any);
      return;
    }

    if (action === 'abandon') {
      await deleteExplorationSession(session.id);
      await interaction.deferUpdate();
      await runMap(interaction as any, 'You abandoned the dungeon exploration run.');
      return;
    }

    if (action === 'use') {
      // Use Potion - query inventory for consumables
      const items = await db.select().from(inventory).where(and(eq(inventory.playerId, player.id), eq(inventory.equipped, false)));
      const potions = items.filter(dbItem => {
        const def = itemsCatalog.find(i => i.id === dbItem.itemId);
        return def && def.type === 'consumable' && dbItem.quantity > 0;
      });

      if (potions.length === 0) {
        await interaction.reply({ content: '❌ You don\'t have any potions in your bag!', flags: [MessageFlags.Ephemeral] });
        return;
      }

      const options = potions.map(dbItem => {
        const def = itemsCatalog.find(i => i.id === dbItem.itemId);
        return {
          label: `${def.name} (x${dbItem.quantity})`,
          value: dbItem.id,
          description: def.description
        };
      });

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`dungeon_potion_select_${player.discordId}`)
        .setPlaceholder('🧪 Choose a Potion to consume...')
        .addOptions(options);

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
      await interaction.reply({ content: 'Select a potion to use:', components: [row], flags: [MessageFlags.Ephemeral] });
      return;
    }

    if (action === 'potion') {
      // StringSelectMenuInteraction for potion use
      const dbItemId = (interaction as StringSelectMenuInteraction).values[0];
      const dbItem = await db.query.inventory.findFirst({ where: eq(inventory.id, dbItemId) });
      if (!dbItem || dbItem.quantity <= 0) {
        await interaction.reply({ content: '❌ Item not found.', flags: [MessageFlags.Ephemeral] });
        return;
      }

      const itemDef = itemsCatalog.find(i => i.id === dbItem.itemId);
      const customBehavior = itemBehaviorRegistry.get(dbItem.itemId);

      if (customBehavior) {
        // Trigger behavior onUse
        const result = await customBehavior.onUse({
          playerId: player.id,
          state: {
            playerHp: player.hpCurrent,
            playerMaxHp: 100, // will be resolved in behavior or clamped in DB
            playerMana: player.manaCurrent,
            playerMaxMana: 50,
            playerBuffs: [],
            combatLog: []
          },
          itemDef,
          dbItem
        });

        if (result.success) {
          await removeItem(player.id, dbItemId, 1);
          await interaction.reply({ content: `✅ ${result.log || 'Item used successfully!'}`, flags: [MessageFlags.Ephemeral] });
          
          // Re-render map
          await runMap(interaction as any);
        } else {
          await interaction.reply({ content: `❌ Failed to use item: ${result.log || 'Unknown error'}`, flags: [MessageFlags.Ephemeral] });
        }
      } else {
        // Standard recovery fallback
        let hpGained = 0;
        let manaGained = 0;
        
        if (itemDef?.stats?.hp) hpGained = itemDef.stats.hp;
        if (itemDef?.stats?.mana) manaGained = itemDef.stats.mana;

        const equippedDbItems = await getEquippedItems(player.id);
        const equippedItemsList = equippedDbItems.map((dbItem) => {
          const def = itemsCatalog.find((i) => i.id === dbItem.itemId);
          return { slot: def?.type || 'accessory', rarity: def?.rarity || 'common', stats: def?.stats || {} };
        });
        const stats = computeStats(player.level, player.prestige, player.playerClass, equippedItemsList, null, []);

        const newHp = Math.min(stats.hpMax, player.hpCurrent + hpGained);
        const newMana = Math.min(stats.manaMax, player.manaCurrent + manaGained);

        await db.update(players).set({ hpCurrent: newHp, manaCurrent: newMana }).where(eq(players.id, player.id));
        await removeItem(player.id, dbItemId, 1);

        await interaction.reply({ content: `✅ Consumed **${itemDef.name}**! (Recovered HP: +${hpGained}, Mana: +${manaGained})`, flags: [MessageFlags.Ephemeral] });
        await runMap(interaction as any);
      }
      return;
    }

    if (action === 'action') {
      const nodeType = parts[2];
      const nodeAction = parts[3];
      const mapState = session.mapState as any;
      const currentNodeId = session.currentNodeId;
      const currNode = mapState.nodes[currentNodeId];

      const handler = dungeonNodeRegistry.get(nodeType);
      if (!handler) {
        await interaction.reply({ content: '❌ Action handler not registered.', flags: [MessageFlags.Ephemeral] });
        return;
      }

      const context = {
        playerId: player.id,
        discordId: player.discordId,
        node: currNode,
        dbSession: session
      };

      if (nodeAction === 'merchant') {
        // Render merchant shop options in select menu
        const shopItems = currNode.encounterData?.shopItems || [];
        const selectMenuOptions = shopItems.map((spec: any) => {
          const def = itemsCatalog.find(i => i.id === spec.id);
          return {
            label: `${def.name} — ${spec.price} Gold`,
            value: spec.id,
            description: def.description
          };
        });

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`dungeon_merchant_buy_${player.discordId}`)
          .setPlaceholder('🏪 Choose an item to purchase...')
          .addOptions(selectMenuOptions);

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
        await interaction.reply({ content: 'Select an item to buy:', components: [row], flags: [MessageFlags.Ephemeral] });
        return;
      }

      if (nodeAction === 'puzzle') {
        // Render puzzle riddle and choices as buttons
        const riddle = currNode.encounterData?.riddle;
        if (!riddle) return;

        const riddleEmbed = new EmbedBuilder()
          .setColor(0x8B5CF6)
          .setTitle('🧩 Solve the Riddle')
          .setDescription(`**${riddle.question}**`);

        const answerRow = new ActionRowBuilder<ButtonBuilder>();
        riddle.options.forEach((opt: string, idx: number) => {
          answerRow.addComponents(
            new ButtonBuilder()
              .setCustomId(`dungeon_action_puzzle_choice_${idx}_${player.discordId}`)
              .setLabel(opt)
              .setStyle(ButtonStyle.Secondary)
          );
        });

        await interaction.reply({ embeds: [riddleEmbed], components: [answerRow], flags: [MessageFlags.Ephemeral] });
        return;
      }

      if (nodeAction === 'event') {
        // Render event choices
        const event = currNode.encounterData?.event;
        if (!event) return;

        const eventEmbed = new EmbedBuilder()
          .setColor(0xF59E0B)
          .setTitle(event.title)
          .setDescription(event.description);

        const choicesRow = new ActionRowBuilder<ButtonBuilder>();
        event.choices.forEach((c: any) => {
          choicesRow.addComponents(
            new ButtonBuilder()
              .setCustomId(`dungeon_action_event_choose_${c.outcomeId}_${player.discordId}`)
              .setLabel(c.label)
              .setStyle(ButtonStyle.Primary)
          );
        });

        await interaction.reply({ embeds: [eventEmbed], components: [choicesRow], flags: [MessageFlags.Ephemeral] });
        return;
      }

      let result: any;
      if (nodeAction === 'choice') {
        const clickedIdx = parseInt(parts[3]);
        result = await handler.onAction('submit', context, { answerIndex: clickedIdx });
      } else if (nodeAction === 'choose') {
        const outcomeId = parts[3];
        result = await handler.onAction('choose', context, { outcomeId });
      } else {
        result = await handler.onAction(nodeAction, context);
      }

      if (result.success) {
        // Save mapState
        await updateExplorationSession(session.id, {
          mapState: session.mapState
        });

        await interaction.reply({ embeds: result.embeds, flags: [MessageFlags.Ephemeral] });
        await runMap(interaction as any);
      } else {
        await interaction.reply({ content: `❌ Action failed: ${result.log || 'Unknown error'}`, flags: [MessageFlags.Ephemeral] });
      }
      return;
    }

    if (action === 'merchant' && parts[2] === 'buy') {
      // Merchant buy select menu interaction
      const itemId = (interaction as StringSelectMenuInteraction).values[0];
      const mapState = session.mapState as any;
      const currentNodeId = session.currentNodeId;
      const currNode = mapState.nodes[currentNodeId];

      const handler = dungeonNodeRegistry.get('merchant');
      const context = {
        playerId: player.id,
        discordId: player.discordId,
        node: currNode,
        dbSession: session
      };

      const result = await handler!.onAction('buy', context, { itemId });
      if (result.success) {
        await interaction.reply({ embeds: result.embeds, flags: [MessageFlags.Ephemeral] });
        await runMap(interaction as any);
      } else {
        await interaction.reply({ content: `❌ Purchase failed: ${result.log}`, flags: [MessageFlags.Ephemeral] });
      }
      return;
    }

  } catch (err) {
    console.error('Error handling dungeon interaction:', err);
    await interaction.reply({ content: '❌ An error occurred.', flags: [MessageFlags.Ephemeral] });
  }
}
