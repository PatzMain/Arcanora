import { logger } from '../../utils/logger.js';
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
import { successEmbed, errorEmbed, shopEmbed, COLORS } from '../../utils/embeds.js';
import { db } from '../../database/client.js';
import { players } from '../../database/schema.js';
import { eq } from 'drizzle-orm';
import { itemsCatalog } from '../../utils/catalog.js';
import { getNavButtons } from '../../utils/navigation.js';
import { getItemEmoji, getCurrencyEmoji } from '../../utils/emojis.js';

function parseEmojiForSelect(emojiStr: string): string | { id: string; name?: string } {
  const match = emojiStr.match(/<a?:([a-zA-Z0-9_]+):([0-9]+)>/);
  if (match && match[1] && match[2]) {
    return { name: match[1], id: match[2] };
  }
  return emojiStr;
}

export const data = new SlashCommandBuilder()
  .setName('economy')
  .setDescription('Manage your currency, view the shop, or buy items.')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('balance')
      .setDescription('View your gold and gem balances.')
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('shop')
      .setDescription('Browse items available for NPC shop purchase.')
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
  const pageSize = 8;
  const shopData = getShopItems(player.level, page, pageSize);
  const totalPages = Math.max(1, shopData.totalPages);
  const activePage = Math.max(1, Math.min(page, totalPages));

  const embed = shopEmbed(shopData.items as any, activePage, totalPages, player.gold, statusMsg);

  // 1. Navigation buttons row
  const prevBtn = new ButtonBuilder()
    .setCustomId(`shop_prev_${player.discordId}_${activePage}`)
    .setLabel('Previous')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('◀️')
    .setDisabled(activePage === 1);

  const nextBtn = new ButtonBuilder()
    .setCustomId(`shop_next_${player.discordId}_${activePage}`)
    .setLabel('Next')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('▶️')
    .setDisabled(activePage === totalPages);

  const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(prevBtn, nextBtn);

  const components: any[] = [btnRow];

  // 2. Select menu row for purchasing items
  if (shopData.items.length > 0) {
    const selectOptions = shopData.items.map((i) => {
      const emojiStr = getItemEmoji(i.id, i.rarity);
      return {
        label: i.name.slice(0, 25),
        description: `Price: ${i.buyPrice}g | Level Req: ${i.levelReq}`,
        value: i.id,
        emoji: parseEmojiForSelect(emojiStr)
      };
    });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`shop_buy_select_${player.discordId}_${activePage}`)
      .setPlaceholder('Select an item to purchase (1x)...')
      .addOptions(selectOptions);

    const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
    components.push(selectRow);
  }

  // 3. Contextual Navigation buttons
  const navRow = getNavButtons('economy_shop', player.discordId);
  if (navRow) {
    components.push(navRow);
  }

  return { embeds: [embed], components };
}

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();
  if (subcommand === 'balance') {
    await runBalance(interaction);
  } else if (subcommand === 'shop') {
    const page = interaction.options.getInteger('page') || 1;
    await runShopList(interaction, page);
  } else if (subcommand === 'buy') {
    const item = interaction.options.getString('item', true);
    const quantity = interaction.options.getInteger('quantity') || 1;
    await runShopBuy(interaction, item, quantity);
  }
}

// ----------------------------------------------------
// RUNNERS (exposures for slash commands and buttons)
// ----------------------------------------------------

export async function runBalance(
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

    const embed = successEmbed(
      'Wallet Balance',
      `💰 **${player.username}'s Pouch**\n\n` +
      `🪙 Gold: **${player.gold.toLocaleString()}**\n` +
      `💎 Gems: **${player.gems.toLocaleString()}**`
    );
    embed.setColor(COLORS.SHOP);

    const navButtons = getNavButtons('economy_shop', player.discordId);

    await interaction.editReply({
      embeds: [embed],
      components: navButtons ? [navButtons] : []
    });
  } catch (error) {
    logger.error({ err: error }, 'Error running balance:');
    const embed = errorEmbed('Balance Error', 'Failed to retrieve your currency balances.');
    await interaction.editReply({ embeds: [embed], components: [] });
  }
}

export async function runShopList(
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
    const page = pageNum || 1;
    const messageOptions = getShopMessageOptions(player, page);
    await interaction.editReply(messageOptions);
  } catch (error) {
    logger.error({ err: error }, 'Error running shop list:');
    const embed = errorEmbed('Shop Error', 'Failed to load shop list.');
    await interaction.editReply({ embeds: [embed], components: [] });
  }
}

export async function runShopBuy(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  itemInput: string,
  quantityInput?: number
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
    const quantity = quantityInput || 1;
    const catalog = itemsCatalog;

    const inputName = itemInput.toLowerCase();
    const itemDef = catalog.find(
      (i) =>
        i.id.toLowerCase() === inputName ||
        i.name.toLowerCase().includes(inputName)
    );

    if (!itemDef) {
      const embed = errorEmbed('Item Not Found', `No shop item matching **"${itemInput}"** was found.`);
      await interaction.editReply({ embeds: [embed], components: [] });
      return;
    }

    if (itemDef.buyPrice <= 0) {
      const embed = errorEmbed('Not for Sale', `**${itemDef.name}** is not sold in this shop.`);
      await interaction.editReply({ embeds: [embed], components: [] });
      return;
    }

    const result = await buyItem(player.id, itemDef.id, quantity);

    if (!result.success) {
      const embed = errorEmbed('Purchase Failed', result.message);
      await interaction.editReply({ embeds: [embed], components: [] });
      return;
    }

    const embed = successEmbed(
      'Item Purchased',
      `You successfully purchased **x${quantity}** **${itemDef.name}** for 🪙 **${result.spent?.toLocaleString()}** Gold.\n\n` +
      `*Items have been added to your bag.*`
    );

    const navButtons = getNavButtons('economy_buy_result', player.discordId);

    await interaction.editReply({
      embeds: [embed],
      components: navButtons ? [navButtons] : []
    });
  } catch (error) {
    logger.error({ err: error }, 'Error running shop buy:');
    const embed = errorEmbed('Shop Error', 'An unexpected error occurred in the shop.');
    await interaction.editReply({ embeds: [embed], components: [] });
  }
}

// ----------------------------------------------------
// INTERACTION HANDLERS (routed from interactionCreate)
// ----------------------------------------------------

export async function handleShopInteraction(interaction: ButtonInteraction | StringSelectMenuInteraction) {
  try {
    const discordId = interaction.user.id;
    const customId = interaction.customId;
    const parts = customId.split('_');

    const ownerDiscordId = interaction.isButton() ? parts[2] : parts[3];

    if (interaction.user.id !== ownerDiscordId) {
      const embed = errorEmbed('Access Denied', 'This merchant shop menu is not yours!');
      await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
      return;
    }

    const player = await db.query.players.findFirst({
      where: eq(players.discordId, discordId)
    });

    if (!player) {
      const embed = errorEmbed('Account Required', 'You must create an account first. Type `/tutorial` to start.');
      await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
      return;
    }

    if (interaction.isButton()) {
      const action = parts[1] || 'next';
      const currentPage = parseInt(parts[3] || '1');
      const targetPage = action === 'prev' ? currentPage - 1 : currentPage + 1;

      const messageOptions = getShopMessageOptions(player, targetPage);
      await interaction.update(messageOptions);
      return;
    }

    if (interaction.isStringSelectMenu()) {
      const currentPage = parseInt(parts[4] || '1');
      const itemId = interaction.values[0];

      if (!itemId) {
        throw new Error('No item selected');
      }

      const result = await buyItem(player.id, itemId, 1);

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
    logger.error({ err: error }, 'Shop interaction error:');
    const embed = errorEmbed('Shop Interaction Error', 'Failed to process your shop action.');
    await interaction.followUp({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
  }
}
