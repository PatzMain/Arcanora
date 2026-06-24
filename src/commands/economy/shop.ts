import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  type StringSelectMenuInteraction
} from 'discord.js';
import { findOrCreatePlayer } from '../../database/queries/player.js';
import { getShopItems, buyItem } from '../../economy/shop.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { db } from '../../database/client.js';
import { players } from '../../database/schema.js';
import { eq } from 'drizzle-orm';
import { itemsCatalog } from '../../utils/catalog.js';

export const data = new SlashCommandBuilder()
  .setName('shop')
  .setDescription('Browse the NPC shop or buy items.')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('list')
      .setDescription('Browse items available for purchase.')
      .addIntegerOption((option) =>
        option
          .setName('page')
          .setDescription('Page number to view.')
          .setMinValue(1)
          .setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('buy')
      .setDescription('Buy an item from the shop with a custom quantity.')
      .addStringOption((option) =>
        option
          .setName('item')
          .setDescription('Name or ID of the item to buy.')
          .setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName('quantity')
          .setDescription('Quantity to purchase.')
          .setMinValue(1)
          .setRequired(false)
      )
  );

// Helper function to build the interactive shop message options
export function getShopMessageOptions(player: any, page: number, statusMsg?: string) {
  const pageSize = 8; // Use 8 items per page for cleaner Discord UI spacing
  const shopData = getShopItems(player.level, page, pageSize);
  const totalPages = Math.max(1, shopData.totalPages);
  const activePage = Math.max(1, Math.min(page, totalPages));

  const RARITY_EMOJIS: Record<string, string> = {
    common: '⚪',
    uncommon: '🟢',
    rare: '🔵',
    epic: '🟣',
    mythic: '🔴'
  };

  const itemLines = shopData.items.length > 0
    ? shopData.items.map((i, idx) => {
        const num = ((activePage - 1) * pageSize + idx + 1).toString().padStart(2, '0');
        const emoji = RARITY_EMOJIS[i.rarity] || '⚪';
        return `\`${num}\` ${emoji} **${i.name}** — 🪙 **${i.buyPrice.toLocaleString()}**g\n   *${i.description}*`;
      }).join('\n')
    : '*No items available.*';

  const embed = new EmbedBuilder()
    .setColor(0xFBBF24) // Gold color
    .setTitle('🏪 NPC Merchant Shop')
    .setDescription(
      `### 💰 Your Balance: 🪙 **${player.gold.toLocaleString()}** Gold\n\n` +
      (statusMsg ? `🔔 **Status**: ${statusMsg}\n\n` : '') +
      itemLines
    )
    .setFooter({ text: `Arcanora — Discord MMORPG • Page ${activePage}/${totalPages}` })
    .setTimestamp();

  // 1. Navigation buttons row
  const prevBtn = new ButtonBuilder()
    .setCustomId(`shop_prev_${activePage}`)
    .setLabel('Previous')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('◀️')
    .setDisabled(activePage === 1);

  const nextBtn = new ButtonBuilder()
    .setCustomId(`shop_next_${activePage}`)
    .setLabel('Next')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('▶️')
    .setDisabled(activePage === totalPages);

  const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(prevBtn, nextBtn);

  // 2. Select menu row for purchasing items
  const components: any[] = [btnRow];

  if (shopData.items.length > 0) {
    const selectOptions = shopData.items.map((i) => {
      const emoji = RARITY_EMOJIS[i.rarity] || '⚪';
      return {
        label: i.name.slice(0, 25),
        description: `Price: ${i.buyPrice}g | Level Req: ${i.levelReq}`,
        value: i.id,
        emoji: emoji
      };
    });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`shop_buy_select_${activePage}`)
      .setPlaceholder('Select an item to purchase (1x)...')
      .addOptions(selectOptions);

    const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
    components.push(selectRow);
  }

  return { embeds: [embed], components };
}

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const discordId = interaction.user.id;
    const username = interaction.user.username;

    // Load player
    const player = await findOrCreatePlayer(discordId, username);

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'list') {
      const page = interaction.options.getInteger('page') || 1;
      const messageOptions = getShopMessageOptions(player, page);
      await interaction.reply(messageOptions);
      return;
    }

    if (subcommand === 'buy') {
      await interaction.deferReply();
      const inputName = interaction.options.getString('item', true).toLowerCase();
      const quantity = interaction.options.getInteger('quantity') || 1;

      const catalog = itemsCatalog;

      // Find the item definition
      const itemDef = catalog.find(
        (i) =>
          i.id.toLowerCase() === inputName ||
          i.name.toLowerCase().includes(inputName)
      );

      if (!itemDef) {
        const embed = errorEmbed('Item Not Found', `No shop item matching **"${inputName}"** was found.`);
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (itemDef.buyPrice <= 0) {
        const embed = errorEmbed('Not for Sale', `**${itemDef.name}** is not sold in this shop.`);
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Execute purchase
      const result = await buyItem(player.id, itemDef.id, quantity);

      if (!result.success) {
        const embed = errorEmbed('Purchase Failed', result.message);
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const embed = successEmbed(
        'Item Purchased',
        `You successfully purchased **x${quantity}** **${itemDef.name}** for 🪙 **${result.spent?.toLocaleString()}** Gold.\n\n` +
        `*Items have been added to your bag.*`
      );
      await interaction.editReply({ embeds: [embed] });
      return;
    }

  } catch (error: any) {
    console.error(error);
    const embed = errorEmbed('Shop Error', 'An unexpected error occurred in the shop.');
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
    } else {
      await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
    }
  }
}

export async function handleShopInteraction(interaction: ButtonInteraction | StringSelectMenuInteraction) {
  try {
    const discordId = interaction.user.id;
    const customId = interaction.customId;

    // Load player
    const player = await db.query.players.findFirst({
      where: eq(players.discordId, discordId)
    });

    if (!player) {
      const embed = errorEmbed('Account Required', 'You must create an account first. Type `/tutorial` to start.');
      await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
      return;
    }

    if (interaction.isButton()) {
      const parts = customId.split('_');
      const action = parts[1] || 'next'; // fallback
      const currentPage = parseInt(parts[2] || '1');
      const targetPage = action === 'prev' ? currentPage - 1 : currentPage + 1;

      const messageOptions = getShopMessageOptions(player, targetPage);
      await interaction.update(messageOptions);
      return;
    }

    if (interaction.isStringSelectMenu()) {
      const parts = customId.split('_');
      const currentPage = parseInt(parts[3] || '1');
      const itemId = interaction.values[0];

      if (!itemId) {
        throw new Error('No item selected');
      }

      // Execute purchase of 1 unit
      const result = await buyItem(player.id, itemId, 1);

      // Fetch updated player details to reflect new gold balance
      const updatedPlayer = await db.query.players.findFirst({
        where: eq(players.id, player.id)
      });

      if (!updatedPlayer) {
        throw new Error('Updated player not found');
      }

      const messageOptions = getShopMessageOptions(updatedPlayer, currentPage, result.message);
      await interaction.update(messageOptions);
      return;
    }
  } catch (error: any) {
    console.error('Shop interaction error:', error);
    const embed = errorEmbed('Shop Interaction Error', 'Failed to process your shop action.');
    await interaction.followUp({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
  }
}


