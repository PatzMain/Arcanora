import { logger } from '../../utils/logger.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  type ButtonInteraction
} from 'discord.js';
import { findOrCreatePlayer, getLeaderboard } from '../../database/queries/player.js';
import { getGuildLeaderboard } from '../../database/queries/guild.js';
import { leaderboardEmbed, errorEmbed } from '../../utils/embeds.js';

export async function runLeaderboard(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  category: string,
  pageNum: number
) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      if (interaction.isButton() || interaction.isStringSelectMenu()) {
        await interaction.deferUpdate();
      } else {
        await interaction.deferReply();
      }
    }

    const player = await findOrCreatePlayer(interaction.user.id, interaction.user.username);
    const pageSize = 10;
    const maxEntries = 30;

    let entries: any[] = [];
    let totalPages = 1;

    if (category === 'guilds') {
      const topGuilds = await getGuildLeaderboard(maxEntries);
      totalPages = Math.max(1, Math.ceil(topGuilds.length / pageSize));
      const pageIndex = Math.max(1, Math.min(pageNum, totalPages));
      const pageGuilds = topGuilds.slice((pageIndex - 1) * pageSize, pageIndex * pageSize);
      entries = pageGuilds.map((g, idx) => ({
        rank: (pageIndex - 1) * pageSize + idx + 1,
        username: g.name,
        value: `Level ${g.level} • 🪙 ${g.treasury.toLocaleString()} Treasury • 👥 ${g.memberCount} Members`
      }));
    } else {
      const topPlayers = await getLeaderboard(category as any, maxEntries);
      totalPages = Math.max(1, Math.ceil(topPlayers.length / pageSize));
      const pageIndex = Math.max(1, Math.min(pageNum, totalPages));
      const pagePlayers = topPlayers.slice((pageIndex - 1) * pageSize, pageIndex * pageSize);
      entries = pagePlayers.map((p, idx) => {
        let displayVal: string | number = '';
        if (category === 'level') displayVal = `Lv.${p.level}`;
        else if (category === 'gold') displayVal = `🪙 ${p.gold.toLocaleString()}`;
        else if (category === 'kills') displayVal = `💀 ${p.totalKills} Kills`;

        return {
          rank: (pageIndex - 1) * pageSize + idx + 1,
          username: p.username,
          value: displayVal
        };
      });
    }

    const embed = leaderboardEmbed(entries, category, pageNum);

    const prevBtn = new ButtonBuilder()
      .setCustomId(`leaderboard_prev_${player.discordId}_${pageNum - 1}_${category}`)
      .setLabel('◀️ Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageNum <= 1);

    const nextBtn = new ButtonBuilder()
      .setCustomId(`leaderboard_next_${player.discordId}_${pageNum + 1}_${category}`)
      .setLabel('Next ▶️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageNum >= totalPages);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(prevBtn, nextBtn);

    await interaction.editReply({
      embeds: [embed],
      components: totalPages > 1 ? [row] : []
    });
  } catch (error) {
    logger.error({ err: error }, 'Error running leaderboard:');
    const embed = errorEmbed('Leaderboard Error', 'Failed to retrieve leaderboard statistics.');
    await interaction.editReply({ embeds: [embed], components: [] });
  }
}

export async function handleLeaderboardInteraction(interaction: ButtonInteraction) {
  const parts = interaction.customId.split('_'); // leaderboard_{prev/next}_{userId}_{page}_{category}
  const userId = parts[2];
  const page = parseInt(parts[3] || '1');
  const category = parts[4]!;

  if (interaction.user.id !== userId) return;

  await runLeaderboard(interaction, category, page);
}
