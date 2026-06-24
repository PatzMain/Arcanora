import {
  type ButtonInteraction,
  type StringSelectMenuInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} from 'discord.js';
import { db } from '../../database/client.js';
import { combatSessions, players, playerSkills, inventory } from '../../database/schema.js';
import { eq, and } from 'drizzle-orm';
import { getEnemyById, scaleEnemyStats } from './enemy.js';
import { processPlayerTurn, processEnemyTurn, type CombatStats, type CombatAction, getStatModifier, calculateDamage, calculateDodgeChance } from './engine.js';
import { executeSkill, getSkillById, SKILLS } from './skills.js';
import { computeStats } from '../../systems/progression/stats.js';
import { resolveLoot, getItemData } from '../../systems/exploration/loot.js';
import { awardGold, awardGems } from '../../economy/currency.js';
import { getPlayerGuild } from '../../database/queries/guild.js';
import { findOrCreatePlayer } from '../../database/queries/player.js';
import { getEquippedItems, addItem, removeItem } from '../../database/queries/inventory.js';
import { combatEmbed, lootEmbed, errorEmbed, successEmbed } from '../../utils/embeds.js';
import { advanceQuestProgress } from '../progression/questSystem.js';
import { itemsCatalog } from '../../utils/catalog.js';
import { getNavButtons } from '../../utils/navigation.js';
import { itemBehaviorRegistry } from '../items/itemBehavior.js';
import { parsePresets, validateCombo, buildPresetButtons } from './presets.js';
import { rollChance } from '../../utils/random.js';



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
      // No active combat
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
    let action: CombatAction = { type: 'attack' };

    if (interaction.isButton()) {
      if (interaction.customId === 'combat_attack') {
        action = { type: 'attack' };
      } else if (interaction.customId === 'combat_defend') {
        action = { type: 'defend' };
      } else if (interaction.customId === 'combat_flee') {
        action = { type: 'flee' };
      } else if (interaction.customId.startsWith('combat_preset_')) {
        const slotNum = parseInt(interaction.customId.split('_')[2] || '1', 10);
        const presets = parsePresets(player.presets);
        const slot = presets[slotNum - 1];
        if (!slot) {
          await interaction.followUp({ content: '❌ Preset slot is empty or invalid.', ephemeral: true });
          return;
        }

        // Fetch learned skills
        const learnedSkillsDb = await db.select().from(playerSkills).where(eq(playerSkills.playerId, player.id));
        const learnedSkillIds = learnedSkillsDb.map((s) => s.skillId);

        // Validate combo
        const validation = validateCombo(slot, state.playerMana, learnedSkillIds);
        if (!validation.valid) {
          await interaction.followUp({ content: `❌ Combo validation failed: ${validation.error}`, ephemeral: true });
          return;
        }

        // Loop and execute actions in sequence
        state.combatLog.push(`⚡ You triggered preset combo: **${slot.name}**!`);

        for (const actionId of slot.actions) {
          if (state.enemyHp <= 0 || state.playerHp <= 0) {
            break; // Stop if either side dies mid-combo
          }

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

          if (actionId === 'attack') {
            // Check if enemy dodges
            const dodgeChance = calculateDodgeChance(currentStats.speed, scaledEnemyStats.speed);
            if (rollChance(dodgeChance)) {
              state.combatLog.push('💨 Your attack missed! The enemy dodged!');
              continue;
            }

            const { damage, isCrit } = calculateDamage(
              currentStats.attack,
              scaledEnemyStats.defense,
              currentStats.critChance,
              currentStats.critDmg
            );

            state.enemyHp = Math.max(0, state.enemyHp - damage);
            const logMsg = isCrit
              ? `💥 **CRITICAL HIT!** You deal **${damage}** damage!`
              : `⚔️ You hit for **${damage}** damage.`;
            state.combatLog.push(logMsg);
          } else {
            // It's a skill!
            const skillDef = getSkillById(actionId);
            if (!skillDef) continue;

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
          }
        }

        // Set action type to skill so processPlayerTurn doesn't recalculate base attack/skills
        action = { type: 'skill', skillId: slot.name };
      }
    } else if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'combat_use_skill') {
        const skillId = interaction.values[0]!;
        const skillDef = getSkillById(skillId);

        if (!skillDef) {
          await interaction.followUp({ content: '❌ Skill not found in database.', ephemeral: true });
          return;
        }

        if (state.playerMana < skillDef.manaCost) {
          await interaction.followUp({ content: `❌ Not enough Mana! Required: ${skillDef.manaCost}`, ephemeral: true });
          return;
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
          return;
        }

        const itemDef = catalog.find((i) => i.id === dbItem.itemId);
        if (!itemDef || itemDef.type !== 'consumable') {
          await interaction.followUp({ content: '❌ Item is not consumable.', ephemeral: true });
          return;
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
            return;
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

    // Resolve Player Turn
    const playerResult = processPlayerTurn(state, action, combatStats, scaledEnemyStats);

    // If fled successfully
    if (state.isOver && !state.playerWon && action.type === 'flee') {
      await db.delete(combatSessions).where(eq(combatSessions.id, activeSession.id));
      await db
        .update(players)
        .set({ hpCurrent: state.playerHp, manaCurrent: state.playerMana })
        .where(eq(players.id, player.id));

      const embed = successEmbed('Fled Battle', `💨 You successfully fled from the **Lv.${enemyDef.level} ${enemyDef.name}**.`);
      embed.setColor(0xF59E0B); // Amber warnings
      
      const navButtons = getNavButtons('combat_fight_victory', player.discordId, activeSession.zoneId);
      await interaction.editReply({ embeds: [embed], components: navButtons ? [navButtons] : [] });
      return;
    }

    // 4. Resolve Enemy Turn (if combat is not over)
    if (!state.isOver) {
      processEnemyTurn(state, combatStats, scaledEnemyStats, enemyDef.abilities as any[]);
    }

    // 5. Handle Combat End (Victory / Defeat)
    if (state.isOver) {
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

        // No combat EXP in quest-based progression
        await db
          .update(players)
          .set({
            hpCurrent: Math.max(10, state.playerHp), // ensure they don't stay dead
            manaCurrent: state.playerMana
          })
          .where(eq(players.id, player.id));

        const embed = lootEmbed(acquiredItems, goldGained, 0);
        embed.setTitle(`🏆 Victory! Defeated ${enemyDef.name}`);
        embed.setDescription(`You successfully defeated the **Lv.${enemyDef.level} ${enemyDef.name}**.`);

        // Advance quest progress for defeating the mob
        await advanceQuestProgress(player.id, 'kill', enemyDef.id, 1, interaction);

        const navButtons = getNavButtons('combat_fight_victory', player.discordId, activeSession.zoneId);
        await interaction.editReply({ embeds: [embed], components: navButtons ? [navButtons] : [] });
      } else {
        // Defeat!
        // Reset player current HP to 10% of max HP as a revival state
        const recoveryHp = Math.round(playerStats.hpMax * 0.1);

        await db
          .update(players)
          .set({
            hpCurrent: recoveryHp,
            manaCurrent: 10
          })
          .where(eq(players.id, player.id));

        const embed = errorEmbed(
          'Defeat!',
          `💀 You were defeated by the **Lv.${enemyDef.level} ${enemyDef.name}**!\n\n` +
          `*You woke up in town, feeling weak. You recovered **${recoveryHp}** HP.*`
        );
        const navButtons = getNavButtons('combat_fight_victory', player.discordId, activeSession.zoneId);
        await interaction.editReply({ embeds: [embed], components: navButtons ? [navButtons] : [] });
      }
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



async function getCombatSkillsRow(playerId: string, playerClass: string) {
  try {
    const learned = await db.select().from(playerSkills).where(eq(playerSkills.playerId, playerId));
    if (learned.length === 0) return null;

    const options = learned.map(l => {
      const skillDef = SKILLS.find(s => s.id === l.skillId);
      if (!skillDef) return null;
      return {
        label: skillDef.name,
        description: `Cost: ${skillDef.manaCost} Mana. ${skillDef.description.slice(0, 50)}`,
        value: skillDef.id
      };
    }).filter(Boolean);

    if (options.length === 0) return null;

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('combat_use_skill')
      .setPlaceholder('🔮 Select a Skill to cast')
      .addOptions(options as any[]);

    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
  } catch (error) {
    console.error('Failed to get combat skills:', error);
    return null;
  }
}

async function getCombatItemsRow(playerId: string) {
  try {
    const dbItems = await db.select().from(inventory).where(and(eq(inventory.playerId, playerId), eq(inventory.equipped, false)));
    const catalog = itemsCatalog;

    const consumables = dbItems.map(dbItem => {
      const def = catalog.find(i => i.id === dbItem.itemId);
      if (def && def.type === 'consumable') {
        return {
          label: `${def.name} (x${dbItem.quantity})`,
          description: def.description.slice(0, 50),
          value: dbItem.id
        };
      }
      return null;
    }).filter(Boolean);

    if (consumables.length === 0) return null;

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('combat_use_item')
      .setPlaceholder('🧪 Select a Consumable to use')
      .addOptions(consumables as any[]);

    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
  } catch (error) {
    console.error('Failed to get combat items:', error);
    return null;
  }
}


