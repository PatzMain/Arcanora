import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  type StringSelectMenuInteraction
} from 'discord.js';
import { findOrCreatePlayer } from '../../database/queries/player.js';
import { getActiveQuests, getCompletedQuests, startQuest } from '../../database/queries/quest.js';
import { db } from '../../database/client.js';
import { dailyLogins } from '../../database/schema.js';
import { eq } from 'drizzle-orm';
import { awardGold, awardGems } from '../../economy/currency.js';
import { successEmbed, errorEmbed, questEmbed } from '../../utils/embeds.js';
import { questsCatalog } from '../../utils/catalog.js';
import { getNavButtons } from '../../utils/navigation.js';

export const data = new SlashCommandBuilder()
  .setName('quest')
  .setDescription('Manage your active quests, browse the board, or claim daily rewards.')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('active')
      .setDescription('View your currently active quests and progress.')
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('board')
      .setDescription('Browse quests available to accept.')
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('accept')
      .setDescription('Accept a quest from the board.')
      .addStringOption((option) =>
        option
          .setName('quest_id')
          .setDescription('The ID of the quest to accept.')
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('daily')
      .setDescription('Claim your daily login rewards and build your streak.')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();
  if (subcommand === 'active') {
    await runQuestsActive(interaction, 1);
  } else if (subcommand === 'board') {
    await runQuestsBoard(interaction);
  } else if (subcommand === 'accept') {
    const questId = interaction.options.getString('quest_id', true);
    await runQuestsAccept(interaction, questId);
  } else if (subcommand === 'daily') {
    await runDaily(interaction);
  }
}

// ----------------------------------------------------
// RUNNERS (exposures for slash commands and buttons)
// ----------------------------------------------------

export async function runQuestsActive(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  pageNum?: number
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
    const catalog = questsCatalog;
    const currentPage = pageNum || 1;

    const activeDb = await getActiveQuests(player.id);
    const mappedQuests = activeDb.map((dbQuest) => {
      const def = catalog.find((q) => q.id === dbQuest.questId);
      if (!def) return null;

      let current = 0;
      let target = 0;
      if (def.conditions && def.conditions.length > 0) {
        const cond = def.conditions[0]!;
        target = cond.required;
        const prog = (dbQuest.progress || {}) as Record<string, number>;
        current = prog[cond.target] || 0;
      }

      return {
        name: def.name,
        description: def.description,
        current,
        target,
        rewardGold: def.rewards.gold,
        rewardExp: def.rewards.exp,
        type: def.type
      };
    }).filter(Boolean) as any[];

    const pageSize = 3;
    const totalPages = Math.max(1, Math.ceil(mappedQuests.length / pageSize));
    const pageIndex = Math.max(1, Math.min(currentPage, totalPages));

    const pageQuests = mappedQuests.slice((pageIndex - 1) * pageSize, pageIndex * pageSize);
    const embed = questEmbed(pageQuests);
    embed.setFooter({ text: `Arcanora — Discord MMORPG • Active Quests Page ${pageIndex}/${totalPages}` });

    const prevBtn = new ButtonBuilder()
      .setCustomId(`quests_prev_${player.discordId}_${pageIndex - 1}`)
      .setLabel('◀️ Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex <= 1);

    const nextBtn = new ButtonBuilder()
      .setCustomId(`quests_next_${player.discordId}_${pageIndex + 1}`)
      .setLabel('Next ▶️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex >= totalPages);

    const paginationRow = new ActionRowBuilder<ButtonBuilder>().addComponents(prevBtn, nextBtn);
    const navRow = getNavButtons('quest_board', player.discordId);

    const components: any[] = [];
    if (totalPages > 1) {
      components.push(paginationRow);
    }
    if (navRow) {
      components.push(navRow);
    }

    await interaction.editReply({
      embeds: [embed],
      components
    });
  } catch (error) {
    console.error('Error running active quests:', error);
    const embed = errorEmbed('Quests Error', 'Failed to retrieve active quests.');
    await interaction.editReply({ embeds: [embed], components: [] });
  }
}

export async function runQuestsBoard(
  interaction: ChatInputCommandInteraction | ButtonInteraction
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
    const catalog = questsCatalog;

    const activeDb = await getActiveQuests(player.id);
    const completedIds = await getCompletedQuests(player.id);
    const activeIds = activeDb.map((q) => q.questId);

    const available = catalog.filter((quest) => {
      if (player.level < quest.levelReq) return false;
      if (activeIds.includes(quest.id)) return false;
      if (completedIds.includes(quest.id) && !quest.repeatable) return false;
      return true;
    });

    let description = '';
    if (available.length > 0) {
      description = available
        .map((q) => {
          const typeEmoji = q.type === 'daily' ? '📅' : q.type === 'weekly' ? '📆' : '📜';
          const rewards: string[] = [];
          if (q.rewards.gold) rewards.push(`🪙 ${q.rewards.gold}`);
          if (q.rewards.exp) rewards.push(`✨ ${q.rewards.exp}`);
          if (q.rewards.gems) rewards.push(`💎 ${q.rewards.gems}`);
          return (
            `${typeEmoji} **${q.name}** \`(ID: ${q.id})\`\n` +
            `   *${q.description}*\n` +
            `   Level Req: **${q.levelReq}** | Rewards: **${rewards.join(', ')}**`
          );
        })
        .join('\n\n');
    } else {
      description = '*The quest board is empty. Check back later!*';
    }

    const embed = successEmbed('Quest Board', description);
    embed.setColor(0x3B82F6);

    const selectMenuOptions = available.slice(0, 25).map((q) => ({
      label: q.name.slice(0, 25),
      description: q.description.slice(0, 100),
      value: q.id
    }));

    const selectRow = selectMenuOptions.length > 0
      ? new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`quests_board_select_${player.discordId}`)
            .setPlaceholder('Select a quest to accept')
            .addOptions(selectMenuOptions)
        )
      : null;

    const navRow = getNavButtons('quest_board', player.discordId);

    const components: any[] = [];
    if (selectRow) components.push(selectRow);
    if (navRow) components.push(navRow);

    await interaction.editReply({
      embeds: [embed],
      components
    });
  } catch (error) {
    console.error('Error running quest board:', error);
    const embed = errorEmbed('Quest Board Error', 'Failed to retrieve quest board.');
    await interaction.editReply({ embeds: [embed], components: [] });
  }
}

export async function runQuestsAccept(
  interaction: ChatInputCommandInteraction | ButtonInteraction | StringSelectMenuInteraction,
  questId: string
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
    const catalog = questsCatalog;

    const quest = catalog.find((q) => q.id === questId);
    if (!quest) {
      const embed = errorEmbed('Quest Not Found', `No quest matching ID **"${questId}"** was found on the board.`);
      await interaction.editReply({ embeds: [embed], components: [] });
      return;
    }

    if (player.level < quest.levelReq) {
      const embed = errorEmbed(
        'Quest Locked',
        `You must be Level **${quest.levelReq}** to accept this quest.`
      );
      await interaction.editReply({ embeds: [embed], components: [] });
      return;
    }

    const activeDb = await getActiveQuests(player.id);
    if (activeDb.some((q) => q.questId === questId)) {
      const embed = errorEmbed('Already Active', `The quest **"${quest.name}"** is already in your active quest list.`);
      await interaction.editReply({ embeds: [embed], components: [] });
      return;
    }

    const completedIds = await getCompletedQuests(player.id);
    if (completedIds.includes(questId) && !quest.repeatable) {
      const embed = errorEmbed('Quest Completed', `You have already completed the story quest **"${quest.name}"**.`);
      await interaction.editReply({ embeds: [embed], components: [] });
      return;
    }

    await startQuest(player.id, quest.id);

    const embed = successEmbed(
      'Quest Accepted',
      `You have accepted the quest: **${quest.name}**!\n\n` +
      `*Track your progress using \`/quest active\`.*`
    );

    const navRow = getNavButtons('quest_board', player.discordId);

    await interaction.editReply({
      embeds: [embed],
      components: navRow ? [navRow] : []
    });
  } catch (error) {
    console.error('Error accepting quest:', error);
    const embed = errorEmbed('Quest Error', 'Failed to accept quest.');
    await interaction.editReply({ embeds: [embed], components: [] });
  }
}

export async function runDaily(
  interaction: ChatInputCommandInteraction | ButtonInteraction
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

    let row = await db.query.dailyLogins.findFirst({
      where: eq(dailyLogins.playerId, player.id),
    });

    if (!row) {
      [row] = await db
        .insert(dailyLogins)
        .values({ playerId: player.id })
        .returning();
    }

    const now = new Date();

    if (row!.lastClaim) {
      const lastClaim = new Date(row!.lastClaim);
      const isSameDay =
        now.getFullYear() === lastClaim.getFullYear() &&
        now.getMonth() === lastClaim.getMonth() &&
        now.getDate() === lastClaim.getDate();

      if (isSameDay) {
        const embed = errorEmbed(
          'Daily Reward Claimed',
          'You have already claimed your daily reward today. Come back tomorrow!'
        );
        const navRow = getNavButtons('quest_daily_result', player.discordId);
        await interaction.editReply({ embeds: [embed], components: navRow ? [navRow] : [] });
        return;
      }
    }

    let streak = 1;
    if (row!.lastClaim) {
      const lastClaim = new Date(row!.lastClaim);
      const msDiff = now.getTime() - lastClaim.getTime();
      const fortyEightHoursMs = 48 * 60 * 60 * 1000;

      if (msDiff < fortyEightHoursMs) {
        streak = row!.streak + 1;
      }
    }

    const goldReward = Math.min(100 * streak, 1000);
    const isWeeklyMilestone = streak % 7 === 0;
    const gemsReward = isWeeklyMilestone ? 15 : 0;

    await db
      .update(dailyLogins)
      .set({
        streak,
        lastClaim: now
      })
      .where(eq(dailyLogins.playerId, player.id));

    await awardGold(player.id, goldReward, `Daily login reward (Streak Day ${streak})`);
    if (gemsReward > 0) {
      await awardGems(player.id, gemsReward, `Daily login streak milestone (Day ${streak})`);
    }

    let description =
      `🎁 You claimed your daily login reward!\n\n` +
      `🔥 Current Streak: **${streak} Days**\n` +
      `🪙 Gold: +**${goldReward.toLocaleString()}**`;

    if (gemsReward > 0) {
      description += `\n💎 Gems: +**${gemsReward}** (7-day Milestone Bonus!)`;
    }

    description += `\n\n*Make sure to claim again tomorrow to keep your streak going!*`;

    const embed = successEmbed('Daily Reward Claimed', description);
    embed.setColor(0x10B981);

    const navRow = getNavButtons('quest_daily_result', player.discordId);

    await interaction.editReply({
      embeds: [embed],
      components: navRow ? [navRow] : []
    });
  } catch (error) {
    console.error('Error claiming daily:', error);
    const embed = errorEmbed('Daily Error', 'Failed to claim your daily reward.');
    await interaction.editReply({ embeds: [embed], components: [] });
  }
}

// ----------------------------------------------------
// INTERACTION HANDLERS (routed from interactionCreate)
// ----------------------------------------------------

export async function handleQuestsInteraction(interaction: ButtonInteraction) {
  const parts = interaction.customId.split('_'); // quests_prev_{userId}_{page} or quests_next_{userId}_{page}
  const userId = parts[2];
  const targetPage = parseInt(parts[3] || '1');

  if (interaction.user.id !== userId) return;

  await runQuestsActive(interaction, targetPage);
}

export async function handleQuestsBoardSelect(interaction: StringSelectMenuInteraction) {
  // quests_board_select_{userId}
  const parts = interaction.customId.split('_');
  const userId = parts[3];

  if (interaction.user.id !== userId) return;

  const questId = interaction.values[0]!;
  await runQuestsAccept(interaction, questId);
}
