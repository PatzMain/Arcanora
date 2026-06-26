import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  type ChatInputCommandInteraction
} from 'discord.js';
import { db } from '../../database/client.js';
import { worldBosses, bossParticipants, players, playerSkills } from '../../database/schema.js';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { getEnemyById } from './enemy.js';
import { calculateBossRewards } from '../bosses.js';
import { getEquippedItems, addItem } from '../../database/queries/inventory.js';
import { computeStats } from '../progression/stats.js';
import { findOrCreatePlayer } from '../../database/queries/player.js';
import { resolveLoot } from '../exploration/loot.js';
import { executeSkill, getSkillById, SKILLS } from './skills.js';
import { calculateDamage } from './engine.js';
import { itemsCatalog } from '../../utils/catalog.js';
import { bossSkirmishEmbed, bossVictoryEmbed, errorEmbed, successEmbed } from '../../utils/embeds.js';
import { parsePresets, buildPresetButtons } from './presets.js';

export async function runBossFight(interaction: ChatInputCommandInteraction): Promise<void> {
  const channelId = interaction.channelId || '';
  const discordId = interaction.user.id;
  const username = interaction.user.username;

  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply();
  }

  // Load active boss in this channel
  let activeBoss = await db.query.worldBosses.findFirst({
    where: and(
      eq(worldBosses.channelId, channelId),
      isNull(worldBosses.defeatedAt)
    )
  });

  // Fallback to global boss
  if (!activeBoss) {
    activeBoss = await db.query.worldBosses.findFirst({
      where: and(
        eq(worldBosses.channelId, 'GLOBAL'),
        isNull(worldBosses.defeatedAt)
      )
    });
  }

  if (!activeBoss) {
    const embed = errorEmbed(
      'No Active Boss',
      'There is no active World Boss in this channel. Ask an administrator to spawn one using `/spawn-boss`!'
    );
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const enemyDef = getEnemyById(activeBoss.bossId);
  if (!enemyDef) {
    const embed = errorEmbed('Boss Error', 'The active boss definition is missing.');
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Load player profile
  const player = await findOrCreatePlayer(discordId, username);

  if (player.hpCurrent <= 0) {
    const embed = errorEmbed(
      'Defeated',
      'You are currently at **0 HP** and cannot fight. Use `/daily` or wait to recover your health!'
    );
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Load player stats & equipment
  const equippedDbItems = await getEquippedItems(player.id);
  const equippedItemsList = equippedDbItems.map((dbItem) => {
    const def = itemsCatalog.find((i) => i.id === dbItem.itemId);
    return { slot: def?.type || 'accessory', rarity: def?.rarity || 'common', stats: def?.stats || {} };
  });
  const playerStats = computeStats(player.level, player.prestige, player.playerClass, equippedItemsList, null, []);

  // Fresh combat log
  const isGlobal = activeBoss.channelId === 'GLOBAL';
  const bossPrefix = isGlobal ? 'Global World Boss' : 'World Boss';
  const combatLog = [`You stepped forward to challenge the ${bossPrefix}!`];

  // Build components
  const getActionRows = async (playerPresets: any) => {
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('boss_attack').setLabel('⚔️ Attack').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('boss_leave').setLabel('🏃 Leave').setStyle(ButtonStyle.Danger)
    );

    const presetsRow = buildPresetButtons(parsePresets(playerPresets), 'boss', player.playerClass);

    // Fetch learned skills
    const learned = await db.select().from(playerSkills).where(eq(playerSkills.playerId, player.id));
    const options = learned.map((l) => {
      const skillDef = SKILLS.find((s) => s.id === l.skillId);
      if (!skillDef) return null;
      return {
        label: skillDef.name,
        description: `Cost: ${skillDef.manaCost} Mana | ${skillDef.description.slice(0, 50)}`,
        value: skillDef.id
      };
    }).filter(Boolean) as { label: string; description: string; value: string }[];

    if (options.length > 0) {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('boss_use_skill')
        .setPlaceholder('🌀 Cast a combat skill...')
        .addOptions(options);
      return [buttons, presetsRow, new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)];
    }

    return [buttons, presetsRow];
  };

  const embed = bossSkirmishEmbed(
    { name: enemyDef.name, level: enemyDef.level, isGlobal },
    activeBoss.hpCurrent,
    activeBoss.hpMax,
    {
      username: player.username,
      hpCurrent: player.hpCurrent,
      hpMax: playerStats.hpMax,
      manaCurrent: player.manaCurrent,
      manaMax: playerStats.manaMax
    },
    combatLog
  );

  const actionRows = await getActionRows(player.presets);
  const response = await interaction.editReply({
    embeds: [embed],
    components: actionRows
  });

  let round = 1;
  while (true) {
    try {
      const compInteraction = await response.awaitMessageComponent({
        filter: (i) => i.user.id === interaction.user.id,
        time: 60_000
      });

      // Fetch fresh boss state
      const freshBoss = await db.query.worldBosses.findFirst({
        where: eq(worldBosses.id, activeBoss.id)
      });

      if (!freshBoss || freshBoss.defeatedAt) {
        const finishedEmbed = errorEmbed('Boss Slain', 'The World Boss has already been defeated!');
        await compInteraction.update({ embeds: [finishedEmbed], components: [] });
        break;
      }

      // Fetch fresh player state
      const freshPlayer = await db.query.players.findFirst({
        where: eq(players.id, player.id)
      });

      if (!freshPlayer || freshPlayer.hpCurrent <= 0) {
        const defeatedEmbed = errorEmbed('Defeated', 'You have been defeated and cannot continue.');
        await compInteraction.update({ embeds: [defeatedEmbed], components: [] });
        break;
      }

      let playerDmg = 0;
      let playerHeal = 0;
      let manaCost = 0;
      let logMsg = '';

      if (compInteraction.isButton()) {
        if (compInteraction.customId === 'boss_leave') {
          const leaveEmbed = successEmbed('Retreated', 'You retreated from the World Boss battle.');
          await compInteraction.update({ embeds: [leaveEmbed], components: [] });
          break;
        }

        if (compInteraction.customId === 'boss_attack') {
          // Basic attack
          const result = calculateDamage(playerStats.attack, enemyDef.stats.defense, playerStats.critChance, playerStats.critDmg);
          playerDmg = result.damage;
          logMsg = result.isCrit
            ? `💥 **CRITICAL HIT!** You dealt **${playerDmg}** damage!`
            : `⚔️ You hit for **${playerDmg}** damage.`;
        } else if (compInteraction.customId.startsWith('boss_preset_')) {
          const slotNum = parseInt(compInteraction.customId.split('_')[2] || '1', 10);
          const parsedPresets = parsePresets(freshPlayer.presets);
          const slot = parsedPresets[slotNum - 1];
          if (!slot || !slot.actions || slot.actions.length === 0) {
            await compInteraction.reply({ content: '❌ Preset slot is empty or invalid.', ephemeral: true });
            continue;
          }

          // Fetch learned skills
          const learnedSkillsDb = await db.select().from(playerSkills).where(eq(playerSkills.playerId, freshPlayer.id));
          const learnedSkillIds = learnedSkillsDb.map((s) => s.skillId);

          // Determine the action index based on the current round (1-indexed)
          const actionIndex = (round - 1) % slot.actions.length;
          const actionId = slot.actions[actionIndex] || 'attack';

          logMsg = `⚡ **Preset ${slot.name}** (Step ${actionIndex + 1}/${slot.actions.length}):\n`;

          if (actionId === 'attack') {
            const result = calculateDamage(playerStats.attack, enemyDef.stats.defense, playerStats.critChance, playerStats.critDmg);
            playerDmg = result.damage;
            logMsg += result.isCrit
              ? `💥 **CRITICAL HIT!** You dealt **${playerDmg}** damage!`
              : `⚔️ You hit for **${playerDmg}** damage.`;
          } else {
            // Skill!
            const skillDef = getSkillById(actionId);
            if (!skillDef) {
              await compInteraction.reply({ content: `❌ Skill definition for "${actionId}" not found.`, ephemeral: true });
              continue;
            }

            if (!learnedSkillIds.includes(actionId)) {
              await compInteraction.reply({ content: `❌ You have not learned "${skillDef.name}".`, ephemeral: true });
              continue;
            }

            if (freshPlayer.manaCurrent < skillDef.manaCost) {
              await compInteraction.reply({ content: `❌ Not enough Mana! Required: ${skillDef.manaCost}, Current: ${freshPlayer.manaCurrent}`, ephemeral: true });
              continue;
            }

            manaCost = skillDef.manaCost;

            const dummyEnemyStats = {
              hp: freshBoss.hpCurrent,
              maxHp: freshBoss.hpMax,
              mana: 0,
              maxMana: 0,
              attack: enemyDef.stats.attack,
              defense: enemyDef.stats.defense,
              speed: enemyDef.stats.speed,
              critChance: 5,
              critDmg: 150,
              luck: 0
            };

            const singleCastStats: import('./engine.js').CombatStats = {
              hp: freshPlayer.hpCurrent,
              maxHp: playerStats.hpMax,
              mana: freshPlayer.manaCurrent,
              maxMana: playerStats.manaMax,
              attack: playerStats.attack,
              defense: playerStats.defense,
              speed: playerStats.speed,
              critChance: playerStats.critChance,
              critDmg: playerStats.critDmg,
              luck: playerStats.luck,
            };
            const skillResult = executeSkill(skillDef, singleCastStats, dummyEnemyStats);
            playerDmg = skillResult.damage;
            playerHeal = skillResult.healing;
            logMsg += `🌀 You cast **${skillDef.name}**! ${skillResult.description}`;
          }
        }
      } else if (compInteraction.isStringSelectMenu()) {
        if (compInteraction.customId === 'boss_use_skill') {
          const skillId = compInteraction.values[0]!;
          const skillDef = getSkillById(skillId);

          if (!skillDef) {
            await compInteraction.reply({ content: '❌ Skill not found.', ephemeral: true });
            continue;
          }

          if (freshPlayer.manaCurrent < skillDef.manaCost) {
            await compInteraction.reply({ content: `❌ Not enough Mana! Required: ${skillDef.manaCost}`, ephemeral: true });
            continue;
          }

          manaCost = skillDef.manaCost;

          const dummyEnemyStats = {
            hp: freshBoss.hpCurrent,
            maxHp: freshBoss.hpMax,
            mana: 0,
            maxMana: 0,
            attack: enemyDef.stats.attack,
            defense: enemyDef.stats.defense,
            speed: enemyDef.stats.speed,
            critChance: 5,
            critDmg: 150,
            luck: 0
          };

          const singleCastStats: import('./engine.js').CombatStats = {
            hp: freshPlayer.hpCurrent,
            maxHp: playerStats.hpMax,
            mana: freshPlayer.manaCurrent,
            maxMana: playerStats.manaMax,
            attack: playerStats.attack,
            defense: playerStats.defense,
            speed: playerStats.speed,
            critChance: playerStats.critChance,
            critDmg: playerStats.critDmg,
            luck: playerStats.luck,
          };
          const skillResult = executeSkill(skillDef, singleCastStats, dummyEnemyStats);
          playerDmg = skillResult.damage;
          playerHeal = skillResult.healing;
          logMsg = `🌀 You cast **${skillDef.name}**! ${skillResult.description}`;
        }
      }

      // Calculate Boss counter attack
      const bossResult = calculateDamage(enemyDef.stats.attack, playerStats.defense, 5, 150);
      const bossDmg = bossResult.damage;
      const bossLog = bossResult.isCrit
        ? `🔥 **CRITICAL STRIKE!** Boss retaliated for **${bossDmg}** damage!`
        : `🦖 Boss hit you back for **${bossDmg}** damage.`;

      // Deduct Boss HP
      const nextBossHp = Math.max(0, freshBoss.hpCurrent - playerDmg);

      // Update Player HP & Mana
      const nextPlayerHp = Math.max(0, freshPlayer.hpCurrent + playerHeal - bossDmg);
      const nextPlayerMana = Math.max(0, freshPlayer.manaCurrent - manaCost);

      // Apply DB Updates
      await db
        .update(worldBosses)
        .set({ hpCurrent: nextBossHp })
        .where(eq(worldBosses.id, freshBoss.id));

      await db
        .update(players)
        .set({ hpCurrent: nextPlayerHp, manaCurrent: nextPlayerMana })
        .where(eq(players.id, freshPlayer.id));

      // Log Damage Contribution
      if (playerDmg > 0) {
        await db
          .insert(bossParticipants)
          .values({
            bossInstanceId: freshBoss.id,
            playerId: freshPlayer.id,
            damageDealt: playerDmg
          })
          .onConflictDoUpdate({
            target: [bossParticipants.bossInstanceId, bossParticipants.playerId],
            set: {
              damageDealt: sql`${bossParticipants.damageDealt} + ${playerDmg}`
            }
          });
      }

      combatLog.push(logMsg);
      combatLog.push(bossLog);

      if (nextBossHp <= 0) {
        // Boss Slain!
        await db
          .update(worldBosses)
          .set({ defeatedAt: new Date() })
          .where(eq(worldBosses.id, freshBoss.id));

        // Fetch all participants
        const participants = await db
          .select({
            playerId: bossParticipants.playerId,
            damageDealt: bossParticipants.damageDealt,
            username: players.username
          })
          .from(bossParticipants)
          .innerJoin(players, eq(bossParticipants.playerId, players.id))
          .where(eq(bossParticipants.bossInstanceId, freshBoss.id));

        const totalDamage = participants.reduce((sum, p) => sum + p.damageDealt, 0);
        const mvp = participants.length > 0 ? participants.reduce((max, p) => p.damageDealt > max.damageDealt ? p : max, participants[0]!) : undefined;

        const sortedRankings = [...participants]
          .sort((a, b) => b.damageDealt - a.damageDealt)
          .map((p, idx) => ({
            playerId: p.playerId,
            username: p.username,
            damageDealt: p.damageDealt,
            rank: idx + 1,
            percent: Math.round((p.damageDealt / Math.max(1, totalDamage)) * 100)
          }));

        const rewardsList = [];
        for (const p of participants) {
          const pl = await db.query.players.findFirst({
            where: eq(players.id, p.playerId)
          });
          if (!pl) continue;

          const isMvp = mvp ? p.playerId === mvp.playerId : false;
          const rewards = calculateBossRewards(
            isMvp ? p.damageDealt : totalDamage,
            p.damageDealt,
            enemyDef.level
          );

          await db
            .update(players)
            .set({
              gold: pl.gold + rewards.gold
            })
            .where(eq(players.id, pl.id));

          // Determine loot roll chance based on rank on the leaderboard
          const rankInfo = sortedRankings.find((sr) => sr.playerId === p.playerId);
          const rank = rankInfo ? rankInfo.rank : 99;

          let lootChance = 0;
          if (rank === 1) lootChance = 100;
          else if (rank === 2) lootChance = 80;
          else if (rank === 3) lootChance = 65;
          else if (rank === 4) lootChance = 50;
          else if (rank === 5) lootChance = 35;
          else {
            const dmgPct = (p.damageDealt / Math.max(1, totalDamage)) * 100;
            lootChance = Math.max(5, Math.min(20, Math.round(dmgPct)));
          }

          let gotBonusLoot = false;
          const rolledValue = Math.random() * 100;
          if (rolledValue <= lootChance) {
            const eqItems = await getEquippedItems(pl.id);
            const eqList = eqItems.map((dbItem) => {
              const def = itemsCatalog.find((i) => i.id === dbItem.itemId);
              return { slot: def?.type || 'accessory', rarity: def?.rarity || 'common', stats: def?.stats || {} };
            });
            const plStats = computeStats(pl.level, pl.prestige, pl.playerClass, eqList, null, []);
            const loot = resolveLoot(enemyDef.lootTable, plStats.luck, 'boss');

            if (loot.length > 0) {
              gotBonusLoot = true;
              for (const drop of loot) {
                await addItem(pl.id, drop.itemId, drop.quantity);
              }
            }
          }

          rewardsList.push({
            username: p.username,
            gold: rewards.gold,
            exp: 0,
            bonusLoot: gotBonusLoot
          });
        }

        const victoryEmbed = bossVictoryEmbed(
          { name: enemyDef.name, level: enemyDef.level, isGlobal },
          mvp?.username ?? 'Unknown',
          sortedRankings,
          rewardsList
        );

        if (interaction.channel && 'send' in interaction.channel) {
          await interaction.channel.send({ embeds: [victoryEmbed] });
        }
        await compInteraction.update({ embeds: [victoryEmbed], components: [] });
        break;
      }

      if (nextPlayerHp <= 0) {
        // Player Defeated!
        const recoveryHp = Math.round(playerStats.hpMax * 0.1);
        await db
          .update(players)
          .set({ hpCurrent: recoveryHp, manaCurrent: 10 })
          .where(eq(players.id, freshPlayer.id));

        const defeatEmbed = errorEmbed(
          'Defeat!',
          `💀 You were defeated by the ${bossPrefix} **${enemyDef.name}**!\n\n` +
          `*You woke up in town, feeling weak. You recovered **${recoveryHp}** HP.*`
        );

        await compInteraction.update({ embeds: [defeatEmbed], components: [] });
        break;
      }

      // Update message for next turn
      const nextEmbed = bossSkirmishEmbed(
        { name: enemyDef.name, level: enemyDef.level, isGlobal },
        nextBossHp,
        freshBoss.hpMax,
        {
          username: freshPlayer.username,
          hpCurrent: nextPlayerHp,
          hpMax: playerStats.hpMax,
          manaCurrent: nextPlayerMana,
          manaMax: playerStats.manaMax
        },
        combatLog
      );

      await compInteraction.update({
        embeds: [nextEmbed],
        components: actionRows
      });

      round++;

    } catch {
      // Skirmish Timed Out
      const disabledMenu = new StringSelectMenuBuilder()
        .setCustomId('boss_select_timeout')
        .setPlaceholder('Raid interaction timed out')
        .setDisabled(true)
        .addOptions({ label: 'Timed out', value: 'timeout' });
      const disabledRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(disabledMenu);

      try {
        await interaction.editReply({ components: [disabledRow] });
      } catch {}
      break;
    }
  }
}
