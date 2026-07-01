import { logger } from '../../utils/logger.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  type StringSelectMenuInteraction
} from 'discord.js';
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
import { guilds } from '../../database/schema.js';
import { eq } from 'drizzle-orm';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

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
    logger.error({ err: error }, 'Error creating guild:');
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
    logger.error({ err: error }, 'Error joining guild:');
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
    logger.error({ err: error }, 'Error leaving guild:');
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
    logger.error({ err: error }, 'Error kicking guild member:');
    const embed = errorEmbed('Guild Error', 'Failed to kick member.');
    await interaction.editReply({ embeds: [embed] });
  }
}

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
    logger.error({ err: error }, 'Error handling guild button/menu:');
    await interaction.followUp({ content: '❌ Failed to process guild action.', ephemeral: true });
  }
}
