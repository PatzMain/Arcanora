import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  type ButtonInteraction
} from 'discord.js';
import { db } from '../../database/client.js';
import { feedbacks } from '../../database/schema.js';
import { eq, desc } from 'drizzle-orm';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

export async function runFeedbackResolve(interaction: ChatInputCommandInteraction) {
  const feedbackId = interaction.options.getString('id', true).trim();

  const feedback = await db.query.feedbacks.findFirst({
    where: eq(feedbacks.id, feedbackId)
  });

  if (!feedback) {
    const embed = errorEmbed('Feedback Not Found', `No feedback entry found with ID \`${feedbackId}\`.`);
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  if (feedback.status === 'resolved') {
    const embed = errorEmbed('Already Resolved', `Feedback with ID \`${feedbackId}\` is already resolved.`);
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  await db.update(feedbacks)
    .set({ status: 'resolved' })
    .where(eq(feedbacks.id, feedbackId));

  const embed = successEmbed(
    'Feedback Resolved',
    `Successfully marked feedback \`${feedbackId}\` by **${feedback.username}** as **resolved**.`
  );
  embed.setColor(0x10B981);
  await interaction.editReply({ embeds: [embed] });
}

export async function runFeedbackList(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  statusFilter: string,
  page: number
) {
  const userId = interaction.user.id;
  const pageSize = 5;

  let queryConditions;
  if (statusFilter !== 'all') {
    queryConditions = eq(feedbacks.status, statusFilter);
  }

  const allFeedbacks = await db.query.feedbacks.findMany({
    where: queryConditions,
    orderBy: [desc(feedbacks.createdAt)],
  });

  const totalItems = allFeedbacks.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const activePage = Math.min(page, totalPages);
  const startIndex = (activePage - 1) * pageSize;
  const paginatedFeedbacks = allFeedbacks.slice(startIndex, startIndex + pageSize);

  const embed = new EmbedBuilder()
    .setTitle(`📝 Player Feedback List`)
    .setColor(0x7C3AED)
    .setFooter({ text: `Arcanora Feedback • Page ${activePage}/${totalPages} • Total: ${totalItems}` });

  if (paginatedFeedbacks.length === 0) {
    embed.setDescription(`*No feedback entries found with status "${statusFilter}".*`);
  } else {
    const descriptionLines = paginatedFeedbacks.map((f) => {
      const dateStr = f.createdAt.toLocaleDateString();
      const statusEmoji = f.status === 'resolved' ? '✅' : '⏳';
      return `**ID**: \`${f.id}\`\n` +
             `👤 **Player**: ${f.username} (${statusEmoji} *${f.status}*)\n` +
             `🏷️ **Category**: \`${f.category}\` • 📅 **Date**: ${dateStr}\n` +
             `💬 **Feedback**:\n> ${f.content.replace(/\n/g, '\n> ')}\n` +
             `───────────────────`;
    });
    embed.setDescription(`### Status: ${statusFilter.toUpperCase()}\n\n` + descriptionLines.join('\n\n'));
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`admin_feedbacklist_prev_${userId}_${statusFilter}_${activePage - 1}`)
      .setLabel('Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(activePage <= 1),
    new ButtonBuilder()
      .setCustomId(`admin_feedbacklist_next_${userId}_${statusFilter}_${activePage + 1}`)
      .setLabel('Next')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(activePage >= totalPages)
  );

  await interaction.editReply({
    embeds: [embed],
    components: totalPages > 1 ? [row] : []
  });
}
