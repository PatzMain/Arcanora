import { logger } from '../../utils/logger.js';
import {
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  type ChatInputCommandInteraction,
  type ButtonInteraction
} from 'discord.js';
import { findOrCreatePlayer } from '../../database/queries/player.js';
import { canPrestige, getPrestigeRewards, calculatePrestigeReset } from '../../systems/progression/prestige.js';
import { db } from '../../database/client.js';
import { players } from '../../database/schema.js';
import { eq } from 'drizzle-orm';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { getNavButtons } from '../../utils/navigation.js';

export async function runPrestige(
  interaction: ChatInputCommandInteraction | ButtonInteraction
) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      if (interaction.isButton() || interaction.isStringSelectMenu()) {
        await interaction.deferUpdate();
      } else {
        await interaction.deferReply();
      }
    }

    const player = await findOrCreatePlayer(interaction.user.id, interaction.user.username);

    if (!canPrestige(player.level)) {
      const embed = errorEmbed(
        'Prestige Denied',
        `You must reach Level 20 to prestige. Current level: **${player.level}**.`
      );
      await interaction.editReply({ embeds: [embed], components: [] });
      return;
    }

    const nextPrestige = player.prestige + 1;
    const resetRules = calculatePrestigeReset();
    const rewards = getPrestigeRewards(nextPrestige);

    const baseNewGold = Math.floor(player.gold * resetRules.gold);
    const finalNewGold = baseNewGold + rewards.gold;

    const confirmEmbed = errorEmbed(
      'Ascension Call — Confirm Prestige',
      `You are about to ascend to **Prestige ${nextPrestige}**. This action is **irreversible**!\n\n` +
      `**Resets Applied:**\n` +
      `❌ Level: **${player.level}** ➡️ **1**\n` +
      `❌ EXP: **${player.exp}** ➡️ **0**\n` +
      `❌ Gold: **${player.gold.toLocaleString()}** ➡️ **${finalNewGold.toLocaleString()}** (90% reduction, +${rewards.gold.toLocaleString()} reward)\n\n` +
      `**Rewards Unlocked:**\n` +
      `💎 Gems: +**${rewards.gems}**\n` +
      (rewards.title ? `🏅 Title: **"${rewards.title}"**\n` : '') +
      `⭐ Permanent stat bonus: **+${nextPrestige * 5}%** (up from +${player.prestige * 5}%)\n\n` +
      `Click **Ascend** to proceed, or **Cancel** to keep your character level.`
    );
    confirmEmbed.setColor(0xF59E0B);

    const confirmBtn = new ButtonBuilder()
      .setCustomId(`prestige_confirm_${player.discordId}`)
      .setLabel('Ascend (Prestige)')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('⭐');

    const cancelBtn = new ButtonBuilder()
      .setCustomId(`prestige_cancel_${player.discordId}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmBtn, cancelBtn);

    await interaction.editReply({
      embeds: [confirmEmbed],
      components: [row]
    });
  } catch (error) {
    logger.error({ err: error }, 'Error running prestige:');
    const embed = errorEmbed('Prestige Error', 'An unexpected error occurred during prestige reset.');
    await interaction.editReply({ embeds: [embed], components: [] });
  }
}

export async function handlePrestigeInteraction(interaction: ButtonInteraction) {
  const parts = interaction.customId.split('_'); // prestige_confirm_{userId} or prestige_cancel_{userId}
  const action = parts[1];
  const userId = parts[2];

  if (interaction.user.id !== userId) return;

  const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('prestige_confirm_dis').setLabel('Ascend (Prestige)').setStyle(ButtonStyle.Danger).setEmoji('⭐').setDisabled(true),
    new ButtonBuilder().setCustomId('prestige_cancel_dis').setLabel('Cancel').setStyle(ButtonStyle.Secondary).setDisabled(true)
  );

  try {
    const player = await findOrCreatePlayer(interaction.user.id, interaction.user.username);

    if (action === 'confirm') {
      if (!canPrestige(player.level)) {
        const embed = errorEmbed('Prestige Denied', 'Your character state has changed and you can no longer prestige.');
        await interaction.update({ embeds: [embed], components: [disabledRow] });
        return;
      }

      const nextPrestige = player.prestige + 1;
      const resetRules = calculatePrestigeReset();
      const rewards = getPrestigeRewards(nextPrestige);

      const baseNewGold = Math.floor(player.gold * resetRules.gold);
      const finalNewGold = baseNewGold + rewards.gold;
      const finalNewGems = player.gems + rewards.gems;

      await db
        .update(players)
        .set({
          level: resetRules.level,
          exp: resetRules.exp,
          gold: finalNewGold,
          gems: finalNewGems,
          prestige: nextPrestige,
          hpCurrent: 100,
          manaCurrent: 50
        })
        .where(eq(players.id, player.id));

      let rewardsText = `🪙 Gold: Reset to 10% (**${baseNewGold.toLocaleString()}**), then rewarded +**${rewards.gold.toLocaleString()}** (Total: **${finalNewGold.toLocaleString()}**)\n💎 Gems: +**${rewards.gems}**`;
      if (rewards.title) {
        rewardsText += `\n🏅 Unlocked Title: **"${rewards.title}"**`;
      }

      const successEm = successEmbed(
        'Prestige Successful!',
        `You have ascended to **Prestige ${nextPrestige}**!\n\n` +
        `**Resets Applied:**\n` +
        `⭐ Level: 1\n` +
        `✨ EXP: 0\n\n` +
        `**Ascension Rewards:**\n` +
        rewardsText + `\n\n` +
        `*You now receive a permanent **+${nextPrestige * 5}%** bonus to all combat stats.*`
      );

      const navRow = getNavButtons('player_prestige_result', player.discordId);

      await interaction.update({
        embeds: [successEm],
        components: navRow ? [navRow] : []
      });
    } else {
      const cancelEmbed = errorEmbed('Prestige Cancelled', 'You chose not to prestige. Your progress has been preserved.');
      cancelEmbed.setColor(0x9CA3AF);

      const navRow = getNavButtons('player_prestige_result', player.discordId);

      await interaction.update({
        embeds: [cancelEmbed],
        components: navRow ? [navRow] : []
      });
    }
  } catch (error) {
    logger.error({ err: error }, 'Error handling prestige button:');
    await interaction.followUp({ content: '❌ Failed to process prestige action.', ephemeral: true });
  }
}
