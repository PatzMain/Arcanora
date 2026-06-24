import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
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

    const embed = successEmbed(
      'Prestige Successful!',
      `You have ascended to **Prestige ${nextPrestige}**!\n\n` +
      `**Resets Applied:**\n` +
      `⭐ Level: 1\n` +
      `✨ EXP: 0\n\n` +
      `**Ascension Rewards:**\n` +
      rewardsText + `\n\n` +
      `*You now receive a permanent **+${nextPrestige * 5}%** bonus to all combat stats.*`
    );

    await interaction.editReply({ embeds: [embed] });
    return;
  } catch (error: any) {
    console.error(error);
    const embed = errorEmbed('Prestige Error', 'An unexpected error occurred during prestige reset.');
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
    return;
  }
}
