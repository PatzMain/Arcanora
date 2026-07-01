import { logger } from '../../utils/logger.js';
import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction
} from 'discord.js';
import { getDungeonLeaderboard } from '../../database/queries/dungeon.js';
import { zonesCatalog } from '../../utils/catalog.js';

export const data = new SlashCommandBuilder()
  .setName('dungeon')
  .setDescription('Manage or view dungeon info and leaderboards.')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('leaderboard')
      .setDescription('View the fastest/deepest runs for a dungeon.')
      .addStringOption((option) =>
        option
          .setName('dungeon')
          .setDescription('Select the dungeon leaderboard')
          .setRequired(true)
          .addChoices(
            { name: '🧹 Oakhaven Sewers', value: 'oakhaven_sewers' },
            { name: '⛏️ Ancient Mine', value: 'ancient_mine' },
            { name: '⚙️ Forgotten Ironmine', value: 'forgotten_ironmine' },
            { name: '👹 Goblin Sanctuary', value: 'goblin_sanctuary' },
            { name: '🔥 Lava Keep', value: 'lava_keep' },
            { name: '🌊 Sunken Temple', value: 'sunken_temple' }
          )
      )
  );

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();
  if (subcommand === 'leaderboard') {
    await interaction.deferReply();
    try {
      const dungeonId = interaction.options.getString('dungeon', true);
      const zone = zonesCatalog.find((z) => z.id === dungeonId);
      const dungeonName = zone ? zone.name : dungeonId;

      const records = await getDungeonLeaderboard(dungeonId, 10);

      const embed = new EmbedBuilder()
        .setColor(0x7C3AED)
        .setTitle(`🏆 Dungeon Leaderboard: ${dungeonName}`)
        .setDescription(`Top 10 players sorted by highest floor reached and fastest time.`)
        .setTimestamp();

      if (records.length === 0) {
        embed.setDescription(`Top 10 players sorted by highest floor reached and fastest time.\n\n*No runs recorded yet. Be the first to clear this dungeon!*`);
      } else {
        const lines = records.map((rec, index) => {
          const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `\`#${index + 1}\``;
          const playerDisplay = rec.player?.username || 'Unknown Adventurer';
          return `${rankEmoji} **${playerDisplay}** — Floor **${rec.floor}** in **${formatDuration(rec.timeTaken)}** <t:${Math.floor(rec.createdAt.getTime() / 1000)}:R>`;
        });
        embed.addFields({
          name: 'Records',
          value: lines.join('\n'),
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error({ err: error }, 'Error rendering dungeon leaderboard:');
      const err = new EmbedBuilder()
        .setColor(0xEF4444)
        .setTitle('Leaderboard Error')
        .setDescription('Failed to load dungeon leaderboard data.');
      await interaction.editReply({ embeds: [err] });
    }
  }
}
