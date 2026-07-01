import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, ChannelType } from 'discord.js';
import { findOrCreatePlayer } from '../../database/queries/player.js';
import { db } from '../../database/client.js';
import { players } from '../../database/schema.js';
import { eq } from 'drizzle-orm';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Start or resume your private Arcanora adventure thread.');

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const discordId = interaction.user.id;
    const username = interaction.user.username;

    // Load or create the player profile
    const player = await findOrCreatePlayer(discordId, username);

    // Check if the player already has an active thread in the guild
    if (player.activeThreadId && interaction.guild) {
      try {
        const existingThread = await interaction.guild.channels.fetch(player.activeThreadId);
        if (existingThread && 'archived' in existingThread && !existingThread.archived) {
          const embed = successEmbed(
            'Adventure Active',
            `You already have an active adventure thread here: <#${player.activeThreadId}>!\n\n` +
            `Please proceed to your thread to continue playing.`
          );
          await interaction.editReply({ embeds: [embed] });
          return;
        }
      } catch (_err) {
        // Thread was probably deleted or we can't find it, ignore and create a new one
      }
    }

    // Ensure command is run in a guild text channel
    if (!interaction.guild || !interaction.channel || interaction.channel.type !== ChannelType.GuildText) {
      const err = errorEmbed('Command Error', 'This command can only be used inside a text channel in a server.');
      await interaction.editReply({ embeds: [err] });
      return;
    }

    // Create private thread
    const threadName = `🎮-${interaction.user.username}'s-adventure`;
    const thread = await interaction.channel.threads.create({
      name: threadName,
      autoArchiveDuration: 1440, // 24 hours
      type: ChannelType.PrivateThread,
      reason: `Private adventure thread for ${username}`
    });

    // Add player to the thread
    await thread.members.add(discordId);

    // Save thread ID to player profile in DB
    await db.update(players).set({ activeThreadId: thread.id }).where(eq(players.id, player.id));

    // Send welcoming message inside the thread
    const playEmbed = new EmbedBuilder()
      .setColor(0x7C3AED)
      .setTitle('🏰 Welcome to Arcanora!')
      .setDescription(
        `This is your private adventure thread, **${username}**!\n\n` +
        `You can now use all game commands here (e.g. \`/tutorial\`, \`/map\`, \`/profile\`) to play the game.\n\n` +
        `── ── ── ── ── ── ──\n` +
        `*Your adventure thread will stay active as long as you are playing.*`
      )
      .setFooter({ text: 'Arcanora — Discord MMORPG' })
      .setTimestamp();

    await thread.send({ content: `<@${discordId}>`, embeds: [playEmbed] });

    // Inform player with thread link
    const linkEmbed = successEmbed(
      'Adventure Thread Created',
      `✨ Your private adventure thread has been created!\n\n` +
      `👉 Go to your thread to start playing: <#${thread.id}>`
    );
    await interaction.editReply({ embeds: [linkEmbed] });

  } catch (error) {
    console.error('Failed to execute /play command:', error);
    const err = errorEmbed('Command Error', 'An unexpected error occurred while setting up your private thread.');
    await interaction.editReply({ embeds: [err] });
  }
}
