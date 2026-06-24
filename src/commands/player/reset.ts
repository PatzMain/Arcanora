import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  type ChatInputCommandInteraction
} from 'discord.js';
import { db } from '../../database/client.js';
import { players, guilds } from '../../database/schema.js';
import { eq } from 'drizzle-orm';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('reset')
  .setDescription('Permanently reset your character and delete all your progress.');

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const discordId = interaction.user.id;

    // Fetch player profile
    const player = await db.query.players.findFirst({
      where: eq(players.discordId, discordId)
    });

    if (!player) {
      const embed = errorEmbed(
        'No Profile Found',
        'You do not have a player profile to reset. Start your journey by running `/tutorial`!'
      );
      await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
      return;
    }

    // Confirmation Embed
    const embed = errorEmbed(
      '⚠️ Permanent Profile Reset',
      'Resetting your profile will **completely wipe all your progress** in Arcanora. This action is permanent and cannot be undone!\n\n' +
      '**The following data will be permanently deleted:**\n' +
      '• 👤 Level, Class, and Clamped Stats\n' +
      '• 🪙 Gold and Gems balance\n' +
      '• 🎒 Inventory (All Weapons, Armors, Accessories, and Materials)\n' +
      '• 🌀 Learned Skills\n' +
      '• 📜 Quest Progress\n' +
      '• 🏰 Guild Membership or Leadership\n\n' +
      'Click **Confirm Reset** below to delete your character profile.'
    );
    embed.setColor(0xEF4444); // Bright warning red

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`reset_confirm_${discordId}`)
        .setLabel('Confirm Reset')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`reset_cancel_${discordId}`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
    );

    const response = await interaction.reply({
      embeds: [embed],
      components: [row],
      flags: [MessageFlags.Ephemeral]
    });

    try {
      const compInteraction = await response.awaitMessageComponent({
        filter: (i) => i.user.id === interaction.user.id,
        time: 30_000
      });

      if (compInteraction.customId === `reset_confirm_${discordId}`) {
        // 1. Delete guilds where leader
        await db.delete(guilds).where(eq(guilds.leaderId, player.id));
        // 2. Delete player row (cascades to other tables)
        await db.delete(players).where(eq(players.id, player.id));

        const success = successEmbed(
          'Character Reset Successful',
          'Your Arcanora character profile has been completely deleted.\n\n' +
          'You can start a new adventure at any time by running `/tutorial`!'
        );
        success.setColor(0xEF4444); // Red success
        await compInteraction.update({ embeds: [success], components: [] });
      } else {
        const cancel = successEmbed(
          'Reset Cancelled',
          'Your profile deletion has been cancelled. Your progress and items are completely safe!'
        );
        await compInteraction.update({ embeds: [cancel], components: [] });
      }
    } catch (e) {
      // Timed out
      const timeout = errorEmbed(
        'Reset Timed Out',
        'You did not respond in time (30 seconds). Profile deletion has been cancelled automatically.'
      );
      await interaction.editReply({ embeds: [timeout], components: [] });
    }
  } catch (error) {
    console.error('Error running reset command:', error);
    const err = errorEmbed('Reset Error', 'An unexpected error occurred while resetting your profile.');
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ embeds: [err], flags: [MessageFlags.Ephemeral] });
      } else {
        await interaction.reply({ embeds: [err], flags: [MessageFlags.Ephemeral] });
      }
    } catch {}
  }
}
