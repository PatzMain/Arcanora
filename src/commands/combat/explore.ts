import { logger } from '../../utils/logger.js';
import {
  type ChatInputCommandInteraction,
  type ButtonInteraction
} from 'discord.js';
import { errorEmbed } from '../../utils/embeds.js';

export async function runExplore(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  zoneId?: string
) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      if (interaction.isButton() || interaction.isStringSelectMenu()) {
        await interaction.deferUpdate();
      } else {
        await interaction.deferReply();
      }
    }

    const embed = errorEmbed(
      'Feature Removed',
      '❌ The Explore feature has been removed.\n\nPlease use `/map` and click the **Hunt** button to fight monsters, or travel to a Dungeon!'
    );
    await interaction.editReply({ embeds: [embed], components: [] });
  } catch (error: any) {
    logger.error({ err: error }, 'Unexpected error');
    try {
      const embed = errorEmbed('Exploration Error', 'Failed to complete exploration.');
      await interaction.editReply({ embeds: [embed], components: [] });
    } catch {}
  }
}
