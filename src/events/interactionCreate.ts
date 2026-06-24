import { type Interaction, MessageFlags } from 'discord.js';
import { commandsList } from './ready.js';
import { handleCombatInteraction } from '../systems/combat/handler.js';
import { errorEmbed } from '../utils/embeds.js';
import { logger } from '../utils/logger.js';
import { getPlayerByDiscordId } from '../database/queries/player.js';

export async function execute(interaction: Interaction) {
  // 1. Handle Slash Commands
  if (interaction.isChatInputCommand()) {
    const cmdName = interaction.commandName;
    const command = commandsList.find((c) => c.data.name === cmdName);

    if (!command) {
      logger.warn(`Received command with no matching executor: ${cmdName}`);
      return;
    }

    try {
      // Access Control: check if player profile exists
      if (cmdName !== 'tutorial' && cmdName !== 'invite') {
        const player = await getPlayerByDiscordId(interaction.user.id);
        if (!player) {
          const embed = errorEmbed(
            '🌌 Welcome to Arcanora!',
            'Before you can start your adventure, you need to create a profile and learn the basics.\n\n' +
            'Please run the **/tutorial** command to begin!'
          );
          embed.setColor(0x7C3AED); // Premium purple onboarding theme
          await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
          return;
        }
      }

      await command.execute(interaction);
    } catch (error) {
      logger.error({ error, commandName: cmdName }, 'Error executing slash command');
      const embed = errorEmbed('Command Error', 'An unexpected error occurred while executing this command.');
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
      } else {
        await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
      }
    }
    return;
  }

  // 2. Handle Combat Interactions (Buttons & Select Menus)
  if (interaction.isButton() || interaction.isStringSelectMenu()) {
    if (interaction.customId.startsWith('combat_')) {
      try {
        await handleCombatInteraction(interaction);
      } catch (error) {
        logger.error({ error, customId: interaction.customId }, 'Error processing combat interaction');
      }
    }
  }
}
