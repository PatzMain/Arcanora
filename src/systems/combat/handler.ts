import {
  type ButtonInteraction,
  type StringSelectMenuInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { db } from '../../database/client.js';
import { combatSessions, players } from '../../database/schema.js';
import { eq } from 'drizzle-orm';
import { getEnemyById, scaleEnemyStats } from './enemy.js';
import { processPlayerTurn, processEnemyTurn, type CombatStats } from './engine.js';
import { computeStats } from '../../systems/progression/stats.js';
import { findOrCreatePlayer } from '../../database/queries/player.js';
import { getEquippedItems } from '../../database/queries/inventory.js';
import { combatEmbed, successEmbed, errorEmbed } from '../../utils/embeds.js';
import { itemsCatalog } from '../../utils/catalog.js';
import { getNavButtons } from '../../utils/navigation.js';
import { parsePresets, buildPresetButtons } from './presets.js';
import { getCombatSkillsRow, getCombatItemsRow } from './uiHelpers.js';
import { handlePlayerTurnAction, resolveCombatEnd } from './combatResolver.js';

export async function handleCombatInteraction(
  interaction: ButtonInteraction | StringSelectMenuInteraction
) {
  try {
    await interaction.deferUpdate();

    const discordId = interaction.user.id;
    const username = interaction.user.username;

    // 1. Fetch player
    const player = await findOrCreatePlayer(discordId, username);

    // 2. Fetch active combat session
    const activeSession = await db.query.combatSessions.findFirst({
      where: eq(combatSessions.playerId, player.id)
    });

    if (!activeSession) {
      await interaction.editReply({
        content: '❌ This combat session has expired or ended.',
        embeds: [],
        components: []
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

    const scaledEnemyStats = scaleEnemyStats(enemyDef, player.level);
    const state = activeSession.state as any;

    // Inject max values in case they aren't saved
    state.playerMaxHp = playerStats.hpMax;
    state.playerMaxMana = playerStats.manaMax;
    state.enemyMaxHp = scaledEnemyStats.hp;

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
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('combat_attack').setLabel('⚔️ Attack').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('combat_defend').setLabel('🛡️ Defend').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('combat_flee').setLabel('🏃 Flee').setStyle(ButtonStyle.Danger)
    );

    const selectMenuRow = await getCombatSkillsRow(player.id, player.playerClass);
    const itemsRow = await getCombatItemsRow(player.id);
    const presetsRow = buildPresetButtons(parsePresets(player.presets), 'combat');
    const components: any[] = [row, presetsRow];
    if (selectMenuRow) components.push(selectMenuRow);
    if (itemsRow) components.push(itemsRow);

    const embed = combatEmbed(
      player.username,
      state.playerHp,
      playerStats.hpMax,
      state.playerMana,
      playerStats.manaMax,
      { name: enemyDef.name, level: enemyDef.level },
      state.enemyHp,
      state.enemyMaxHp,
      state.round,
      state.combatLog
    );

    await interaction.editReply({
      embeds: [embed],
      components: components as any[]
    });

  } catch (error) {
    console.error('Failed to handle combat interaction:', error);
    try {
      await interaction.followUp({
        embeds: [errorEmbed('Combat Error', 'Something went wrong during combat. Please try `/fight` to resume.')],
        ephemeral: true
      });
    } catch {}
  }
}
