import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, type ChatInputCommandInteraction } from 'discord.js';
import { getLeaderboard } from '../../database/queries/player.js';
import { getGuildLeaderboard } from '../../database/queries/guild.js';
import { leaderboardEmbed, errorEmbed } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('View top players or guilds.')
  .addStringOption((option) =>
    option
      .setName('category')
      .setDescription('Category to view.')
      .setRequired(true)
      .addChoices(
        { name: 'Level', value: 'level' },
        { name: 'Gold', value: 'gold' },
        { name: 'Kills', value: 'kills' },
        { name: 'Guilds', value: 'guilds' }
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply();

    const category = interaction.options.getString('category', true);
    let currentPage = 1;
    const pageSize = 10;
    const maxEntries = 30; // Limit leaderboard to top 30 (3 pages)

    const getLeaderboardPageData = async (pageNum: number) => {
      let entries: any[] = [];
      let totalPages = 1;

      if (category === 'guilds') {
        const topGuilds = await getGuildLeaderboard(maxEntries);
        totalPages = Math.max(1, Math.ceil(topGuilds.length / pageSize));
        const pageGuilds = topGuilds.slice((pageNum - 1) * pageSize, pageNum * pageSize);
        entries = pageGuilds.map((g, idx) => ({
          rank: (pageNum - 1) * pageSize + idx + 1,
          username: g.name,
          value: `Level ${g.level} • 🪙 ${g.treasury.toLocaleString()} Treasury • 👥 ${g.memberCount} Members`
        }));
      } else {
        const topPlayers = await getLeaderboard(category as any, maxEntries);
        totalPages = Math.max(1, Math.ceil(topPlayers.length / pageSize));
        const pagePlayers = topPlayers.slice((pageNum - 1) * pageSize, pageNum * pageSize);
        entries = pagePlayers.map((p, idx) => {
          let displayVal: string | number = '';
          if (category === 'level') displayVal = `Lv.${p.level}`;
          else if (category === 'gold') displayVal = `🪙 ${p.gold.toLocaleString()}`;
          else if (category === 'kills') displayVal = `💀 ${p.totalKills} Kills`;

          return {
            rank: (pageNum - 1) * pageSize + idx + 1,
            username: p.username,
            value: displayVal
          };
        });
      }

      const embed = leaderboardEmbed(entries, category, pageNum);

      const prevBtn = new ButtonBuilder()
        .setCustomId('leaderboard_prev')
        .setLabel('◀️ Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pageNum <= 1);

      const nextBtn = new ButtonBuilder()
        .setCustomId('leaderboard_next')
        .setLabel('Next ▶️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pageNum >= totalPages);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(prevBtn, nextBtn);
      return { embed, row, totalPages };
    };

    let { embed, row, totalPages } = await getLeaderboardPageData(currentPage);

    const response = await interaction.editReply({
      embeds: [embed],
      components: totalPages > 1 ? [row] : []
    });

    if (totalPages > 1) {
      while (true) {
        try {
          const btnInteraction = await response.awaitMessageComponent({
            filter: (i) => i.user.id === interaction.user.id,
            time: 60_000,
            componentType: ComponentType.Button
          });

          if (btnInteraction.customId === 'leaderboard_prev') {
            currentPage = Math.max(1, currentPage - 1);
          } else if (btnInteraction.customId === 'leaderboard_next') {
            currentPage = Math.min(totalPages, currentPage + 1);
          }

          const pageData = await getLeaderboardPageData(currentPage);
          await btnInteraction.update({
            embeds: [pageData.embed],
            components: [pageData.row]
          });
        } catch (e) {
          // Timeout, disable buttons
          const prevDisabled = new ButtonBuilder()
            .setCustomId('leaderboard_prev')
            .setLabel('◀️ Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true);

          const nextDisabled = new ButtonBuilder()
            .setCustomId('leaderboard_next')
            .setLabel('Next ▶️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true);

          const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(prevDisabled, nextDisabled);
          try {
            await interaction.editReply({
              components: [disabledRow]
            });
          } catch {}
          break;
        }
      }
    }
  } catch (error: any) {
    console.error(error);
    const embed = errorEmbed('Leaderboard Error', 'Failed to retrieve leaderboard statistics.');
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}
