import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ComponentType,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  type StringSelectMenuInteraction
} from 'discord.js';
import { findOrCreatePlayer, getLeaderboard } from '../../database/queries/player.js';
import {
  createGuild,
  getGuildByName,
  getPlayerGuild,
  addMember,
  removeMember,
  getGuildMembers,
  getGuildLeaderboard
} from '../../database/queries/guild.js';
import { deductGold } from '../../economy/currency.js';
import { db } from '../../database/client.js';
import { guilds } from '../../database/schema.js';
import { eq } from 'drizzle-orm';
import { successEmbed, errorEmbed, guildEmbed, leaderboardEmbed } from '../../utils/embeds.js';
import { getNavButtons } from '../../utils/navigation.js';

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

// ----------------------------------------------------
// RUNNERS (exposures for slash commands and buttons)
// ----------------------------------------------------

export async function runGuildInfo(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  nameInput?: string
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
    let guildInfo = null;

    if (nameInput) {
      guildInfo = await getGuildByName(nameInput);
    } else {
      const playerMembership = await getPlayerGuild(player.id);
      if (!playerMembership) {
        const embed = errorEmbed('No Guild', 'You are not in a guild. Use `/guild join` or `/guild create`.');
        await interaction.editReply({ embeds: [embed], components: [] });
        return;
      }
      guildInfo = await getGuildByName(playerMembership.guildName);
    }

    if (!guildInfo) {
      const embed = errorEmbed('Guild Not Found', `No guild matching the name **"${nameInput}"** was found.`);
      await interaction.editReply({ embeds: [embed], components: [] });
      return;
    }

    const members = await getGuildMembers(guildInfo.id);
    const mappedMembers = members.map((m) => ({
      username: m.username,
      role: m.rank,
      level: m.level
    }));

    let playerRank = 'non-member';
    const playerMembership = await getPlayerGuild(player.id);
    if (playerMembership && playerMembership.guildId === guildInfo.id) {
      playerRank = playerMembership.rank;
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

    const actionRows: any[] = [];

    if (playerRank === 'non-member') {
      if (guildInfo.memberCount < 30) {
        const joinBtn = new ButtonBuilder()
          .setCustomId(`guild_join_${player.discordId}_${guildInfo.id}`)
          .setLabel('Join Guild')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🤝');
        actionRows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(joinBtn));
      }
    } else if (playerRank === 'leader') {
      const leaveBtn = new ButtonBuilder()
        .setCustomId(`guild_leave_${player.discordId}_${guildInfo.id}`)
        .setLabel('Disband Guild')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🚪');
      actionRows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(leaveBtn));

      const kickable = members.filter((m) => m.rank !== 'leader');
      if (kickable.length > 0) {
        const kickMenu = new StringSelectMenuBuilder()
          .setCustomId(`guild_kick_${player.discordId}_${guildInfo.id}`)
          .setPlaceholder('⚔️ Kick a member…')
          .addOptions(
            kickable.slice(0, 25).map((m) => ({
              label: m.username,
              description: `Lv.${m.level} — ${m.rank}`,
              value: m.playerId,
            }))
          );
        actionRows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(kickMenu));
      }
    } else {
      const leaveBtn = new ButtonBuilder()
        .setCustomId(`guild_leave_${player.discordId}_${guildInfo.id}`)
        .setLabel('Leave Guild')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🚪');
      actionRows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(leaveBtn));
    }

    await interaction.editReply({
      embeds: [embed],
      components: actionRows
    });
  } catch (error) {
    console.error('Error running guild info:', error);
    const embed = errorEmbed('Guild Error', 'Failed to retrieve guild info.');
    await interaction.editReply({ embeds: [embed], components: [] });
  }
}

export async function runGuildCreate(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  nameInput: string
) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const player = await findOrCreatePlayer(interaction.user.id, interaction.user.username);
    const trimmedName = nameInput.trim();

    if (trimmedName.length < 3 || trimmedName.length > 32) {
      const embed = errorEmbed('Invalid Name', 'Guild name must be between 3 and 32 characters long.');
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (player.level < 5) {
      const embed = errorEmbed('Level Too Low', 'You must be Level 5 or higher to create a guild.');
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const currentGuild = await getPlayerGuild(player.id);
    if (currentGuild) {
      const embed = errorEmbed('Already in Guild', 'You must leave your current guild before creating a new one.');
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const existing = await getGuildByName(trimmedName);
    if (existing) {
      const embed = errorEmbed('Name Taken', `A guild named **"${trimmedName}"** already exists.`);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const goldCheck = await deductGold(player.id, 500, `Created Guild: ${trimmedName}`);
    if (!goldCheck.success) {
      const embed = errorEmbed('Insufficient Funds', 'Guild creation costs 🪙 **500** Gold. You do not have enough.');
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    await createGuild(trimmedName, player.id);

    const embed = successEmbed(
      'Guild Created',
      `Successfully founded the guild: **${trimmedName}**!\n\n` +
      `🪙 **500** Gold was paid for chartering fees. You are now the Guild Leader.`
    );
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error creating guild:', error);
    const embed = errorEmbed('Guild Error', 'Failed to create guild.');
    await interaction.editReply({ embeds: [embed] });
  }
}

export async function runGuildJoin(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  nameInput: string
) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const player = await findOrCreatePlayer(interaction.user.id, interaction.user.username);
    const trimmedName = nameInput.trim();

    const currentGuild = await getPlayerGuild(player.id);
    if (currentGuild) {
      const embed = errorEmbed('Already in Guild', 'You must leave your current guild before joining a new one.');
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const guildInfo = await getGuildByName(trimmedName);
    if (!guildInfo) {
      const embed = errorEmbed('Guild Not Found', `No guild matching the name **"${trimmedName}"** was found.`);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (guildInfo.memberCount >= 30) {
      const embed = errorEmbed('Guild Full', `The guild **${guildInfo.name}** is at maximum capacity (30/30 members).`);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    await addMember(guildInfo.id, player.id);

    const embed = successEmbed('Guild Joined', `You have successfully joined the guild: **${guildInfo.name}**!`);
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error joining guild:', error);
    const embed = errorEmbed('Guild Error', 'Failed to join guild.');
    await interaction.editReply({ embeds: [embed] });
  }
}

export async function runGuildLeave(
  interaction: ChatInputCommandInteraction | ButtonInteraction
) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const player = await findOrCreatePlayer(interaction.user.id, interaction.user.username);
    const currentGuild = await getPlayerGuild(player.id);

    if (!currentGuild) {
      const embed = errorEmbed('No Guild', 'You are not in a guild.');
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (currentGuild.rank === 'leader') {
      await db.delete(guilds).where(eq(guilds.id, currentGuild.guildId));

      const embed = successEmbed(
        'Guild Disbanded',
        `You have disbanded the guild: **${currentGuild.guildName}**.\n\n` +
        `*All members have been removed and the guild has been dissolved.*`
      );
      await interaction.editReply({ embeds: [embed] });
    } else {
      await removeMember(currentGuild.guildId, player.id);

      const embed = successEmbed('Guild Left', `You have left the guild: **${currentGuild.guildName}**.`);
      await interaction.editReply({ embeds: [embed] });
    }
  } catch (error) {
    console.error('Error leaving guild:', error);
    const embed = errorEmbed('Guild Error', 'Failed to leave guild.');
    await interaction.editReply({ embeds: [embed] });
  }
}

export async function runGuildKick(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  targetUserId: string,
  targetUsername: string
) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const player = await findOrCreatePlayer(interaction.user.id, interaction.user.username);
    const currentGuild = await getPlayerGuild(player.id);

    if (!currentGuild) {
      const embed = errorEmbed('No Guild', 'You are not in a guild.');
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (currentGuild.rank !== 'leader') {
      const embed = errorEmbed('Leader Only', 'Only the Guild Leader can kick members.');
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const targetPlayer = await findOrCreatePlayer(targetUserId, targetUsername);
    const targetGuild = await getPlayerGuild(targetPlayer.id);

    if (!targetGuild || targetGuild.guildId !== currentGuild.guildId) {
      const embed = errorEmbed('Invalid Target', `**${targetUsername}** is not in your guild.`);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (targetPlayer.id === player.id) {
      const embed = errorEmbed('Invalid Target', 'You cannot kick yourself. Use `/guild leave` to disband.');
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    await removeMember(currentGuild.guildId, targetPlayer.id);

    const embed = successEmbed(
      'Member Kicked',
      `Successfully kicked **${targetUsername}** from the guild **${currentGuild.guildName}**.`
    );
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error kicking guild member:', error);
    const embed = errorEmbed('Guild Error', 'Failed to kick member.');
    await interaction.editReply({ embeds: [embed] });
  }
}

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
    console.error('Error running leaderboard:', error);
    const embed = errorEmbed('Leaderboard Error', 'Failed to retrieve leaderboard statistics.');
    await interaction.editReply({ embeds: [embed], components: [] });
  }
}

// ----------------------------------------------------
// INTERACTION HANDLERS (routed from interactionCreate)
// ----------------------------------------------------

export async function handleGuildInteraction(
  interaction: ButtonInteraction | StringSelectMenuInteraction
) {
  const parts = interaction.customId.split('_'); // guild_{action}_{userId}_{guildId}
  const action = parts[1];
  const userId = parts[2];
  const guildId = parts[3];

  if (interaction.user.id !== userId) return;
  if (!guildId) return;

  const disabledRows = interaction.message.components.map((row) => {
    const newRow = ActionRowBuilder.from(row as any);
    newRow.components.forEach((c: any) => c.setDisabled(true));
    return newRow;
  }) as any[];

  try {
    const player = await findOrCreatePlayer(interaction.user.id, interaction.user.username);

    if (action === 'join') {
      const currentGuild = await getPlayerGuild(player.id);
      if (currentGuild) {
        const errEmbed = errorEmbed('Already in Guild', 'You must leave your current guild first.');
        await interaction.update({ embeds: [errEmbed], components: disabledRows });
        return;
      }

      const guildInfo = await db.query.guilds.findFirst({ where: eq(guilds.id, guildId) });
      if (!guildInfo) {
        const errEmbed = errorEmbed('Guild Error', 'This guild no longer exists.');
        await interaction.update({ embeds: [errEmbed], components: disabledRows });
        return;
      }

      const members = await getGuildMembers(guildInfo.id);
      if (members.length >= 30) {
        const errEmbed = errorEmbed('Guild Error', 'This guild is full.');
        await interaction.update({ embeds: [errEmbed], components: disabledRows });
        return;
      }

      await addMember(guildInfo.id, player.id);
      const joinEmbed = successEmbed('Guild Joined', `You have joined **${guildInfo.name}**! 🎉`);
      await interaction.update({ embeds: [joinEmbed], components: disabledRows });

    } else if (action === 'leave') {
      const currentGuild = await getPlayerGuild(player.id);
      if (!currentGuild || currentGuild.guildId !== guildId) {
        const errEmbed = errorEmbed('No Guild', 'You are no longer in this guild.');
        await interaction.update({ embeds: [errEmbed], components: disabledRows });
        return;
      }

      if (currentGuild.rank === 'leader') {
        await db.delete(guilds).where(eq(guilds.id, guildId));
        const disbandEmbed = successEmbed(
          'Guild Disbanded',
          `You have disbanded **${currentGuild.guildName}**.\n*All members have been removed.*`
        );
        await interaction.update({ embeds: [disbandEmbed], components: disabledRows });
      } else {
        await removeMember(guildId, player.id);
        const leftEmbed = successEmbed('Guild Left', `You have left **${currentGuild.guildName}**.`);
        await interaction.update({ embeds: [leftEmbed], components: disabledRows });
      }

    } else if (action === 'kick' && interaction.isStringSelectMenu()) {
      const targetPlayerId = interaction.values[0]!;
      const currentGuild = await getPlayerGuild(player.id);
      if (!currentGuild || currentGuild.rank !== 'leader' || currentGuild.guildId !== guildId) {
        const errEmbed = errorEmbed('Unauthorized', 'You are no longer the guild leader.');
        await interaction.update({ embeds: [errEmbed], components: disabledRows });
        return;
      }

      const members = await getGuildMembers(guildId);
      const targetMember = members.find((m) => m.playerId === targetPlayerId);

      await removeMember(guildId, targetPlayerId);
      const kickEmbed = successEmbed(
        'Member Kicked',
        `Kicked **${targetMember?.username ?? 'Unknown'}** from the guild.`
      );
      await interaction.update({ embeds: [kickEmbed], components: disabledRows });
    }
  } catch (error) {
    console.error('Error handling guild button/menu:', error);
    await interaction.followUp({ content: '❌ Failed to process guild action.', ephemeral: true });
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
