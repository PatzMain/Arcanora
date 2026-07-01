import { type Interaction, MessageFlags, EmbedBuilder, ChannelType } from 'discord.js';
import { commandsList } from './ready.js';
import { handleCombatInteraction } from '../systems/combat/handler.js';
import { handleTutorialInteraction } from '../commands/player/tutorial.js';
import { handleShopInteraction } from '../commands/economy/economy.js';
import { handleNavInteraction } from '../utils/navigation.js';
import { handleBagInteraction, handleEquipInteraction, handleSellInteraction } from '../commands/inventory/inventory.js';
import { handleQuestsInteraction, handleQuestsBoardSelect } from '../commands/quests/quest.js';
import { handlePrestigeInteraction } from '../commands/player/prestige.js';
import { handlePresetInteraction } from '../commands/player/presets.js';
import { handleMapTravelInteraction } from '../commands/player/map.js';
import { handleFeedbackModal } from '../commands/player/feedback.js';
import { handleGuildInteraction } from '../commands/guilds/guildActions.js';
import { handleLeaderboardInteraction } from '../commands/guilds/guildLeaderboard.js';
import { handleAdminInteraction } from '../commands/admin/admin.js';
import { errorEmbed } from '../utils/embeds.js';
import { logger } from '../utils/logger.js';
import { getPlayerWithClampedStats } from '../database/queries/player.js';
import { checkRateLimit } from '../utils/rateLimit.js';

// Commands that bypass the thread gate entirely
const THREAD_EXEMPT_COMMANDS = new Set(['play', 'tutorial', 'invite', 'help', 'admin', 'stop']);

/** Returns a styled embed telling the user to use /play first */
function buildPlayGateEmbed(activeThreadId?: string | null): EmbedBuilder {
  const desc = activeThreadId
    ? `Your adventure is running in <#${activeThreadId}>!\n\nHead over there to keep playing.`
    : `Use the \`/play\` command in any text channel to open your own private adventure thread.\nAll game commands will only work inside it.`;
  return new EmbedBuilder()
    .setColor(0x7C3AED)
    .setTitle('🏰 Adventure Thread Required')
    .setDescription(desc)
    .setFooter({ text: 'Arcanora — use /play to begin' });
}

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
      // ── Thread Gate ──────────────────────────────────────────────────────────
      // All commands except the exempt set must be run inside the player's
      // registered private adventure thread.
      if (!THREAD_EXEMPT_COMMANDS.has(cmdName)) {
        const isThread =
          interaction.channel?.type === ChannelType.PrivateThread ||
          interaction.channel?.type === ChannelType.PublicThread;

        const player = await getPlayerWithClampedStats(interaction.user.id);

        if (!player) {
          // No profile yet → direct them to /play
          const embed = buildPlayGateEmbed();
          await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
          return;
        }

        if (!isThread || interaction.channelId !== player.activeThreadId) {
          // Has a profile but is typing in the wrong place
          const embed = buildPlayGateEmbed(player.activeThreadId);
          await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
          return;
        }
      }

      await command.execute(interaction);
    } catch (error) {
      logger.error({ error, commandName: cmdName }, 'Error executing slash command');
      const embed = errorEmbed('Command Error', 'An unexpected error occurred while executing this command.', error);
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
    try {
      if (customId.startsWith('combat_')) {
        await handleCombatInteraction(interaction);
      } else if (customId.startsWith('shop_')) {
        await handleShopInteraction(interaction);
      } else if (customId.startsWith('tutorial_') && interaction.isStringSelectMenu()) {
        await handleTutorialInteraction(interaction);
      } else if (customId.startsWith('nav_')) {
        await handleNavInteraction(interaction as any);
      } else if (customId.startsWith('bag_')) {
        await handleBagInteraction(interaction as any);
      } else if (customId.startsWith('equip_select_')) {
        await handleEquipInteraction(interaction as any);
      } else if (customId.startsWith('sell_select_')) {
        await handleSellInteraction(interaction as any);
      } else if (customId.startsWith('quests_board_select_')) {
        await handleQuestsBoardSelect(interaction as any);
      } else if (customId.startsWith('quests_')) {
        await handleQuestsInteraction(interaction as any);
      } else if (customId.startsWith('prestige_')) {
        await handlePrestigeInteraction(interaction as any);
      } else if (customId.startsWith('guild_')) {
        await handleGuildInteraction(interaction as any);
      } else if (customId.startsWith('leaderboard_')) {
        await handleLeaderboardInteraction(interaction as any);
      } else if (customId.startsWith('map_travel_')) {
        await handleMapTravelInteraction(interaction as any);
      } else if (customId.startsWith('map_world_')) {
        const { handleWorldMapInteraction } = await import('../commands/player/map.js');
        await handleWorldMapInteraction(interaction as any);
      } else if (customId.startsWith('map_enter_dungeon_') || customId.startsWith('dungeon_')) {
        const { handleDungeonInteraction } = await import('../commands/player/map.js');
        await handleDungeonInteraction(interaction as any);
      } else if (customId.startsWith('player_preset_')) {
        await handlePresetInteraction(interaction as any);
      } else if (customId.startsWith('player_profile_')) {
        const { handleProfileInteraction } = await import('../commands/player/player.js');
        await handleProfileInteraction(interaction as any);
      } else if (customId.startsWith('admin_')) {
        await handleAdminInteraction(interaction as any);
      } else if (customId.startsWith('house_')) {
        const parts = customId.split('_');
        const { handleHouseInteraction } = await import('../commands/player/house.js');
        await handleHouseInteraction(interaction as any, parts);
      } else if (customId.startsWith('farm_')) {
        const parts = customId.split('_');
        const { handleFarmInteraction } = await import('../commands/player/farm.js');
        await handleFarmInteraction(interaction as any, parts);
      } else if (customId.startsWith('codex_')) {
        const { handleCodexInteraction } = await import('../commands/player/codex.js');
        await handleCodexInteraction(interaction as any);
      }
    } catch (error) {
      logger.error({ error, customId }, 'Error processing component interaction');
      const embed = errorEmbed('Interaction Error', 'An unexpected error occurred while processing this action.', error);
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
        } else {
          await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
        }
      } catch (replyErr) {
        logger.error({ error: replyErr }, 'Failed to send interaction error response');
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
        const embed = errorEmbed('Modal Submission Error', 'An unexpected error occurred while processing this modal submission.', error);
        try {
          if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
          } else {
            await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
          }
        } catch (replyErr) {
          logger.error({ error: replyErr }, 'Failed to send modal error response');
        }
      }
    } else if (customId.startsWith('feedback_submit_')) {
      try {
        await handleFeedbackModal(interaction);
      } catch (error) {
        logger.error({ error, customId }, 'Error processing feedback modal interaction');
        const embed = errorEmbed('Modal Submission Error', 'An unexpected error occurred while processing your feedback.', error);
        try {
          if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
          } else {
            await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
          }
        } catch (replyErr) {
          logger.error({ error: replyErr }, 'Failed to send modal error response');
        }
      }
    }
  }
}
