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
import { players, inventory, explorationSessions } from '../../database/schema.js';
import { eq, and } from 'drizzle-orm';
import { getPlayerWithClampedStats, deductPlayerStamina } from '../../database/queries/player.js';
import { getEquippedItems, removeItem } from '../../database/queries/inventory.js';
import { computeStats } from '../../systems/progression/stats.js';
import { zonesCatalog, itemsCatalog } from '../../utils/catalog.js';
// errorEmbed removed
import { generateDungeonMap, updateFogOfWar } from './dungeonGenerator.js';
import {
  createExplorationSession,
  getExplorationSessionByPlayerId,
  updateExplorationSession,
  deleteExplorationSession
} from '../../database/queries/exploration.js';
import { dungeonNodeRegistry } from './dungeonInteractions.js';
import { itemBehaviorRegistry } from '../items/itemBehavior.js';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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

export async function renderDungeonScreen(
  interaction: any,
  session: any,
  player: any,
  stats: any
) {
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
        `\n\n🔋 *All players must have at least 10 Stamina to start the run.*`
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

  const roomTypeDisplay = currNode.type === 'room' ? 'Combat' : capitalize(currNode.type);
  const zone = zonesCatalog.find(z => z.id === session.zoneId);
  const dungeonName = zone ? zone.name : 'Unknown Dungeon';

  // Build Dungeon Embed
  const embed = new EmbedBuilder()
    .setColor(0x7C3AED) // Premium purple
    .setTitle(`🏰 ${dungeonName} — Floor ${mapState.floor || 1} (Layer ${currNode.layer + 1}/${mapState.layersCount})`)
    .setDescription(
      `📍 **${currNode.name}** (${roomTypeDisplay} Room)\n` +
      `🔋 **${player.stamina}/${player.staminaMax}** Stamina   ❤️ **${player.hpCurrent}/${stats.hpMax}** HP   💧 **${player.manaCurrent}/${stats.manaMax}** MP\n\n` +
      `── **Paths Ahead** ──\n` +
      `${drawDungeonMapVisual(mapState, currentNodeId, session.previousNodeId)}`
    )
    .setFooter({ text: '🧭 Entry costs 10 Stamina. Movement is free!' })
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
        .setDisabled(mustFight);
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
  } else if (currNode.id === 'boss' && isCleared) {
    actionRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`dungeon_nextfloor_${player.discordId}`)
        .setLabel('🪜 Next Floor')
        .setStyle(ButtonStyle.Success)
        .setDisabled(false),
      new ButtonBuilder()
        .setCustomId(`dungeon_claimvictory_${player.discordId}`)
        .setLabel('🏆 Claim Victory')
        .setStyle(ButtonStyle.Primary)
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
}

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

    const { runMap } = await import('../../commands/player/map.js');

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
          if (!mPlayer || mPlayer.stamina < 10) {
            missingStamina.push(member.username);
          }
        }

        if (missingStamina.length > 0) {
          await interaction.reply({
            content: `❌ Cannot start. The following members need at least 10 Stamina: **${missingStamina.join(', ')}**`,
            flags: [MessageFlags.Ephemeral]
          });
          return;
        }

        // Deduct stamina from all members
        for (const member of party.members) {
          await deductPlayerStamina(member.playerId, 10);
        }

        // Generate map using average level
        const avgLevel = Math.round(
          party.members.reduce((sum: number, m: any) => sum + m.level, 0) / party.members.length
        );
        const mapState = generateDungeonMap(lobbySession.zoneId, avgLevel);
        (mapState as any).floor = 1;

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
      const deducted = await deductPlayerStamina(player.id, 10);
      if (!deducted) {
        await interaction.reply({ content: '❌ Insufficient Stamina! Entering a dungeon costs 10 Stamina.', flags: [MessageFlags.Ephemeral] });
        return;
      }

      // Generate dungeon map
      const mapState = generateDungeonMap(zoneId, player.level);
      (mapState as any).floor = 1;
      
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

      // Movement is free in dungeons now

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

    if (action === 'nextfloor') {
      // Descending floors is free in dungeons now

      // Generate next floor map
      const mapState = session.mapState as any;
      const currentFloor = mapState.floor || 1;
      const nextFloor = currentFloor + 1;
      const nextMapState = generateDungeonMap(session.zoneId, player.level);
      (nextMapState as any).floor = nextFloor;

      await updateExplorationSession(session.id, {
        currentNodeId: 'start',
        previousNodeId: null,
        mapState: nextMapState
      });

      await interaction.reply({ content: `🪜 You descended to Floor **${nextFloor}**!`, flags: [MessageFlags.Ephemeral] });
      await runMap(interaction as any);
      return;
    }

    if (action === 'claimvictory') {
      const mapState = session.mapState as any;
      const currentFloor = mapState.floor || 1;

      // Calculate elapsed time
      const timeTaken = Math.round((Date.now() - new Date(session.createdAt).getTime()) / 1000);

      // Record in leaderboard
      const { recordDungeonRun } = await import('../../database/queries/dungeon.js');
      await recordDungeonRun({
        playerId: player.id,
        dungeonId: session.zoneId,
        floor: currentFloor,
        timeTaken
      });

      // Award victory bonus
      const goldBonus = currentFloor * 250;
      const expBonus = currentFloor * 100;

      const { awardGold } = await import('../../economy/currency.js');
      const { awardPlayerExp } = await import('../../database/queries/player.js');

      await awardGold(player.id, goldBonus, `Dungeon Victory Bonus`);
      const expResult = await awardPlayerExp(player.id, expBonus);

      // Delete exploration session
      await deleteExplorationSession(session.id);

      const zone = zonesCatalog.find((z) => z.id === session.zoneId);
      const dungeonName = zone ? zone.name : 'Unknown Dungeon';

      // Format time nicely
      const h = Math.floor(timeTaken / 3600);
      const m = Math.floor((timeTaken % 3600) / 60);
      const s = timeTaken % 60;
      const timeDisplay = h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`;

      let victoryMsg = `🏆 **Victory Claimed!** You cleared Floor **${currentFloor}** of **${dungeonName}** in **${timeDisplay}**!\n` +
        `💰 Gained **+${goldBonus} Gold** and 🌟 **+${expBonus} XP**!`;

      if (expResult.leveledUp) {
        victoryMsg += `\n🎉 **LEVEL UP!** You reached **Level ${expResult.newLevel}**! Your HP and Mana have been fully restored.`;
      }

      await interaction.reply({ content: victoryMsg, flags: [MessageFlags.Ephemeral] });
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

      if (nodeAction === 'event') {
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
