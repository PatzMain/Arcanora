import {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction
} from 'discord.js';
import { db } from '../../database/client.js';
import { feedbacks, players } from '../../database/schema.js';
import { eq } from 'drizzle-orm';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';

export const data = new SlashCommandBuilder()
  .setName('feedback')
  .setDescription('Submit suggestions, bugs, or general feedback about the game.');

export async function execute(interaction: ChatInputCommandInteraction) {
  const discordId = interaction.user.id;

  // Double check player profile (though interactionCreate should have verified it)
  const player = await db.query.players.findFirst({
    where: eq(players.discordId, discordId)
  });

  if (!player) {
    const embed = errorEmbed(
      '🌌 Welcome to Arcanora!',
      'Before you can submit feedback, you need to create a profile and learn the basics.\n\n' +
      'Please run the **/tutorial** command to begin!'
    );
    embed.setColor(0x7C3AED);
    await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
    return;
  }

  // Create Modal
  const modal = new ModalBuilder()
    .setCustomId(`feedback_submit_${discordId}`)
    .setTitle('📝 Game Feedback / Bug Report');

  const categoryInput = new TextInputBuilder()
    .setCustomId('feedback_category')
    .setLabel('Category (Bug / Suggestion / Other)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Enter "Bug", "Suggestion", or "Other"')
    .setRequired(true)
    .setMaxLength(32);

  const contentInput = new TextInputBuilder()
    .setCustomId('feedback_content')
    .setLabel('Detailed Feedback')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Please describe your feedback, bug details, or suggestion here...')
    .setRequired(true)
    .setMaxLength(2000);

  const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(categoryInput);
  const row2 = new ActionRowBuilder<TextInputBuilder>().addComponents(contentInput);

  modal.addComponents(row1, row2);

  await interaction.showModal(modal);
}

export async function handleFeedbackModal(interaction: ModalSubmitInteraction) {
  try {
    const discordId = interaction.user.id;
    const category = interaction.fields.getTextInputValue('feedback_category').trim();
    const content = interaction.fields.getTextInputValue('feedback_content').trim();

    // Check category - normalize to standard choices if possible
    const normalizedCategory = category.toLowerCase();
    let finalCategory = category;
    if (normalizedCategory.includes('bug')) {
      finalCategory = 'Bug';
    } else if (normalizedCategory.includes('suggest') || normalizedCategory.includes('idea')) {
      finalCategory = 'Suggestion';
    } else if (normalizedCategory.includes('other')) {
      finalCategory = 'Other';
    } else {
      // Keep original but limit length
      finalCategory = category.slice(0, 32);
    }

    // Get the player ID
    const player = await db.query.players.findFirst({
      where: eq(players.discordId, discordId)
    });

    if (!player) {
      const embed = errorEmbed(
        'Submission Failed',
        'Could not find your player profile to associate with this feedback.'
      );
      await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
      return;
    }

    // Insert feedback into the database
    await db.insert(feedbacks).values({
      playerId: player.id,
      username: interaction.user.username,
      category: finalCategory,
      content: content,
      status: 'open',
    });

    const embed = successEmbed(
      '📝 Feedback Submitted!',
      `Thank you, **${interaction.user.username}**! Your feedback has been logged.\n\n` +
      `**Category**: ${finalCategory}\n` +
      `**Content**:\n\`\`\`\n${content}\n\`\`\`\n` +
      `Our development team will review it. We appreciate your help in making Arcanora better!`
    );
    embed.setColor(0x10B981); // Emerald Green
    await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
  } catch (error) {
    logger.error({ error }, 'Error saving player feedback');
    const embed = errorEmbed(
      'Submission Error',
      'An unexpected error occurred while saving your feedback. Please try again later.'
    );
    await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
  }
}
