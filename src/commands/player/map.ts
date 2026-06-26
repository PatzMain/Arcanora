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
import { players, combatSessions, inventory, explorationSessions } from '../../database/schema.js';
import { eq, and } from 'drizzle-orm';
import { getPlayerWithClampedStats, getAndUpdatePlayerStamina, deductPlayerStamina } from '../../database/queries/player.js';
import { getEquippedItems, removeItem } from '../../database/queries/inventory.js';
import { computeStats } from '../../systems/progression/stats.js';
import { zonesCatalog, itemsCatalog, enemiesCatalog } from '../../utils/catalog.js';
import { errorEmbed } from '../../utils/embeds.js';
import { buildNavId } from '../../utils/navigation.js';
import { generateDungeonMap, updateFogOfWar } from '../../systems/exploration/dungeonGenerator.js';
import {
  createExplorationSession,
  getExplorationSessionByPlayerId,
  updateExplorationSession,
  deleteExplorationSession
} from '../../database/queries/exploration.js';
import { dungeonNodeRegistry } from '../../systems/exploration/dungeonInteractions.js';
import { itemBehaviorRegistry } from '../../systems/items/itemBehavior.js';
import {
  discoverLocation,
  getPlayerDiscoveredLocations
} from '../../database/queries/worldQueries.js';
import { travelToNode, exploreNode } from '../../systems/exploration/worldExplorer.js';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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

  let text = '';
  if (previousNodeId && mapState.nodes[previousNodeId]) {
    const prevNode = mapState.nodes[previousNodeId];
    text += `   *${getSymbol(prevNode.type)} Visited: ${prevNode.name}*\n       │\n`;
  }
  
  text += `📍 **YOU: ${getSymbol(currNode.type)} ${currNode.name}**\n`;
  
  const connIds = currNode.connections || [];
  if (connIds.length === 0) {
    text += `       *(Final Chamber)*\n`;
  } else {
    connIds.forEach((connId: string, idx: number) => {
      const nextNode = mapState.nodes[connId];
      if (nextNode) {
        const isLast = idx === connIds.length - 1;
        const prefix = connIds.length === 1 ? '       └──' : (isLast ? '       └──' : '       ├──');
        if (nextNode.status === 'hidden') {
          text += `${prefix} ❓ **Unknown Room**\n`;
        } else {
          text += `${prefix} ${getSymbol(nextNode.type)} **${nextNode.name}**\n`;
        }
      }
    });
  }
  return text;
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

        const leaderDiscordId = (session as any).player.discordId;

        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`dungeon_lobby_join_${session.id}_${leaderDiscordId}`)
            .setLabel('Join Party')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('👥')
            .setDisabled(party.members.length >= 4),
          new ButtonBuilder()
            .setCustomId(`dungeon_lobby_leave_${session.id}_${leaderDiscordId}`)
            .setLabel('Leave Party')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🚪'),
          new ButtonBuilder()
            .setCustomId(`dungeon_lobby_start_${session.id}_${leaderDiscordId}`)
            .setLabel('Start Dungeon')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🚀'),
          new ButtonBuilder()
            .setCustomId(`dungeon_lobby_cancel_${session.id}_${leaderDiscordId}`)
            .setLabel('Cancel Lobby')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌')
        );

        components.push(row);

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

      const roomTypeDisplay = currNode.type === 'room' ? 'Combat' : capitalize(currNode.type);
      const zone = zonesCatalog.find(z => z.id === session.zoneId);
      const dungeonName = zone ? zone.name : 'Unknown Dungeon';

      // Build Dungeon Embed
      const embed = new EmbedBuilder()
        .setColor(0x7C3AED) // Premium purple
        .setTitle(`🏰 ${dungeonName} — Layer ${currNode.layer + 1}/${mapState.layersCount}`)
        .setDescription(
          `📍 **${currNode.name}** (${roomTypeDisplay} Room)\n` +
          `🔋 **${player.stamina}/${player.staminaMax}** Stamina   ❤️ **${player.hpCurrent}/${stats.hpMax}** HP   💧 **${player.manaCurrent}/${stats.manaMax}** MP\n\n` +
          `── **Paths Ahead** ──\n` +
          `${drawDungeonMapVisual(mapState, currentNodeId, session.previousNodeId)}`
        )
        .setFooter({ text: '🧭 Each room movement costs 10 Stamina' })
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
            .setLabel(label)
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
    // NO ACTIVE SESSION — WORLD MAP VIEW
    // ──────────────────────────────────────────
    // Load player's discovered location IDs
    let discoveredLocIds = await getPlayerDiscoveredLocations(player.id);
    if (discoveredLocIds.length === 0) {
      await discoverLocation(player.id, 'cozy_tavern');
      await discoverLocation(player.id, 'verdant_meadows');
      discoveredLocIds = ['cozy_tavern', 'verdant_meadows'];
    }

    const currentLoc = zonesCatalog.find((z) => z.id === player.currentZoneId) || zonesCatalog.find((z) => z.id === 'cozy_tavern')!;

    const equippedDbItems = await getEquippedItems(player.id);
    const equippedItemsList = equippedDbItems.map((dbItem) => {
      const def = itemsCatalog.find((i) => i.id === dbItem.itemId);
      return { slot: def?.type || 'accessory', rarity: def?.rarity || 'common', stats: def?.stats || {} };
    });
    const stats = computeStats(player.level, player.prestige, player.playerClass, equippedItemsList, null, []);

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
    const descriptionText =
      (travelMsg ? `✅ **${travelMsg}**\n\n` : '') +
      `**Lv.${currentLoc.minLevel}-${currentLoc.maxLevel}  ·  ${capitalize(currentLoc.type)}  ·  ${currentLoc.region}**\n\n` +
      `*"${currentLoc.description}"*\n\n` +
      `${vitalsText}\n\n` +
      `── **Where to Go** ──\n` +
      destinationsText;

    const embed = new EmbedBuilder()
      .setColor(0x7C3AED)
      .setTitle(`🗺️ ${currentLoc.name}`)
      .setDescription(descriptionText)
      .setFooter({ text: 'Arcanora — World Exploration' })
      .setTimestamp();

    const components: any[] = [];

    // Row 1: Exploration & Action buttons
    const actionRow = new ActionRowBuilder<ButtonBuilder>();
    
    // Explore button
    actionRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`map_world_explore_${player.discordId}`)
        .setLabel('Explore Node')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🔎')
        .setDisabled(player.stamina < 10)
    );

    // Rest button (if Cozy Tavern)
    if (currentLoc.id === 'cozy_tavern') {
      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`map_world_rest_${player.discordId}`)
          .setLabel('Rest at Tavern')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🛌')
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
      await interaction.deferUpdate();
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

    await runMap(interaction as any, '💤 You slept peacefully. HP, Mana, and Stamina fully restored!');
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
  const parts = customId.split('_');
  const userId = parts[parts.length - 1];

  const action = parts[1];
  const isLobbyJoin = customId.startsWith('dungeon_lobby_join_');
  const isLobbyLeave = customId.startsWith('dungeon_lobby_leave_');

  if (!isLobbyJoin && !isLobbyLeave && interaction.user.id !== userId) {
    await interaction.reply({ content: '❌ This dungeon session is not yours!', flags: [MessageFlags.Ephemeral] });
    return;
  }

  try {
    const player = await getPlayerWithClampedStats(interaction.user.id);
    if (!player) return;

    if (customId.startsWith('dungeon_lobby_create_select_')) {
      const zoneId = (interaction as StringSelectMenuInteraction).values[0];
      if (!zoneId) {
        await interaction.reply({ content: '❌ No dungeon selected.', flags: [MessageFlags.Ephemeral] });
        return;
      }
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

      if (!lobbyAction || !sessionId) {
        await interaction.reply({ content: '❌ Invalid lobby action parameters.', flags: [MessageFlags.Ephemeral] });
        return;
      }

      const lobbySession = await db.query.explorationSessions.findFirst({
        where: eq(explorationSessions.id, sessionId),
        with: { player: true }
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
        await runMap(interaction as any, undefined, lobbySession.player.discordId);
        return;
      }

      if (lobbyAction === 'leave') {
        const isMember = party.members.some((m: any) => m.playerId === player.id);
        if (!isMember) {
          await interaction.reply({ content: '❌ You are not in this party.', flags: [MessageFlags.Ephemeral] });
          return;
        }

        if (lobbySession.playerId === player.id) {
          await interaction.reply({ content: '❌ As leader, you must cancel the lobby instead of leaving. Use "Cancel Lobby".', flags: [MessageFlags.Ephemeral] });
          return;
        }

        party.members = party.members.filter((m: any) => m.playerId !== player.id);
        await db
          .update(explorationSessions)
          .set({ party })
          .where(eq(explorationSessions.id, sessionId));

        await interaction.reply({ content: '✅ You left the party.', flags: [MessageFlags.Ephemeral] });
        await runMap(interaction as any, undefined, lobbySession.player.discordId);
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
      const zoneId = parts.slice(3, -1).join('_');

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
      const targetNodeId = parts.slice(2, -1).join('_');

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
      if (!dbItemId) {
        await interaction.reply({ content: '❌ No item selected.', flags: [MessageFlags.Ephemeral] });
        return;
      }

      const dbItem = await db.query.inventory.findFirst({ where: eq(inventory.id, dbItemId) });
      if (!dbItem || dbItem.quantity <= 0) {
        await interaction.reply({ content: '❌ Item not found.', flags: [MessageFlags.Ephemeral] });
        return;
      }

      const itemDef = itemsCatalog.find(i => i.id === dbItem.itemId);
      if (!itemDef) {
        await interaction.reply({ content: '❌ Item definition not found.', flags: [MessageFlags.Ephemeral] });
        return;
      }

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
      if (!nodeType || !nodeAction) {
        await interaction.reply({ content: '❌ Invalid dungeon action.', flags: [MessageFlags.Ephemeral] });
        return;
      }

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

      // Riddle solver block removed

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
        const clickedIdx = parseInt(parts[4] || '0');
        result = await handler.onAction('submit', context, { answerIndex: clickedIdx });
      } else if (nodeAction === 'choose') {
        const outcomeId = parts.slice(4, -1).join('_');
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

/**
 * Handles all interactions (buttons & select menus) starting with map_world_
 */
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

  // Defer update or reply depending on what we will do
  // Some paths might trigger followUps, but we always defer first to give us time
  await interaction.deferUpdate();

  try {
    const player = await getPlayerWithClampedStats(interaction.user.id);
    if (!player) return;

    if (customId.startsWith('map_world_travel_select_')) {
      const selectMenu = interaction as StringSelectMenuInteraction;
      const targetLocationId = selectMenu.values[0]!;
      const targetLoc = zonesCatalog.find((z) => z.id === targetLocationId);
      if (!targetLoc) return;

      let discoveredLocIds = await getPlayerDiscoveredLocations(player.id);
      if (discoveredLocIds.length === 0) {
        discoveredLocIds = ['cozy_tavern', 'verdant_meadows'];
      }

      const isDiscovered = discoveredLocIds.includes(targetLocationId);
      const levelLocked = player.level < targetLoc.minLevel;
      const lockReason = !isDiscovered 
        ? 'This location is hidden. You must discover it first by exploring adjacent nodes.' 
        : levelLocked 
          ? `Your level is too low. Required: Level ${targetLoc.minLevel}.`
          : player.stamina < 10
            ? 'You do not have enough stamina (10 required).'
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
          `🔋 **Stamina Cost**: 10 Stamina\n` +
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
      const result = await exploreNode(player.id);
      
      if (result.type === 'combat') {
        // Direct transition to combat screen!
        const { runFight } = await import('../combat/combat.js');
        // Let's call runFight to display active combat panel
        await runFight(interaction as any);
        return;
      }
      
      // Riddle puzzle check removed

      // Other types (resource, chest, discovery, empty, etc.) yield text messages
      await runMap(interaction as any, result.message);
      return;
    }

    // Riddle world solve block removed

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
