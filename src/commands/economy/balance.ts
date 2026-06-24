import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { findOrCreatePlayer } from '../../database/queries/player.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('balance')
  .setDescription('View your gold and gem balances.');

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply();

    const discordId = interaction.user.id;
    const username = interaction.user.username;

    // Load player
    const player = await findOrCreatePlayer(discordId, username);

    const embed = successEmbed(
      'Wallet Balance',
      `💰 **${player.username}'s Pouch**\n\n` +
      `🪙 Gold: **${player.gold.toLocaleString()}**\n` +
      `💎 Gems: **${player.gems.toLocaleString()}**`
    );
    embed.setColor(0xFFD700); // Set gold color

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    console.error(error);
    const embed = errorEmbed('Balance Error', 'Failed to retrieve your currency balances.');
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}
