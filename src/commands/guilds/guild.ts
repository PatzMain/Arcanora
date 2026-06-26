import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction
} from 'discord.js';
import { runGuildInfo } from './guildInfo.js';
import { runGuildCreate, runGuildJoin, runGuildLeave, runGuildKick } from './guildActions.js';
import { runLeaderboard } from './guildLeaderboard.js';

export const data = new SlashCommandBuilder()
  .setName('guild')
  .setDescription('Manage guilds or view leaderboards.')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('info')
      .setDescription('View information about a guild.')
      .addStringOption((option) =>
        option
          .setName('name')
          .setDescription('Name of the guild to view (default: your guild).')
          .setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('create')
      .setDescription('Create a new guild (Costs 500 Gold, Level 5 required).')
      .addStringOption((option) =>
        option
          .setName('name')
          .setDescription('Name of the guild (Max 32 chars).')
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('join')
      .setDescription('Join an existing guild.')
      .addStringOption((option) =>
        option
          .setName('name')
          .setDescription('Name of the guild to join.')
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('leave')
      .setDescription('Leave your current guild (disbands if you are the leader).')
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('kick')
      .setDescription('Kick a member from your guild (Leader only).')
      .addUserOption((option) =>
        option
          .setName('user')
          .setDescription('The member to kick.')
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
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
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();
  if (subcommand === 'info') {
    const name = interaction.options.getString('name') || undefined;
    await runGuildInfo(interaction, name);
  } else if (subcommand === 'create') {
    const name = interaction.options.getString('name', true);
    await runGuildCreate(interaction, name);
  } else if (subcommand === 'join') {
    const name = interaction.options.getString('name', true);
    await runGuildJoin(interaction, name);
  } else if (subcommand === 'leave') {
    await runGuildLeave(interaction);
  } else if (subcommand === 'kick') {
    const user = interaction.options.getUser('user', true);
    await runGuildKick(interaction, user.id, user.username);
  } else if (subcommand === 'leaderboard') {
    const category = interaction.options.getString('category', true);
    await runLeaderboard(interaction, category, 1);
  }
}
