import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ComponentType, type ChatInputCommandInteraction } from 'discord.js';
import { findOrCreatePlayer } from '../../database/queries/player.js';
import { getActiveQuests, getCompletedQuests, startQuest } from '../../database/queries/quest.js';
import { successEmbed, errorEmbed, questEmbed } from '../../utils/embeds.js';
import { questsCatalog } from '../../utils/catalog.js';

export const data = new SlashCommandBuilder()
  .setName('quests')
  .setDescription('View active quests, accept new ones, or browse the quest board.')
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
          .setDescription('The ID of the quest to accept (e.g. story_meadows_clear).')
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
    const catalog = questsCatalog;

    if (subcommand === 'active') {
      const activeDb = await getActiveQuests(player.id);

      const mappedQuests = activeDb.map((dbQuest) => {
        const def = catalog.find((q) => q.id === dbQuest.questId);
        if (!def) return null;

        // Extract progress from JSONB
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

      let currentPage = 1;
      const pageSize = 3;
      const totalPages = Math.max(1, Math.ceil(mappedQuests.length / pageSize));

      const getQuestsPageEmbed = (pageNum: number) => {
        const pageQuests = mappedQuests.slice((pageNum - 1) * pageSize, pageNum * pageSize);
        const embed = questEmbed(pageQuests);
        embed.setFooter({ text: `Arcanora — Discord MMORPG • Active Quests Page ${pageNum}/${totalPages}` });
        return embed;
      };

      const prevBtn = new ButtonBuilder()
        .setCustomId('quests_prev')
        .setLabel('◀️ Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage <= 1);

      const nextBtn = new ButtonBuilder()
        .setCustomId('quests_next')
        .setLabel('Next ▶️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage >= totalPages);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(prevBtn, nextBtn);

      const response = await interaction.editReply({
        embeds: [getQuestsPageEmbed(currentPage)],
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

            if (btnInteraction.customId === 'quests_prev') {
              currentPage = Math.max(1, currentPage - 1);
            } else if (btnInteraction.customId === 'quests_next') {
              currentPage = Math.min(totalPages, currentPage + 1);
            }

            prevBtn.setDisabled(currentPage <= 1);
            nextBtn.setDisabled(currentPage >= totalPages);
            const updatedRow = new ActionRowBuilder<ButtonBuilder>().addComponents(prevBtn, nextBtn);

            await btnInteraction.update({
              embeds: [getQuestsPageEmbed(currentPage)],
              components: [updatedRow]
            });
          } catch (e) {
            const prevDisabled = new ButtonBuilder()
              .setCustomId('quests_prev')
              .setLabel('◀️ Previous')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true);

            const nextDisabled = new ButtonBuilder()
              .setCustomId('quests_next')
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
      return;
    }

    if (subcommand === 'board') {
      const activeDb = await getActiveQuests(player.id);
      const completedIds = await getCompletedQuests(player.id);

      const activeIds = activeDb.map((q) => q.questId);

      // Filter available quests
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
      embed.setColor(0x3B82F6); // Blue info color

      const selectMenuOptions = available.map((q) => ({
        label: q.name,
        description: q.description.slice(0, 100),
        value: q.id
      }));

      const row = selectMenuOptions.length > 0
        ? new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('quests_board_select')
              .setPlaceholder('Select a quest to accept')
              .addOptions(selectMenuOptions)
          )
        : null;

      const response = await interaction.editReply({
        embeds: [embed],
        components: row ? [row] : []
      });

      if (row) {
        try {
          const selectInteraction = await response.awaitMessageComponent({
            filter: (i) => i.user.id === interaction.user.id,
            time: 60_000,
            componentType: ComponentType.StringSelect
          });

          const questId = selectInteraction.values[0]!;
          const quest = catalog.find((q) => q.id === questId);

          if (!quest) {
            const err = errorEmbed('Quest Not Found', `No quest matching ID **"${questId}"** was found on the board.`);
            await selectInteraction.update({ embeds: [err], components: [] });
            return;
          }

          // Start quest
          await startQuest(player.id, quest.id);

          const successEm = successEmbed(
            'Quest Accepted',
            `You have accepted the quest: **${quest.name}**!\n\n` +
            `*Track your progress using \`/quests active\`.*`
          );
          await selectInteraction.update({ embeds: [successEm], components: [] });
        } catch (e) {
          // Timeout, disable the select menu
          const disabledMenu = new StringSelectMenuBuilder()
            .setCustomId('quests_board_select')
            .setPlaceholder('Quest board timed out')
            .setDisabled(true)
            .addOptions({ label: 'Timed out', value: 'timeout' });
          const disabledRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(disabledMenu);
          try {
            await interaction.editReply({ components: [disabledRow] });
          } catch {}
        }
      }
      return;
    }

    if (subcommand === 'accept') {
      const questId = interaction.options.getString('quest_id', true);
      const quest = catalog.find((q) => q.id === questId);

      if (!quest) {
        const embed = errorEmbed('Quest Not Found', `No quest matching ID **"${questId}"** was found on the board.`);
        return interaction.editReply({ embeds: [embed] });
      }

      if (player.level < quest.levelReq) {
        const embed = errorEmbed(
          'Quest Locked',
          `You must be Level **${quest.levelReq}** to accept this quest.`
        );
        return interaction.editReply({ embeds: [embed] });
      }

      // Check if already active
      const activeDb = await getActiveQuests(player.id);
      if (activeDb.some((q) => q.questId === questId)) {
        const embed = errorEmbed('Already Active', `The quest **"${quest.name}"** is already in your active quest list.`);
        return interaction.editReply({ embeds: [embed] });
      }

      // Check if completed and not repeatable
      const completedIds = await getCompletedQuests(player.id);
      if (completedIds.includes(questId) && !quest.repeatable) {
        const embed = errorEmbed('Quest Completed', `You have already completed the story quest **"${quest.name}"**.`);
        return interaction.editReply({ embeds: [embed] });
      }

      // Start quest
      await startQuest(player.id, quest.id);

      const embed = successEmbed(
        'Quest Accepted',
        `You have accepted the quest: **${quest.name}**!\n\n` +
        `*Track your progress using \`/quests active\`.*`
      );
      return interaction.editReply({ embeds: [embed] });
    }
  } catch (error: any) {
    console.error(error);
    const embed = errorEmbed('Quest Board Error', 'Failed to retrieve quest board data.');
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}


