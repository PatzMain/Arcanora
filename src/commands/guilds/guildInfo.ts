import { logger } from '../../utils/logger.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  type ChatInputCommandInteraction,
  type ButtonInteraction
} from 'discord.js';
import { findOrCreatePlayer } from '../../database/queries/player.js';
import {
  getGuildByName,
  getPlayerGuild,
  getGuildMembers
} from '../../database/queries/guild.js';
import { guildEmbed, errorEmbed } from '../../utils/embeds.js';

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
    logger.error({ err: error }, 'Error running guild info:');
    const embed = errorEmbed('Guild Error', 'Failed to retrieve guild info.');
    await interaction.editReply({ embeds: [embed], components: [] });
  }
}
