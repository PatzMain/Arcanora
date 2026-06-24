import { type Interaction, MessageFlags } from 'discord.js';
import { commandsList } from './ready.js';
import { handleCombatInteraction } from '../systems/combat/handler.js';
import { handleTutorialInteraction } from '../commands/player/tutorial.js';
import { handleShopInteraction } from '../commands/economy/economy.js';
import { handleNavInteraction } from '../utils/navigation.js';
import { handleBagInteraction, handleEquipInteraction, handleSellInteraction } from '../commands/inventory/inventory.js';
import { handleQuestsInteraction, handleQuestsBoardSelect } from '../commands/quests/quest.js';
import { handlePrestigeInteraction, handlePresetInteraction } from '../commands/player/player.js';
import { handleMapTravelInteraction } from '../commands/player/map.js';
import { handleGuildInteraction, handleLeaderboardInteraction } from '../commands/guilds/guild.js';
import { errorEmbed } from '../utils/embeds.js';
import { logger } from '../utils/logger.js';
import { getPlayerWithClampedStats } from '../database/queries/player.js';
import { checkRateLimit } from '../utils/rateLimit.js';

export async function execute(interaction: Interaction) {
  // Rate Limit Check
  const rateLimitStatus = checkRateLimit(interaction.user.id);
  if (rateLimitStatus.limited) {
    if (interaction.isRepliable()) {
      const seconds = (rateLimitStatus.retryAfterMs / 1000).toFixed(1);
      const embed = errorEmbed(
        'Slow Down!',
        `You are performing actions too quickly. Please wait **${seconds}** seconds.`
      );
      await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
    }
    return;
  }
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
      if (cmdName !== 'tutorial' && cmdName !== 'invite' && cmdName !== 'help') {
        const player = await getPlayerWithClampedStats(interaction.user.id);
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

  // 2. Handle Component Interactions (Buttons & Select Menus)
  if (interaction.isButton() || interaction.isStringSelectMenu()) {
    const customId = interaction.customId;

    if (customId.startsWith('combat_')) {
      try {
        await handleCombatInteraction(interaction);
      } catch (error) {
        logger.error({ error, customId }, 'Error processing combat interaction');
      }
    } else if (customId.startsWith('shop_')) {
      try {
        await handleShopInteraction(interaction);
      } catch (error) {
        logger.error({ error, customId }, 'Error processing shop interaction');
      }
    } else if (customId.startsWith('tutorial_') && interaction.isStringSelectMenu()) {
      try {
        await handleTutorialInteraction(interaction);
      } catch (error) {
        logger.error({ error, customId }, 'Error processing tutorial interaction');
      }
    } else if (customId.startsWith('nav_')) {
      try {
        await handleNavInteraction(interaction as any);
      } catch (error) {
        logger.error({ error, customId }, 'Error processing navigation interaction');
      }
    } else if (customId.startsWith('bag_')) {
      try {
        await handleBagInteraction(interaction as any);
      } catch (error) {
        logger.error({ error, customId }, 'Error processing bag interaction');
      }
    } else if (customId.startsWith('equip_select_')) {
      try {
        await handleEquipInteraction(interaction as any);
      } catch (error) {
        logger.error({ error, customId }, 'Error processing equip interaction');
      }
    } else if (customId.startsWith('sell_select_')) {
      try {
        await handleSellInteraction(interaction as any);
      } catch (error) {
        logger.error({ error, customId }, 'Error processing sell interaction');
      }
    } else if (customId.startsWith('quests_')) {
      try {
        await handleQuestsInteraction(interaction as any);
      } catch (error) {
        logger.error({ error, customId }, 'Error processing quests active pagination interaction');
      }
    } else if (customId.startsWith('quests_board_select_')) {
      try {
        await handleQuestsBoardSelect(interaction as any);
      } catch (error) {
        logger.error({ error, customId }, 'Error processing quests board select interaction');
      }
    } else if (customId.startsWith('prestige_')) {
      try {
        await handlePrestigeInteraction(interaction as any);
      } catch (error) {
        logger.error({ error, customId }, 'Error processing prestige interaction');
      }
    } else if (customId.startsWith('guild_')) {
      try {
        await handleGuildInteraction(interaction as any);
      } catch (error) {
        logger.error({ error, customId }, 'Error processing guild interaction');
      }
    } else if (customId.startsWith('leaderboard_')) {
      try {
        await handleLeaderboardInteraction(interaction as any);
      } catch (error) {
        logger.error({ error, customId }, 'Error processing leaderboard interaction');
      }
    } else if (customId.startsWith('map_travel_')) {
      try {
        await handleMapTravelInteraction(interaction as any);
      } catch (error) {
        logger.error({ error, customId }, 'Error processing map travel interaction');
      }
    } else if (customId.startsWith('player_preset_')) {
      try {
        await handlePresetInteraction(interaction as any);
      } catch (error) {
        logger.error({ error, customId }, 'Error processing player preset interaction');
      }
    }
  }

  // 3. Handle Modal Submissions
  if (interaction.isModalSubmit()) {
    const customId = interaction.customId;
    if (customId.startsWith('player_preset_')) {
      try {
        await handlePresetInteraction(interaction as any);
      } catch (error) {
        logger.error({ error, customId }, 'Error processing player preset modal interaction');
      }
    }
  }
}
