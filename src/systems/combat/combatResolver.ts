import {
  type ButtonInteraction,
  type StringSelectMenuInteraction,
  ButtonStyle,
  ActionRowBuilder,
  ButtonBuilder,
} from 'discord.js';
import { db } from '../../database/client.js';
import { combatSessions, players, playerSkills, inventory } from '../../database/schema.js';
import { eq } from 'drizzle-orm';
import { executeSkill, getSkillById } from './skills.js';
import { type CombatStats, type CombatAction, getStatModifier } from './engine.js';
import { removeItem, addItem } from '../../database/queries/inventory.js';
import { itemsCatalog } from '../../utils/catalog.js';
import { itemBehaviorRegistry } from '../items/itemBehavior.js';
import { parsePresets } from './presets.js';
import { awardGold } from '../../economy/currency.js';
import { awardPlayerExp } from '../../database/queries/player.js';
import { resolveLoot, getItemData } from '../../systems/exploration/loot.js';
import { lootEmbed, errorEmbed } from '../../utils/embeds.js';
import { advanceQuestProgress } from '../progression/questSystem.js';
import { getNavButtons } from '../../utils/navigation.js';

export async function handlePlayerTurnAction(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  player: any,
  state: any,
  combatStats: CombatStats,
  scaledEnemyStats: any,
  _enemyDef: any
): Promise<CombatAction | null> {
  let action: CombatAction = { type: 'attack' };

  if (interaction.isButton()) {
    if (interaction.customId === 'combat_attack') {
      state.activePresetSlot = undefined;
      action = { type: 'attack' };
    } else if (interaction.customId === 'combat_defend') {
      state.activePresetSlot = undefined;
      action = { type: 'defend' };
    } else if (interaction.customId === 'combat_flee') {
      state.activePresetSlot = undefined;
      action = { type: 'flee' };
    } else if (interaction.customId.startsWith('combat_preset_')) {
      const slotNum = parseInt(interaction.customId.split('_')[2] || '1', 10);
      state.activePresetSlot = slotNum;
      const presets = parsePresets(player.presets);
      const slot = presets[slotNum - 1];
      if (!slot || !slot.actions || slot.actions.length === 0) {
        await interaction.followUp({ content: '❌ Preset slot is empty or invalid.', ephemeral: true });
        return null;
      }

      // Fetch learned skills
      const learnedSkillsDb = await db.select().from(playerSkills).where(eq(playerSkills.playerId, player.id));
      const learnedSkillIds = learnedSkillsDb.map((s) => s.skillId);

      // Determine the action index based on the current round (1-indexed)
      const actionIndex = (state.round - 1) % slot.actions.length;
      const actionId = slot.actions[actionIndex] || 'attack';

      state.combatLog.push(`⚡ Preset **${slot.name}** (Step ${actionIndex + 1}/${slot.actions.length}):`);

      if (actionId === 'attack') {
        action = { type: 'attack' };
      } else {
        // Skill execution
        const skillDef = getSkillById(actionId);
        if (!skillDef) {
          await interaction.followUp({ content: `❌ Skill definition for "${actionId}" not found.`, ephemeral: true });
          return null;
        }

        if (!learnedSkillIds.includes(actionId)) {
          await interaction.followUp({ content: `❌ You have not learned "${skillDef.name}".`, ephemeral: true });
          return null;
        }

        if (state.playerMana < skillDef.manaCost) {
          await interaction.followUp({ content: `❌ Not enough Mana! Required: ${skillDef.manaCost}, Current: ${state.playerMana}`, ephemeral: true });
          return null;
        }

        // Deduct Mana
        state.playerMana -= skillDef.manaCost;

        // Calculate effective stats for this action (layer active buffs dynamically)
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

        // Execute skill effects
        const result = executeSkill(skillDef, currentStats, enemyCombatStats);

        // Apply skill damage / healing / buffs
        if (skillDef.id === 'healer_purify') {
          state.playerBuffs = state.playerBuffs.filter((b: any) => b.type !== 'debuff');
        }

        if (skillDef.id === 'mage_mana_surge') {
          state.playerMana = Math.min(state.playerMaxMana, state.playerMana + result.healing);
        } else {
          state.playerHp = Math.min(state.playerMaxHp, state.playerHp + result.healing);
        }

        state.enemyHp = Math.max(0, state.enemyHp - result.damage);

        // Add status effects
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

        state.combatLog.push(result.description);

        // Set action type to skill so processPlayerTurn doesn't recalculate base attack/skills
        action = { type: 'skill', skillId: skillDef.name };
      }
    }
  } else if (interaction.isStringSelectMenu()) {
    state.activePresetSlot = undefined;
    if (interaction.customId === 'combat_use_skill') {
      const skillId = interaction.values[0]!;
      const skillDef = getSkillById(skillId);

      if (!skillDef) {
        await interaction.followUp({ content: '❌ Skill not found in database.', ephemeral: true });
        return null;
      }

      if (state.playerMana < skillDef.manaCost) {
        await interaction.followUp({ content: `❌ Not enough Mana! Required: ${skillDef.manaCost}`, ephemeral: true });
        return null;
      }

      // Deduct Mana
      state.playerMana -= skillDef.manaCost;

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

      // Execute skill effects
      const result = executeSkill(skillDef, combatStats, enemyCombatStats);

      // Apply skill damage / healing / buffs
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
        if (eff.stat) { // If it's a stat buff/debuff
          const effectTarget = skillDef.effects.find((e) => e.stat === eff.stat)?.target;
          if (effectTarget === 'self') {
            state.playerBuffs.push(eff);
          } else {
            state.enemyBuffs.push(eff);
          }
        } else {
          // DoT / HoT
          const effectType = skillDef.effects.find((e) => e.type === 'dot' || e.type === 'hot')?.type;
          if (effectType === 'hot') {
            state.playerBuffs.push(eff);
          } else {
            state.enemyBuffs.push(eff);
          }
        }
      }

      action = { type: 'skill', skillId };
      state.combatLog.push(result.description);
    } else if (interaction.customId === 'combat_use_item') {
      const inventoryId = interaction.values[0]!;
      const dbItem = await db.query.inventory.findFirst({
        where: eq(inventory.id, inventoryId)
      });

      if (!dbItem || dbItem.quantity <= 0) {
        await interaction.followUp({ content: '❌ Item not found in bag.', ephemeral: true });
        return null;
      }

      const itemDef = itemsCatalog.find((i) => i.id === dbItem.itemId);
      if (!itemDef || itemDef.type !== 'consumable') {
        await interaction.followUp({ content: '❌ Item is not consumable.', ephemeral: true });
        return null;
      }

      // Apply item effects
      const customBehavior = itemBehaviorRegistry.get(itemDef.id);
      if (customBehavior) {
        const result = await customBehavior.onUse({
          playerId: player.id,
          state: state,
          itemDef,
          dbItem
        });
        if (!result.success) {
          await interaction.followUp({ content: `❌ Failed to use item: ${result.log || 'Unknown error'}`, ephemeral: true });
          return null;
        }
      } else {
        if (itemDef.stats?.hp) {
          state.playerHp = Math.min(state.playerMaxHp, state.playerHp + itemDef.stats.hp);
        }
        if (itemDef.stats?.mana) {
          state.playerMana = Math.min(state.playerMaxMana, state.playerMana + itemDef.stats.mana);
        }
        if (itemDef.stats?.attack) {
          state.playerBuffs.push({
            id: `${itemDef.id}_buff`,
            name: `${itemDef.name} (Atk ↑)`,
            type: 'buff',
            stat: 'attack',
            value: itemDef.stats.attack,
            turnsRemaining: 3
          });
        }
      }

      // Consume 1 item
      await removeItem(player.id, dbItem.id, 1);

      action = { type: 'item', itemId: itemDef.id };
      state.combatLog.push(`🎒 You used **${itemDef.name}**!`);
    }
  }

  return action;
}

export async function resolveCombatEnd(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  player: any,
  state: any,
  activeSession: any,
  playerStats: any,
  enemyDef: any
): Promise<void> {
  // Clear session from DB
  await db.delete(combatSessions).where(eq(combatSessions.id, activeSession.id));

  if (state.playerWon) {
    // Victory!
    const luck = playerStats.luck;
    const lootDrops = resolveLoot(enemyDef.lootTable as any[], luck, enemyDef.rarity);

    let goldGained = enemyDef.goldReward;
    let expGained = enemyDef.expReward;
    const acquiredItems: { name: string; quantity: number; rarity: string }[] = [];

    // Apply bonus multipliers for rare/boss enemies
    if (enemyDef.rarity === 'rare') {
      goldGained = Math.round(goldGained * 1.5);
      expGained = Math.round(expGained * 1.5);
    } else if (enemyDef.rarity === 'boss') {
      goldGained = goldGained * 2;
      expGained = expGained * 2;
    }

    // Scale rewards by floor if it is a dungeon combat session
    const floor = state.floor || 1;
    if (floor > 1) {
      goldGained = Math.round(goldGained * (1 + (floor - 1) * 0.15));
      expGained = Math.round(expGained * (1 + (floor - 1) * 0.15));
    }

    // Award gold
    await awardGold(player.id, goldGained, `Defeated ${enemyDef.name}`);

    // Add items to inventory
    for (const drop of lootDrops) {
      const itemDef = getItemData(drop.itemId);
      if (itemDef) {
        await addItem(player.id, drop.itemId, drop.quantity);
        acquiredItems.push({
          name: itemDef.name,
          quantity: drop.quantity,
          rarity: itemDef.rarity
        });
      }
    }

    // Award experience
    const expResult = await awardPlayerExp(player.id, expGained);

    // If they did not level up, update their HP/Mana post-combat based on final combat state
    if (!expResult.leveledUp) {
      await db
        .update(players)
        .set({
          hpCurrent: Math.max(10, state.playerHp), // ensure they don't stay dead
          manaCurrent: state.playerMana
        })
        .where(eq(players.id, player.id));
    }

    const embed = lootEmbed(acquiredItems, goldGained, expGained);
    embed.setTitle(`🏆 Victory! Defeated ${enemyDef.name}`);
    embed.setDescription(`You successfully defeated the **Lv.${enemyDef.level} ${enemyDef.name}**.`);

    if (expResult.leveledUp) {
      embed.addFields({
        name: '🎉 LEVEL UP!',
        value: `You reached **Level ${expResult.newLevel}**! Your HP and Mana have been fully restored.`,
        inline: false
      });
    }

    // Advance quest progress for defeating the mob
    await advanceQuestProgress(player.id, 'kill', enemyDef.id, 1, interaction);

    // Codex discovery
    const { discoverEnemy } = await import('../../database/queries/codex.js');
    const codexResult = await discoverEnemy(player.id, enemyDef.id);
    if (codexResult && codexResult.isNew) {
      embed.addFields({
        name: '📖 New Codex Entry!',
        value: `You have discovered **${enemyDef.name}**! Check it out in the \`/codex enemies\`.`,
        inline: false
      });
    }

    const { buildNavId } = await import('../../utils/navigation.js');
    
    let components: any[] = [];
    if (state.explorationSessionId && state.explorationNodeId) {
      const { markNodeCleared } = await import('../../database/queries/exploration.js');
      await markNodeCleared(state.explorationSessionId, state.explorationNodeId);
      
      const continueBtn = new ButtonBuilder()
        .setCustomId(buildNavId('player_map', player.discordId))
        .setLabel('Continue Dungeon')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('➡️');
      components = [new ActionRowBuilder<ButtonBuilder>().addComponents(continueBtn)];
    } else {
      const victoryContext = state.source === 'hunt' ? 'combat_fight_victory_hunt' : 'combat_fight_victory';
      const navButtons = getNavButtons(victoryContext, player.discordId, activeSession.zoneId);
      components = navButtons ? [navButtons] : [];
    }

    await interaction.editReply({ embeds: [embed], components });
  } else {
    // Defeat!
    // Reset player current HP to 10% of max HP as a revival state
    const recoveryHp = Math.round(playerStats.hpMax * 0.1);

    await db
      .update(players)
      .set({
        hpCurrent: recoveryHp,
        manaCurrent: 10,
        currentZoneId: 'cozy_tavern'
      })
      .where(eq(players.id, player.id));

    const { getExplorationSessionByPlayerId, deleteExplorationSession } = await import('../../database/queries/exploration.js');
    const expSession = await getExplorationSessionByPlayerId(player.id);
    if (expSession) {
      await deleteExplorationSession(expSession.id);
    }

    const embed = errorEmbed(
      'Defeat!',
      `💀 You were defeated by the **Lv.${enemyDef.level} ${enemyDef.name}**!\n\n` +
      `*You woke up in town, feeling weak. You recovered **${recoveryHp}** HP.*`
    );
    const victoryContext = state.source === 'hunt' ? 'combat_fight_victory_hunt' : 'combat_fight_victory';
    const navButtons = getNavButtons(victoryContext, player.discordId, activeSession.zoneId);
    await interaction.editReply({ embeds: [embed], components: navButtons ? [navButtons] : [] });
  }
}
