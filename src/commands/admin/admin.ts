import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  type ChatInputCommandInteraction,
  type ButtonInteraction
} from 'discord.js';
import { findOrCreatePlayer } from '../../database/queries/player.js';
import { addItem } from '../../database/queries/inventory.js';
import { getEnemyById } from '../../systems/combat/enemy.js';
import { calculateWorldBossHp } from '../../systems/bosses.js';
import { db } from '../../database/client.js';
import { worldBosses, feedbacks } from '../../database/schema.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { eq, desc } from 'drizzle-orm';
import { itemsCatalog, classesCatalog, petsCatalog, achievementsCatalog } from '../../utils/catalog.js';
import { setCustomAsset, removeCustomAsset, emojiCache } from '../../utils/emojis.js';

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
      const targetUser = interaction.options.getUser('user', true);
      const inputName = interaction.options.getString('item', true).toLowerCase();
      const quantity = interaction.options.getInteger('quantity') || 1;

      const targetPlayer = await findOrCreatePlayer(targetUser.id, targetUser.username);

      const catalog = itemsCatalog;
      const itemDef = catalog.find(
        (i) =>
          i.id.toLowerCase() === inputName ||
          i.name.toLowerCase().includes(inputName)
      );

      if (!itemDef) {
        const embed = errorEmbed('Item Not Found', `No item matching **"${inputName}"** was found in the catalog.`);
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      await addItem(targetPlayer.id, itemDef.id, quantity);

      const embed = successEmbed(
        'Admin Grant Success',
        `You successfully gave **x${quantity}** **${itemDef.name}** \`(${itemDef.id})\` to **${targetUser.username}**.`
      );
      await interaction.editReply({ embeds: [embed] });

    } else if (subcommand === 'spawn-boss') {
      const bossId = interaction.options.getString('boss_id', true);
      const enemyDef = getEnemyById(bossId);

      if (!enemyDef || enemyDef.rarity !== 'boss') {
        const embed = errorEmbed('Invalid Boss ID', 'The specified enemy ID is not a registered boss.');
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const memberCount = interaction.guild?.memberCount || 10;
      const computedMaxHp = calculateWorldBossHp(enemyDef.stats.hp, memberCount, false);

      await db
        .insert(worldBosses)
        .values({
          bossId: enemyDef.id,
          hpCurrent: computedMaxHp,
          hpMax: computedMaxHp,
          channelId: interaction.channelId || ''
        })
        .returning();

      const announcement = successEmbed(
        '🚨 WORLD BOSS SPAWNED! 🚨',
        `🛡️ An ancient threat has emerged in the server!\n\n` +
        `👿 **${enemyDef.name}** (Lv.**${enemyDef.level}**)\n` +
        `❤️ Health: **${computedMaxHp.toLocaleString()}** / **${computedMaxHp.toLocaleString()}**\n\n` +
        `*All adventurers are summoned to battle! Fight the boss to earn legendary loot.*`
      );
      announcement.setColor(0xEF4444);

      await (interaction.channel as any)?.send({ embeds: [announcement] });

      const replyEmbed = successEmbed('Boss Spawned', `Spawned boss **${enemyDef.name}** with **${computedMaxHp.toLocaleString()}** HP.`);
      await interaction.editReply({ embeds: [replyEmbed] });
    } else if (subcommand === 'spawn-global-boss') {
      const bossId = interaction.options.getString('boss_id', true);
      const enemyDef = getEnemyById(bossId);

      if (!enemyDef || enemyDef.rarity !== 'boss') {
        const embed = errorEmbed('Invalid Boss ID', 'The specified enemy ID is not a registered boss.');
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const computedMaxHp = calculateWorldBossHp(enemyDef.stats.hp, 10, true);

      await db
        .insert(worldBosses)
        .values({
          bossId: enemyDef.id,
          hpCurrent: computedMaxHp,
          hpMax: computedMaxHp,
          channelId: 'GLOBAL'
        })
        .returning();

      const announcement = successEmbed(
        '🚨 GLOBAL WORLD BOSS SPAWNED! 🚨',
        `🛡️ An ancient global threat has emerged!\n\n` +
        `👿 **${enemyDef.name}** (Lv.**${enemyDef.level}**)\n` +
        `❤️ Health: **${computedMaxHp.toLocaleString()}** / **${computedMaxHp.toLocaleString()}**\n\n` +
        `*All adventurers from all channels are summoned to battle! Type \`/boss fight\` to join the raid.*`
      );
      announcement.setColor(0xEF4444);

      await (interaction.channel as any)?.send({ embeds: [announcement] });

      const replyEmbed = successEmbed('Global Boss Spawned', `Spawned global boss **${enemyDef.name}** with **${computedMaxHp.toLocaleString()}** HP.`);
      await interaction.editReply({ embeds: [replyEmbed] });
    } else if (subcommand === 'asset-set') {
      const type = interaction.options.getString('type', true);
      const id = interaction.options.getString('id', true).trim();
      const emojiInput = interaction.options.getString('emoji', true).trim();

      // Validate emoji format (custom Discord emoji format or standard Unicode emoji)
      const emojiRegex = /^(?:<a?:[a-zA-Z0-9_]+:[0-9]+>|[\p{Emoji}\u200d]+)$/u;
      if (!emojiRegex.test(emojiInput)) {
        const embed = errorEmbed(
          'Invalid Emoji Format',
          'Please provide a valid custom Discord emoji in the format `<:name:id>` or `<a:name:id>`, or a standard Unicode emoji.'
        );
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Check if entity exists in catalogs to prevent typos
      let exists = false;
      if (type === 'item') {
        exists = itemsCatalog.some((i) => i.id === id);
      } else if (type === 'class') {
        exists = id === 'novice' || classesCatalog.some((c) => c.id === id);
      } else if (type === 'pet') {
        exists = petsCatalog.some((p) => p.id === id);
      } else if (type === 'achievement') {
        exists = achievementsCatalog.some((a) => a.id === id);
      } else if (type === 'currency') {
        exists = id === 'gold' || id === 'gems';
      }

      if (!exists) {
        const embed = errorEmbed(
          'Entity Not Found',
          `No **${type}** found with the ID **"${id}"** in the static catalog. Please check your spelling.`
        );
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      await setCustomAsset(id, type, emojiInput);

      const embed = successEmbed(
        'Asset Configuration Saved',
        `Successfully associated **${type}** ID \`${id}\` with custom asset ${emojiInput}.`
      );
      await interaction.editReply({ embeds: [embed] });

    } else if (subcommand === 'asset-remove') {
      const id = interaction.options.getString('id', true).trim();

      const cached = emojiCache.get(id);
      if (!cached) {
        const embed = errorEmbed('Asset Not Found', `No custom asset is configured for ID \`${id}\`.`);
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      await removeCustomAsset(id);

      const embed = successEmbed(
        'Asset Removed',
        `Successfully removed custom asset for ID \`${id}\` (was set to \`${cached.emoji}\`).`
      );
      await interaction.editReply({ embeds: [embed] });

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
      const feedbackId = interaction.options.getString('id', true).trim();

      const feedback = await db.query.feedbacks.findFirst({
        where: eq(feedbacks.id, feedbackId)
      });

      if (!feedback) {
        const embed = errorEmbed('Feedback Not Found', `No feedback entry found with ID \`${feedbackId}\`.`);
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (feedback.status === 'resolved') {
        const embed = errorEmbed('Already Resolved', `Feedback with ID \`${feedbackId}\` is already resolved.`);
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      await db.update(feedbacks)
        .set({ status: 'resolved' })
        .where(eq(feedbacks.id, feedbackId));

      const embed = successEmbed(
        'Feedback Resolved',
        `Successfully marked feedback \`${feedbackId}\` by **${feedback.username}** as **resolved**.`
      );
      embed.setColor(0x10B981);
      await interaction.editReply({ embeds: [embed] });
    }
  } catch (error: any) {
    console.error('Admin command error:', error);
    const embed = errorEmbed('Admin Error', 'Failed to execute admin command.');
    await interaction.editReply({ embeds: [embed] });
  }
}

export async function runAssetList(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  type: string,
  filter: string,
  page: number
) {
  const userId = interaction.user.id;
  const pageSize = 15;

  let allEntities: { id: string; name: string }[] = [];

  if (type === 'item') {
    allEntities = itemsCatalog.map((i) => ({ id: i.id, name: i.name }));
  } else if (type === 'class') {
    allEntities = [
      { id: 'novice', name: 'Novice' },
      ...classesCatalog.map((c) => ({ id: c.id, name: c.name }))
    ];
  } else if (type === 'pet') {
    allEntities = petsCatalog.map((p) => ({ id: p.id, name: p.name }));
  } else if (type === 'achievement') {
    allEntities = achievementsCatalog.map((a) => ({ id: a.id, name: a.name }));
  } else if (type === 'currency') {
    allEntities = [
      { id: 'gold', name: 'Gold' },
      { id: 'gems', name: 'Gems' }
    ];
  }

  const filteredEntities = allEntities.filter((entity) => {
    const hasAsset = emojiCache.has(entity.id);
    if (filter === 'configured') return hasAsset;
    if (filter === 'unconfigured') return !hasAsset;
    return true;
  });

  const totalItems = filteredEntities.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const activePage = Math.min(page, totalPages);
  const startIndex = (activePage - 1) * pageSize;
  const paginatedEntities = filteredEntities.slice(startIndex, startIndex + pageSize);

  const listLines = paginatedEntities.map((entity, idx) => {
    const num = (startIndex + idx + 1).toString().padStart(2, '0');
    const asset = emojiCache.get(entity.id);
    const assetDisplay = asset ? asset.emoji : '*(No custom asset)*';
    return `\`${num}\` **${entity.name}** \`(${entity.id})\` — ${assetDisplay}`;
  }).join('\n');

  const filterTitle = filter === 'configured' ? 'Configured' : filter === 'unconfigured' ? 'Unconfigured' : 'All';
  const description = `### Listing: ${filterTitle} ${type.toUpperCase()} Assets (${totalItems} total)\n\n` +
    (listLines || '*No entities found matching these criteria.*');

  const embed = new EmbedBuilder()
    .setTitle(`${type.toUpperCase()} Asset List`)
    .setDescription(description)
    .setColor(0x7C3AED)
    .setFooter({ text: `Arcanora Assets • Page ${activePage}/${totalPages}` });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`admin_assetlist_prev_${userId}_${type}_${filter}_${activePage - 1}`)
      .setLabel('Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(activePage <= 1),
    new ButtonBuilder()
      .setCustomId(`admin_assetlist_next_${userId}_${type}_${filter}_${activePage + 1}`)
      .setLabel('Next')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(activePage >= totalPages)
  );

  await interaction.editReply({
    embeds: [embed],
    components: totalPages > 1 ? [row] : []
  });
}

export async function runFeedbackList(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  statusFilter: string,
  page: number
) {
  const userId = interaction.user.id;
  const pageSize = 5;

  let queryConditions;
  if (statusFilter !== 'all') {
    queryConditions = eq(feedbacks.status, statusFilter);
  }

  const allFeedbacks = await db.query.feedbacks.findMany({
    where: queryConditions,
    orderBy: [desc(feedbacks.createdAt)],
  });

  const totalItems = allFeedbacks.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const activePage = Math.min(page, totalPages);
  const startIndex = (activePage - 1) * pageSize;
  const paginatedFeedbacks = allFeedbacks.slice(startIndex, startIndex + pageSize);

  const embed = new EmbedBuilder()
    .setTitle(`📝 Player Feedback List`)
    .setColor(0x7C3AED)
    .setFooter({ text: `Arcanora Feedback • Page ${activePage}/${totalPages} • Total: ${totalItems}` });

  if (paginatedFeedbacks.length === 0) {
    embed.setDescription(`*No feedback entries found with status "${statusFilter}".*`);
  } else {
    const descriptionLines = paginatedFeedbacks.map((f) => {
      const dateStr = f.createdAt.toLocaleDateString();
      const statusEmoji = f.status === 'resolved' ? '✅' : '⏳';
      return `**ID**: \`${f.id}\`\n` +
             `👤 **Player**: ${f.username} (${statusEmoji} *${f.status}*)\n` +
             `🏷️ **Category**: \`${f.category}\` • 📅 **Date**: ${dateStr}\n` +
             `💬 **Feedback**:\n> ${f.content.replace(/\n/g, '\n> ')}\n` +
             `───────────────────`;
    });
    embed.setDescription(`### Status: ${statusFilter.toUpperCase()}\n\n` + descriptionLines.join('\n\n'));
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`admin_feedbacklist_prev_${userId}_${statusFilter}_${activePage - 1}`)
      .setLabel('Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(activePage <= 1),
    new ButtonBuilder()
      .setCustomId(`admin_feedbacklist_next_${userId}_${statusFilter}_${activePage + 1}`)
      .setLabel('Next')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(activePage >= totalPages)
  );

  await interaction.editReply({
    embeds: [embed],
    components: totalPages > 1 ? [row] : []
  });
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
