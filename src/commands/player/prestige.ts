import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, type ChatInputCommandInteraction } from 'discord.js';
import { findOrCreatePlayer } from '../../database/queries/player.js';
import { canPrestige, getPrestigeRewards, calculatePrestigeReset } from '../../systems/progression/prestige.js';
import { db } from '../../database/client.js';
import { players } from '../../database/schema.js';
import { eq } from 'drizzle-orm';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('prestige')
  .setDescription('Reset your level to 1 for permanent stat bonuses (+5% per prestige).');

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply();

    const discordId = interaction.user.id;
    const username = interaction.user.username;

    // Load player
    const player = await findOrCreatePlayer(discordId, username);

    // Validate eligibility
    if (!canPrestige(player.level)) {
      const embed = errorEmbed(
        'Prestige Denied',
        `You must reach Level 20 to prestige. Current level: **${player.level}**.`
      );
      return interaction.editReply({ embeds: [embed] });
    }

    const nextPrestige = player.prestige + 1;
    const resetRules = calculatePrestigeReset();
    const rewards = getPrestigeRewards(nextPrestige);

    const baseNewGold = Math.floor(player.gold * resetRules.gold);
    const finalNewGold = baseNewGold + rewards.gold;
    const finalNewGems = player.gems + rewards.gems;

    // Create Warning / Confirmation Embed
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
    confirmEmbed.setColor(0xF59E0B); // Amber warning color

    const confirmBtn = new ButtonBuilder()
      .setCustomId('prestige_confirm')
      .setLabel('Ascend (Prestige)')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('⭐');

    const cancelBtn = new ButtonBuilder()
      .setCustomId('prestige_cancel')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmBtn, cancelBtn);

    const response = await interaction.editReply({
      embeds: [confirmEmbed],
      components: [row]
    });

    try {
      const confirmation = await response.awaitMessageComponent({
        filter: (i) => i.user.id === interaction.user.id,
        time: 60_000,
        componentType: ComponentType.Button
      });

      const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        confirmBtn.setDisabled(true),
        cancelBtn.setDisabled(true)
      );

      if (confirmation.customId === 'prestige_confirm') {
        // Reload player for concurrency safety
        const currentPlayer = await findOrCreatePlayer(discordId, username);
        if (!canPrestige(currentPlayer.level)) {
          const embed = errorEmbed(
            'Prestige Denied',
            `Your character state has changed and you can no longer prestige.`
          );
          await confirmation.update({ embeds: [embed], components: [disabledRow] });
          return;
        }

        // Execute atomic update
        await db
          .update(players)
          .set({
            level: resetRules.level,
            exp: resetRules.exp,
            gold: finalNewGold,
            gems: finalNewGems,
            prestige: nextPrestige,
            hpCurrent: 100, // Reset HP/Mana to base defaults
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

        await confirmation.update({ embeds: [successEm], components: [disabledRow] });
      } else {
        const cancelEmbed = errorEmbed('Prestige Cancelled', 'You chose not to prestige. Your progress has been preserved.');
        cancelEmbed.setColor(0x9CA3AF); // Neutral grey color
        await confirmation.update({ embeds: [cancelEmbed], components: [disabledRow] });
      }
    } catch (e) {
      const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        confirmBtn.setDisabled(true),
        cancelBtn.setDisabled(true)
      );
      const timeoutEmbed = errorEmbed('Prestige Timed Out', 'No response received within 60 seconds. Prestige request cancelled.');
      timeoutEmbed.setColor(0x9CA3AF);
      await interaction.editReply({
        embeds: [timeoutEmbed],
        components: [disabledRow]
      });
    }
  } catch (error: any) {
    console.error(error);
    const embed = errorEmbed('Prestige Error', 'An unexpected error occurred during prestige reset.');
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}
