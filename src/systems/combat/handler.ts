import { logger } from '../../utils/logger.js';
import {
  type ButtonInteraction,
  type StringSelectMenuInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} from 'discord.js';
import { db } from '../../database/client.js';
import { combatSessions, players, playerSkills } from '../../database/schema.js';
import { eq } from 'drizzle-orm';
import { getEnemyById, scaleEnemyStats } from './enemy.js';
import { processPlayerTurn, processEnemyTurn, getStatModifier, type CombatStats, type CombatAction } from './engine.js';
import { computeStats } from '../../systems/progression/stats.js';
import { findOrCreatePlayer } from '../../database/queries/player.js';
import { getEquippedItems } from '../../database/queries/inventory.js';
import { combatEmbed, successEmbed, errorEmbed } from '../../utils/embeds.js';
import { itemsCatalog } from '../../utils/catalog.js';
import { getNavButtons } from '../../utils/navigation.js';
import { parsePresets, buildPresetButtons } from './presets.js';
import { getCombatSkillsRow, getCombatItemsRow } from './uiHelpers.js';
import { handlePlayerTurnAction, resolveCombatEnd } from './combatResolver.js';
import { getSkillById, executeSkill } from './skills.js';

export async function handleCombatInteraction(
  interaction: ButtonInteraction | StringSelectMenuInteraction
) {
  try {
    await interaction.deferUpdate();

    if (interaction.customId === 'combat_preset_configure') {
      const { runPreset } = await import('../../commands/player/presets.js');
      await runPreset(interaction);
      return;
    }

    const parts = interaction.customId.split('_');
    let targetUserId = '';
    if (interaction.customId.startsWith('combat_preset_')) {
      targetUserId = parts[2] || '';
    } else if (interaction.customId.startsWith('combat_use_')) {
      targetUserId = parts[3] || '';
    } else {
      targetUserId = parts[2] || '';
    }

    if (targetUserId && interaction.user.id !== targetUserId) {
      await interaction.followUp({
        content: '❌ This combat session is not yours!',
        flags: [MessageFlags.Ephemeral]
      });
      return;
    }

    const discordId = interaction.user.id;
    const username = interaction.user.username;

    // 1. Fetch player (active clicker)
    const player = await findOrCreatePlayer(discordId, username);

    // Load owner of the combat session
    let owner = player;
    if (targetUserId && targetUserId !== discordId) {
      const dbOwner = await findOrCreatePlayer(targetUserId, '');
      if (dbOwner) {
        owner = dbOwner;
      }
    }

    // 2. Fetch active combat session (owner's session)
    const activeSession = await db.query.combatSessions.findFirst({
      where: eq(combatSessions.playerId, owner.id)
    });

    if (!activeSession) {
      await interaction.editReply({
        content: '❌ This combat session has expired or ended.',
        embeds: [],
        components: []
      });
      return;
    }

    // Verify co-op permission
    const isOwner = owner.id === player.id;
    let isPartyMember = false;
    if (!isOwner && activeSession.state && (activeSession.state as any).explorationSessionId) {
      const { explorationSessions } = await import('../../database/schema.js');
      const expSession = await db.query.explorationSessions.findFirst({
        where: eq(explorationSessions.id, (activeSession.state as any).explorationSessionId)
      });
      if (expSession && expSession.party) {
        const party = expSession.party as any;
        isPartyMember = party.members?.some((m: any) => m.playerId === player.id);
      }
    }

    if (!isOwner && !isPartyMember) {
      await interaction.followUp({
        content: '❌ This combat session is not yours!',
        flags: [MessageFlags.Ephemeral]
      });
      return;
    }

    // Verify message matching
    if (activeSession.messageId !== interaction.message.id) {
      await interaction.followUp({
        content: '⚠️ This is an outdated combat message. Use `/fight` to view the current battle state.',
        ephemeral: true
      });
      return;
    }

    const enemyDef = getEnemyById(activeSession.enemyId);
    if (!enemyDef) {
      await interaction.editReply({ content: '❌ Combat error: Enemy not found.', embeds: [], components: [] });
      return;
    }

    // Load catalog and stats
    const equippedDbItems = await getEquippedItems(player.id);
    const catalog = itemsCatalog;
    const equippedItemsList = equippedDbItems.map((dbItem) => {
      const def = catalog.find((i) => i.id === dbItem.itemId);
      return { slot: def?.type || 'accessory', rarity: def?.rarity || 'common', stats: def?.stats || {} };
    });
    const playerStats = computeStats(player.level, player.prestige, player.playerClass, equippedItemsList, null, []);

    const combatStats: CombatStats = {
      hp: player.hpCurrent,
      maxHp: playerStats.hpMax,
      mana: player.manaCurrent,
      maxMana: playerStats.manaMax,
      attack: playerStats.attack,
      defense: playerStats.defense,
      speed: playerStats.speed,
      critChance: playerStats.critChance,
      critDmg: playerStats.critDmg,
      luck: playerStats.luck
    };

    const scaledEnemyStats = scaleEnemyStats(enemyDef, owner.level);
    const state = activeSession.state as any;

    // Inject max values in case they aren't saved
    state.playerMaxHp = playerStats.hpMax;
    state.playerMaxMana = playerStats.manaMax;
    state.enemyMaxHp = scaledEnemyStats.hp;

    const initialEnemyHp = state.enemyHp;

    // 3. Resolve player action
    const action = await handlePlayerTurnAction(
      interaction,
      player,
      state,
      combatStats,
      scaledEnemyStats,
      enemyDef
    );

    if (!action) {
      // Action handling produced a reply/followup due to error/validation (e.g. no mana, invalid preset)
      return;
    }

    // Resolve Player Turn
    processPlayerTurn(state, action, combatStats, scaledEnemyStats);
    const damageDealt = Math.max(0, initialEnemyHp - state.enemyHp);
    if (damageDealt > 0) {
      if (!state.damageReport) state.damageReport = {};
      state.damageReport[player.username] = (state.damageReport[player.username] || 0) + damageDealt;
    }

    // If fled successfully
    if (state.isOver && !state.playerWon && action.type === 'flee') {
      await db.delete(combatSessions).where(eq(combatSessions.id, activeSession.id));
      await db
        .update(players)
        .set({ hpCurrent: state.playerHp, manaCurrent: state.playerMana })
        .where(eq(players.id, player.id));

      const embed = successEmbed('Fled Battle', `💨 You successfully fled from the **Lv.${enemyDef.level} ${enemyDef.name}**.`);
      embed.setColor(0xF59E0B); // Amber warnings
      
      const { getExplorationSessionByPlayerId, updateExplorationSession } = await import('../../database/queries/exploration.js');
      const { buildNavId } = await import('../../utils/navigation.js');
      const expSession = await getExplorationSessionByPlayerId(player.id);
      
      let components: any[] = [];
      if (expSession) {
        const backtrackNodeId = expSession.previousNodeId || 'start';
        await updateExplorationSession(expSession.id, {
          currentNodeId: backtrackNodeId,
          previousNodeId: null
        });
        const backBtn = new ButtonBuilder()
          .setCustomId(buildNavId('player_map', player.discordId))
          .setLabel('Back to Dungeon')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('➡️');
        components = [new ActionRowBuilder<ButtonBuilder>().addComponents(backBtn)];
      } else {
        const victoryContext = state.source === 'hunt' ? 'combat_fight_victory_hunt' : 'combat_fight_victory';
        const navButtons = getNavButtons(victoryContext, player.discordId, activeSession.zoneId);
        components = navButtons ? [navButtons] : [];
      }

      await interaction.editReply({ embeds: [embed], components });
      return;
    }

    // 4. Resolve Enemy Turn (if combat is not over)
    if (!state.isOver) {
      processEnemyTurn(state, combatStats, scaledEnemyStats, enemyDef.abilities as any[]);
    }

    // 5. Handle Combat End (Victory / Defeat)
    if (state.isOver) {
      await resolveCombatEnd(interaction, player, state, activeSession, playerStats, enemyDef);
      return;
    }

    // 6. Combat continues: save state and refresh UI
    await db
      .update(combatSessions)
      .set({ state })
      .where(eq(combatSessions.id, activeSession.id));

    // Save HP/Mana changes on player directly in case they flee later or inspect profile
    await db
      .update(players)
      .set({
        hpCurrent: state.playerHp,
        manaCurrent: state.playerMana
      })
      .where(eq(players.id, player.id));

    // Rebuild components
    const isAutoplay = state.activePresetSlot !== undefined;

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`combat_attack_${player.discordId}`).setLabel('⚔️ Attack').setStyle(ButtonStyle.Primary).setDisabled(isAutoplay),
      new ButtonBuilder().setCustomId(`combat_defend_${player.discordId}`).setLabel('🛡️ Defend').setStyle(ButtonStyle.Secondary).setDisabled(isAutoplay),
      new ButtonBuilder().setCustomId(`combat_flee_${player.discordId}`).setLabel('🏃 Flee').setStyle(ButtonStyle.Danger).setDisabled(isAutoplay)
    );

    const selectMenuRow = await getCombatSkillsRow(player.id, player.playerClass, player.discordId, isAutoplay);
    const itemsRow = await getCombatItemsRow(player.id, player.discordId, isAutoplay);
    const presetsRow = buildPresetButtons(parsePresets(player.presets), 'combat', player.playerClass, player.discordId, isAutoplay);
    const components: any[] = [row, presetsRow];
    if (selectMenuRow) components.push(selectMenuRow);
    if (itemsRow) components.push(itemsRow);

    const embed = combatEmbed(
      player.username,
      state.playerHp,
      playerStats.hpMax,
      state.playerMana,
      playerStats.manaMax,
      { id: enemyDef.id, name: enemyDef.name, level: enemyDef.level },
      state.enemyHp,
      state.enemyMaxHp,
      state.round,
      state.combatLog,
      state.playerBuffs || [],
      state.enemyBuffs || [],
      state.activePresetSlot
    );

    await interaction.editReply({
      embeds: [embed],
      components: components as any[]
    });

    if (!state.isOver && state.activePresetSlot !== undefined) {
      queueAutoplayStep(player.id, activeSession.id, interaction.client, state.round, state.activePresetSlot);
    }

  } catch (error) {
    logger.error({ err: error }, 'Failed to handle combat interaction:');
    try {
      await interaction.followUp({
        embeds: [errorEmbed('Combat Error', 'Something went wrong during combat. Please try `/fight` to resume.')],
        ephemeral: true
      });
    } catch {}
  }
}

function queueAutoplayStep(
  playerId: string,
  sessionId: string,
  client: any,
  expectedRound: number,
  activeSlot: number
) {
  setTimeout(async () => {
    try {
      await runAutoplayStep(playerId, sessionId, client, expectedRound, activeSlot);
    } catch (err) {
      logger.error({ err: err }, 'Error in autoplay step:');
    }
  }, 5000);
}

export async function runAutoplayStep(
  playerId: string,
  sessionId: string,
  client: any,
  expectedRound: number,
  activeSlot: number
) {
  const activeSession = await db.query.combatSessions.findFirst({
    where: eq(combatSessions.id, sessionId)
  });

  if (!activeSession) return;

  const state = activeSession.state as any;

  if (state.activePresetSlot !== activeSlot || state.round !== expectedRound || state.isOver) {
    return;
  }

  const player = await db.query.players.findFirst({
    where: eq(players.id, playerId)
  });
  if (!player) return;

  const enemyDef = getEnemyById(activeSession.enemyId);
  if (!enemyDef) return;

  const equippedDbItems = await getEquippedItems(player.id);
  const equippedItemsList = equippedDbItems.map((dbItem) => {
    const def = itemsCatalog.find((i) => i.id === dbItem.itemId);
    return { slot: def?.type || 'accessory', rarity: def?.rarity || 'common', stats: def?.stats || {} };
  });
  const playerStats = computeStats(player.level, player.prestige, player.playerClass, equippedItemsList, null, []);

  const combatStats: CombatStats = {
    hp: player.hpCurrent,
    maxHp: playerStats.hpMax,
    mana: player.manaCurrent,
    maxMana: playerStats.manaMax,
    attack: playerStats.attack,
    defense: playerStats.defense,
    speed: playerStats.speed,
    critChance: playerStats.critChance,
    critDmg: playerStats.critDmg,
    luck: playerStats.luck
  };

  const scaledEnemyStats = scaleEnemyStats(enemyDef, player.level);

  const presets = parsePresets(player.presets);
  const slot = presets[activeSlot - 1];
  if (!slot || !slot.actions || slot.actions.length === 0) {
    state.activePresetSlot = undefined;
    await db.update(combatSessions).set({ state }).where(eq(combatSessions.id, sessionId));
    return;
  }

  const learnedSkillsDb = await db.select().from(playerSkills).where(eq(playerSkills.playerId, player.id));
  const learnedSkillIds = learnedSkillsDb.map((s) => s.skillId);

  const initialEnemyHp = state.enemyHp;
  const actionIndex = (state.round - 1) % slot.actions.length;
  const actionId = slot.actions[actionIndex] || 'attack';

  let action: CombatAction = { type: 'attack' };
  
  if (actionId === 'attack') {
    action = { type: 'attack' };
  } else {
    const skillDef = getSkillById(actionId);
    if (!skillDef || !learnedSkillIds.includes(actionId) || state.playerMana < skillDef.manaCost) {
      state.activePresetSlot = undefined;
      state.combatLog.push(`❌ Autoplay interrupted: Cannot cast ${skillDef?.name || actionId} (Out of mana or not learned).`);
      await db.update(combatSessions).set({ state }).where(eq(combatSessions.id, sessionId));
      await updateCombatMessage(client, activeSession, state, player, playerStats, enemyDef);
      return;
    }

    state.playerMana -= skillDef.manaCost;

    const atkMod = getStatModifier(state.playerBuffs, 'attack');
    const defMod = getStatModifier(state.playerBuffs, 'defense');
    const spdMod = getStatModifier(state.playerBuffs, 'speed');
    const critMod = getStatModifier(state.playerBuffs, 'critChance');

    const currentStats = {
      ...combatStats,
      attack: Math.max(1, combatStats.attack + atkMod),
      defense: Math.max(1, combatStats.defense + defMod),
      speed: Math.max(0, combatStats.speed + spdMod),
      critChance: Math.max(0, combatStats.critChance + critMod),
    };

    const enemyCombatStats: CombatStats = {
      hp: state.enemyHp,
      maxHp: state.enemyMaxHp,
      mana: 0,
      maxMana: 0,
      attack: scaledEnemyStats.attack,
      defense: scaledEnemyStats.defense,
      speed: scaledEnemyStats.speed,
      critChance: 0,
      critDmg: 150,
      luck: 0,
    };

    const result = executeSkill(skillDef, currentStats, enemyCombatStats);

    if (skillDef.id === 'healer_purify') {
      state.playerBuffs = state.playerBuffs.filter((b: any) => b.type !== 'debuff');
    }

    if (skillDef.id === 'mage_mana_surge') {
      state.playerMana = Math.min(state.playerMaxMana, state.playerMana + result.healing);
    } else {
      state.playerHp = Math.min(state.playerMaxHp, state.playerHp + result.healing);
    }

    state.enemyHp = Math.max(0, state.enemyHp - result.damage);

    for (const eff of result.effects) {
      if (eff.stat) {
        const effectTarget = skillDef.effects.find((e) => e.stat === eff.stat)?.target;
        if (effectTarget === 'self') {
          state.playerBuffs.push(eff);
        } else {
          state.enemyBuffs.push(eff);
        }
      } else {
        const effectType = skillDef.effects.find((e) => e.type === 'dot' || e.type === 'hot')?.type;
        if (effectType === 'hot') {
          state.playerBuffs.push(eff);
        } else {
          state.enemyBuffs.push(eff);
        }
      }
    }

    state.combatLog.push(`⚡ Preset **${slot.name}** (Step ${actionIndex + 1}/${slot.actions.length}):`);
    state.combatLog.push(result.description);
    action = { type: 'skill', skillId: skillDef.name };
  }

  processPlayerTurn(state, action, combatStats, scaledEnemyStats);
  const damageDealt = Math.max(0, initialEnemyHp - state.enemyHp);
  if (damageDealt > 0) {
    if (!state.damageReport) state.damageReport = {};
    state.damageReport[player.username] = (state.damageReport[player.username] || 0) + damageDealt;
  }

  const channel = await client.channels.fetch(activeSession.channelId).catch(() => null);
  if (!channel) return;
  const message = await channel.messages.fetch(activeSession.messageId).catch(() => null);
  if (!message) return;

  const wrappedInteraction: any = {
    user: { id: player.discordId, username: player.username },
    channelId: activeSession.channelId,
    deferred: true,
    replied: true,
    editReply: async (payload: any) => {
      return message.edit(payload);
    },
    followUp: async (payload: any) => {
      if ('send' in channel) {
        return (channel as any).send(payload);
      }
    }
  };

  if (state.isOver && !state.playerWon && action.type === 'flee') {
    await db.delete(combatSessions).where(eq(combatSessions.id, activeSession.id));
    await db.update(players).set({ hpCurrent: state.playerHp, manaCurrent: state.playerMana }).where(eq(players.id, player.id));
    const embed = successEmbed('Fled Battle', `💨 You successfully fled.`);
    await message.edit({ embeds: [embed], components: [] });
    return;
  }

  if (!state.isOver) {
    processEnemyTurn(state, combatStats, scaledEnemyStats, enemyDef.abilities as any[]);
  }

  if (state.isOver) {
    await resolveCombatEnd(wrappedInteraction, player, state, activeSession, playerStats, enemyDef);
    return;
  }

  await db.update(combatSessions).set({ state }).where(eq(combatSessions.id, activeSession.id));
  await db.update(players).set({ hpCurrent: state.playerHp, manaCurrent: state.playerMana }).where(eq(players.id, player.id));

  await updateCombatMessage(client, activeSession, state, player, playerStats, enemyDef, message);

  queueAutoplayStep(player.id, activeSession.id, client, state.round, activeSlot);
}

async function updateCombatMessage(client: any, activeSession: any, state: any, player: any, playerStats: any, enemyDef: any, message?: any) {
  if (!message) {
    const channel = await client.channels.fetch(activeSession.channelId).catch(() => null);
    if (!channel) return;
    message = await channel.messages.fetch(activeSession.messageId).catch(() => null);
    if (!message) return;
  }

  const isAutoplay = state.activePresetSlot !== undefined;

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`combat_attack_${player.discordId}`).setLabel('⚔️ Attack').setStyle(ButtonStyle.Primary).setDisabled(isAutoplay),
    new ButtonBuilder().setCustomId(`combat_defend_${player.discordId}`).setLabel('🛡️ Defend').setStyle(ButtonStyle.Secondary).setDisabled(isAutoplay),
    new ButtonBuilder().setCustomId(`combat_flee_${player.discordId}`).setLabel('🏃 Flee').setStyle(ButtonStyle.Danger).setDisabled(isAutoplay)
  );

  const selectMenuRow = await getCombatSkillsRow(player.id, player.playerClass, player.discordId, isAutoplay);
  const itemsRow = await getCombatItemsRow(player.id, player.discordId, isAutoplay);
  const presetsRow = buildPresetButtons(parsePresets(player.presets), 'combat', player.playerClass, player.discordId, isAutoplay);
  const components: any[] = [row, presetsRow];
  if (selectMenuRow) components.push(selectMenuRow);
  if (itemsRow) components.push(itemsRow);

  const embed = combatEmbed(
    player.username,
    state.playerHp,
    playerStats.hpMax,
    state.playerMana,
    playerStats.manaMax,
    { id: enemyDef.id, name: enemyDef.name, level: enemyDef.level },
    state.enemyHp,
    state.enemyMaxHp,
    state.round,
    state.combatLog,
    state.playerBuffs || [],
    state.enemyBuffs || [],
    state.activePresetSlot
  );

  await message.edit({
    embeds: [embed],
    components: components as any[]
  });
}
