import { logger } from '../../utils/logger.js';
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  type ChatInputCommandInteraction,
  type ButtonInteraction
} from 'discord.js';
import { errorEmbed } from '../../utils/embeds.js';
import { runGiveItem } from './give.js';
import { runSpawnBoss, runSpawnGlobalBoss } from './bossSpawner.js';
import { runFeedbackResolve, runFeedbackList } from './feedbackAdmin.js';
import { runAssetSet, runAssetRemove, runAssetList } from './assetAdmin.js';

export { runGiveItem } from './give.js';
export { runSpawnBoss, runSpawnGlobalBoss } from './bossSpawner.js';
export { runFeedbackResolve, runFeedbackList } from './feedbackAdmin.js';
export { runAssetSet, runAssetRemove, runAssetList } from './assetAdmin.js';

export const data = new SlashCommandBuilder()
  .setName('admin')
  .setDescription('Admin command panel.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((subcommand) =>
    subcommand
      .setName('give-item')
      .setDescription('Admin: Give an item to a player.')
      .addUserOption((option) =>
        option
          .setName('user')
          .setDescription('The player receiving the item.')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('item')
          .setDescription('Item ID or name.')
          .setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName('quantity')
          .setDescription('Quantity to give (default: 1).')
          .setMinValue(1)
          .setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('spawn-boss')
      .setDescription('Admin: Spawn a World Boss.')
      .addStringOption((option) =>
        option
          .setName('boss_id')
          .setDescription('The ID of the boss to spawn (e.g. mushroom_guardian).')
          .setRequired(true)
          .addChoices(
            { name: 'Mushroom Guardian (Lv.3)', value: 'mushroom_guardian' },
            { name: 'Ancient Hollow (Lv.6)', value: 'ancient_hollow' },
            { name: 'Crystal Colossus (Lv.10)', value: 'crystal_colossus' },
            { name: 'Infernal Titan (Lv.15)', value: 'infernal_titan' },
            { name: 'The Nameless One (Lv.20)', value: 'the_nameless_one' }
          )
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('spawn-global-boss')
      .setDescription('Admin: Spawn a Global World Boss.')
      .addStringOption((option) =>
        option
          .setName('boss_id')
          .setDescription('The ID of the boss to spawn (e.g. mushroom_guardian).')
          .setRequired(true)
          .addChoices(
            { name: 'Mushroom Guardian (Lv.3)', value: 'mushroom_guardian' },
            { name: 'Ancient Hollow (Lv.6)', value: 'ancient_hollow' },
            { name: 'Crystal Colossus (Lv.10)', value: 'crystal_colossus' },
            { name: 'Infernal Titan (Lv.15)', value: 'infernal_titan' },
            { name: 'The Nameless One (Lv.20)', value: 'the_nameless_one' }
          )
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('asset-set')
      .setDescription('Admin: Set or update a custom emoji asset.')
      .addStringOption((option) =>
        option
          .setName('type')
          .setDescription('The type of asset.')
          .setRequired(true)
          .addChoices(
            { name: 'Item', value: 'item' },
            { name: 'Class', value: 'class' },
            { name: 'Pet', value: 'pet' },
            { name: 'Achievement', value: 'achievement' },
            { name: 'Currency', value: 'currency' }
          )
      )
      .addStringOption((option) =>
        option
          .setName('id')
          .setDescription('The unique ID of the entity (e.g. weapon_wooden_sword, warrior, gold).')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('emoji')
          .setDescription('The custom Discord emoji string (e.g. <:wooden_sword:1234567890>).')
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('asset-remove')
      .setDescription('Admin: Remove a custom emoji asset.')
      .addStringOption((option) =>
        option
          .setName('id')
          .setDescription('The unique ID of the entity.')
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('asset-list')
      .setDescription('Admin: List assets by type and configuration status.')
      .addStringOption((option) =>
        option
          .setName('type')
          .setDescription('The type of assets to list.')
          .setRequired(true)
          .addChoices(
            { name: 'Item', value: 'item' },
            { name: 'Class', value: 'class' },
            { name: 'Pet', value: 'pet' },
            { name: 'Achievement', value: 'achievement' },
            { name: 'Currency', value: 'currency' }
          )
      )
      .addStringOption((option) =>
        option
          .setName('filter')
          .setDescription('Filter by configuration status.')
          .setRequired(true)
          .addChoices(
            { name: 'All', value: 'all' },
            { name: 'Configured (With Custom Emoji)', value: 'configured' },
            { name: 'Unconfigured (Missing Custom Emoji)', value: 'unconfigured' }
          )
      )
      .addIntegerOption((option) =>
        option
          .setName('page')
          .setDescription('Page number.')
          .setRequired(false)
          .setMinValue(1)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('feedback-list')
      .setDescription('Admin: List submitted player feedbacks.')
      .addStringOption((option) =>
        option
          .setName('status')
          .setDescription('Filter by status (default: open).')
          .setRequired(false)
          .addChoices(
            { name: 'Open (Pending)', value: 'open' },
            { name: 'Resolved', value: 'resolved' },
            { name: 'All', value: 'all' }
          )
      )
      .addIntegerOption((option) =>
        option
          .setName('page')
          .setDescription('Page number.')
          .setRequired(false)
          .setMinValue(1)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('feedback-resolve')
      .setDescription('Admin: Mark a feedback entry as resolved.')
      .addStringOption((option) =>
        option
          .setName('id')
          .setDescription('The UUID of the feedback entry.')
          .setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    // Double check admin permission
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      const embed = errorEmbed('Unauthorized', 'Only server administrators can use this command.');
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'give-item') {
      await runGiveItem(interaction);
    } else if (subcommand === 'spawn-boss') {
      await runSpawnBoss(interaction);
    } else if (subcommand === 'spawn-global-boss') {
      await runSpawnGlobalBoss(interaction);
    } else if (subcommand === 'asset-set') {
      await runAssetSet(interaction);
    } else if (subcommand === 'asset-remove') {
      await runAssetRemove(interaction);
    } else if (subcommand === 'asset-list') {
      const type = interaction.options.getString('type', true);
      const filter = interaction.options.getString('filter', true);
      const page = interaction.options.getInteger('page') || 1;
      await runAssetList(interaction, type, filter, page);
    } else if (subcommand === 'feedback-list') {
      const statusFilter = interaction.options.getString('status') || 'open';
      const page = interaction.options.getInteger('page') || 1;
      await runFeedbackList(interaction, statusFilter, page);
    } else if (subcommand === 'feedback-resolve') {
      await runFeedbackResolve(interaction);
    }
  } catch (error: any) {
    logger.error({ err: error }, 'Admin command error:');
    const embed = errorEmbed('Admin Error', 'Failed to execute admin command.');
    await interaction.editReply({ embeds: [embed] });
  }
}

export async function handleAdminInteraction(interaction: ButtonInteraction) {
  const customId = interaction.customId;
  if (!customId.startsWith('admin_')) return;

  const parts = customId.split('_');
  const type = parts[1];
  const userId = parts[3];

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: '❌ This admin list menu is not yours!',
      flags: [MessageFlags.Ephemeral]
    });
    return;
  }

  await interaction.deferUpdate();

  if (type === 'assetlist') {
    const assetType = parts[4]!;
    const filter = parts[5]!;
    const targetPage = parseInt(parts[6] || '1', 10);
    await runAssetList(interaction, assetType, filter, targetPage);
  } else if (type === 'feedbacklist') {
    const statusFilter = parts[4]!;
    const targetPage = parseInt(parts[5] || '1', 10);
    await runFeedbackList(interaction, statusFilter, targetPage);
  }
}
