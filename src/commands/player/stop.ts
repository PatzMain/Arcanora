import { logger } from '../../utils/logger.js';
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { findOrCreatePlayer } from '../../database/queries/player.js';
import { db } from '../../database/client.js';
import { players } from '../../database/schema.js';
import { eq } from 'drizzle-orm';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('stop')
  .setDescription('Delete your active private adventure thread.');

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const discordId = interaction.user.id;
    const username = interaction.user.username;

    // Load player profile
    const player = await findOrCreatePlayer(discordId, username);

    if (!player.activeThreadId) {
      const err = errorEmbed('No Active Thread', 'You do not have an active adventure thread.');
      await interaction.editReply({ embeds: [err] });
      return;
    }

    const threadId = player.activeThreadId;

    // Try to fetch and delete the thread
    let deleted = false;
    try {
      const thread = await interaction.client.channels.fetch(threadId);
      if (thread && thread.isThread()) {
        await thread.delete('Player requested adventure stop.');
        deleted = true;
      }
    } catch {
      // Thread might not exist or already be deleted
    }

    // Always clear the thread ID in database
    await db.update(players).set({ activeThreadId: null }).where(eq(players.id, player.id));

    // If the command was executed inside the thread that was deleted,
    // the channel is gone so we can't reply to it.
    const runInSameThread = interaction.channelId === threadId;

    if (runInSameThread) {
      return;
    }

    const embed = successEmbed(
      'Adventure Thread Stopped',
      deleted
        ? 'Your active private adventure thread has been deleted.'
        : 'Your active thread record has been cleared (the thread could not be found or was already deleted).'
    );
    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    logger.error({ err: error }, 'Failed to execute /stop command:');
    const err = errorEmbed('Command Error', 'An unexpected error occurred while deleting your adventure thread.');
    try {
      await interaction.editReply({ embeds: [err] });
    } catch {}
  }
}
