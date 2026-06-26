import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction
} from 'discord.js';
import { executeRest } from '../../systems/exploration/restService.js';
import { errorEmbed } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('rest')
  .setDescription('Rest at a nearby inn or settlement to fully restore your stamina.');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    const result = await executeRest(interaction.user.id);
    if (!result.success) {
      const err = errorEmbed('Rest Error', result.error || 'Failed to rest.');
      await interaction.editReply({ embeds: [err] });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x10B981)
      .setTitle(`Rested at ${result.locationName}`)
      .setDescription(result.message || 'You wake up fully refreshed.')
      .setFooter({ text: 'Arcanora — You can rest again in 2 minutes' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Error executing /rest:', error);
    const err = errorEmbed('Rest Error', 'Something went wrong while resting.');
    await interaction.editReply({ embeds: [err] });
  }
}