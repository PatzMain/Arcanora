import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
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

    if (category === 'guilds') {
      const topGuilds = await getGuildLeaderboard(10);
      const entries = topGuilds.map((g, idx) => ({
        rank: idx + 1,
        username: g.name,
        value: `Level ${g.level} • 🪙 ${g.treasury.toLocaleString()} Treasury • 👥 ${g.memberCount} Members`
      }));

      const embed = leaderboardEmbed(entries, 'Guilds', 1);
      return interaction.editReply({ embeds: [embed] });
    } else {
      const topPlayers = await getLeaderboard(category as any, 10);
      const entries = topPlayers.map((p, idx) => {
        let displayVal: string | number = '';
        if (category === 'level') displayVal = `Lv.${p.level}`;
        else if (category === 'gold') displayVal = `🪙 ${p.gold.toLocaleString()}`;
        else if (category === 'kills') displayVal = `💀 ${p.totalKills} Kills`;

        return {
          rank: idx + 1,
          username: p.username,
          value: displayVal
        };
      });

      const embed = leaderboardEmbed(entries, category, 1);
      return interaction.editReply({ embeds: [embed] });
    }

    return;
  } catch (error: any) {
    console.error(error);
    const embed = errorEmbed('Leaderboard Error', 'Failed to retrieve leaderboard statistics.');
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
    return;
  }
}
