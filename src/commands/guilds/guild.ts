import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { findOrCreatePlayer } from '../../database/queries/player.js';
import {
  createGuild,
  getGuildByName,
  getPlayerGuild,
  addMember,
  removeMember,
  getGuildMembers
} from '../../database/queries/guild.js';
import { deductGold } from '../../economy/currency.js';
import { db } from '../../database/client.js';
import { guilds, guildMembers } from '../../database/schema.js';
import { eq } from 'drizzle-orm';
import { successEmbed, errorEmbed, guildEmbed } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('guild')
  .setDescription('Manage or view guilds.')
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
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply();

    const discordId = interaction.user.id;
    const username = interaction.user.username;

    // Load player
    const player = await findOrCreatePlayer(discordId, username);

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'info') {
      const inputName = interaction.options.getString('name');
      let guildInfo = null;

      if (inputName) {
        guildInfo = await getGuildByName(inputName);
      } else {
        const playerMembership = await getPlayerGuild(player.id);
        if (!playerMembership) {
          const embed = errorEmbed('No Guild', 'You are not in a guild. Use `/guild join` or `/guild create`.');
          return interaction.editReply({ embeds: [embed] });
        }
        guildInfo = await getGuildByName(playerMembership.guildName);
      }

      if (!guildInfo) {
        const embed = errorEmbed('Guild Not Found', `No guild matching the name **"${inputName}"** was found.`);
        return interaction.editReply({ embeds: [embed] });
      }

      const members = await getGuildMembers(guildInfo.id);

      const mappedMembers = members.map((m) => ({
        username: m.username,
        role: m.rank,
        level: m.level
      }));

      // Determine rank of the requesting player in this guild
      let playerRank = 'non-member';
      if (!inputName) {
        const playerMembership = await getPlayerGuild(player.id);
        playerRank = playerMembership?.rank || 'non-member';
      } else {
        const memberRow = members.find((m) => m.playerId === player.id);
        playerRank = memberRow?.rank || 'non-member';
      }

      const embed = guildEmbed(
        {
          name: guildInfo.name,
          level: guildInfo.level,
          description: `Treasury: 🪙 **${guildInfo.treasury.toLocaleString()}** Gold`,
          memberCount: guildInfo.memberCount,
          maxMembers: 30
        },
        mappedMembers,
        playerRank
      );

      return interaction.editReply({ embeds: [embed] });
    }

    if (subcommand === 'create') {
      const nameInput = interaction.options.getString('name', true).trim();

      // Check name constraints
      if (nameInput.length < 3 || nameInput.length > 32) {
        const embed = errorEmbed('Invalid Name', 'Guild name must be between 3 and 32 characters long.');
        return interaction.editReply({ embeds: [embed] });
      }

      // Check level requirement
      if (player.level < 5) {
        const embed = errorEmbed('Level Too Low', 'You must be Level 5 or higher to create a guild.');
        return interaction.editReply({ embeds: [embed] });
      }

      // Check if already in a guild
      const currentGuild = await getPlayerGuild(player.id);
      if (currentGuild) {
        const embed = errorEmbed('Already in Guild', 'You must leave your current guild before creating a new one.');
        return interaction.editReply({ embeds: [embed] });
      }

      // Check if name is taken
      const existing = await getGuildByName(nameInput);
      if (existing) {
        const embed = errorEmbed('Name Taken', `A guild named **"${nameInput}"** already exists.`);
        return interaction.editReply({ embeds: [embed] });
      }

      // Deduct 500 gold
      const goldCheck = await deductGold(player.id, 500, `Created Guild: ${nameInput}`);
      if (!goldCheck.success) {
        const embed = errorEmbed('Insufficient Funds', 'Guild creation costs 🪙 **500** Gold. You do not have enough.');
        return interaction.editReply({ embeds: [embed] });
      }

      // Create guild
      await createGuild(nameInput, player.id);

      const embed = successEmbed(
        'Guild Created',
        `Successfully founded the guild: **${nameInput}**!\n\n` +
        `🪙 **500** Gold was paid for chartering fees. You are now the Guild Leader.`
      );
      return interaction.editReply({ embeds: [embed] });
    }

    if (subcommand === 'join') {
      const nameInput = interaction.options.getString('name', true).trim();

      // Check if already in a guild
      const currentGuild = await getPlayerGuild(player.id);
      if (currentGuild) {
        const embed = errorEmbed('Already in Guild', 'You must leave your current guild before joining a new one.');
        return interaction.editReply({ embeds: [embed] });
      }

      const guildInfo = await getGuildByName(nameInput);
      if (!guildInfo) {
        const embed = errorEmbed('Guild Not Found', `No guild matching the name **"${nameInput}"** was found.`);
        return interaction.editReply({ embeds: [embed] });
      }

      // Check capacity (max 30 members)
      if (guildInfo.memberCount >= 30) {
        const embed = errorEmbed('Guild Full', `The guild **${guildInfo.name}** is at maximum capacity (30/30 members).`);
        return interaction.editReply({ embeds: [embed] });
      }

      // Add member
      await addMember(guildInfo.id, player.id);

      const embed = successEmbed('Guild Joined', `You have successfully joined the guild: **${guildInfo.name}**!`);
      return interaction.editReply({ embeds: [embed] });
    }

    if (subcommand === 'leave') {
      const currentGuild = await getPlayerGuild(player.id);
      if (!currentGuild) {
        const embed = errorEmbed('No Guild', 'You are not in a guild.');
        return interaction.editReply({ embeds: [embed] });
      }

      if (currentGuild.rank === 'leader') {
        // Disband guild
        await db.delete(guilds).where(eq(guilds.id, currentGuild.guildId));

        const embed = successEmbed(
          'Guild Disbanded',
          `You have disbanded the guild: **${currentGuild.guildName}**.\n\n` +
          `*All members have been removed and the guild has been dissolved.*`
        );
        return interaction.editReply({ embeds: [embed] });
      } else {
        // Just leave
        await removeMember(currentGuild.guildId, player.id);

        const embed = successEmbed('Guild Left', `You have left the guild: **${currentGuild.guildName}**.`);
        return interaction.editReply({ embeds: [embed] });
      }
    }

    if (subcommand === 'kick') {
      const targetUser = interaction.options.getUser('user', true);

      const currentGuild = await getPlayerGuild(player.id);
      if (!currentGuild) {
        const embed = errorEmbed('No Guild', 'You are not in a guild.');
        return interaction.editReply({ embeds: [embed] });
      }

      if (currentGuild.rank !== 'leader') {
        const embed = errorEmbed('Leader Only', 'Only the Guild Leader can kick members.');
        return interaction.editReply({ embeds: [embed] });
      }

      const targetPlayer = await findOrCreatePlayer(targetUser.id, targetUser.username);
      const targetGuild = await getPlayerGuild(targetPlayer.id);

      if (!targetGuild || targetGuild.guildId !== currentGuild.guildId) {
        const embed = errorEmbed('Invalid Target', `**${targetUser.username}** is not in your guild.`);
        return interaction.editReply({ embeds: [embed] });
      }

      if (targetPlayer.id === player.id) {
        const embed = errorEmbed('Invalid Target', 'You cannot kick yourself. Use `/guild leave` to disband or transfer leadership.');
        return interaction.editReply({ embeds: [embed] });
      }

      // Kick member
      await removeMember(currentGuild.guildId, targetPlayer.id);

      const embed = successEmbed(
        'Member Kicked',
        `Successfully kicked **${targetUser.username}** from the guild **${currentGuild.guildName}**.`
      );
      return interaction.editReply({ embeds: [embed] });
    }

    return;
  } catch (error: any) {
    console.error(error);
    const embed = errorEmbed('Guild Error', 'An unexpected error occurred during guild management.');
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
    return;
  }
}
