import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { findOrCreatePlayer } from '../../database/queries/player.js';
import { getShopItems, buyItem } from '../../economy/shop.js';
import { successEmbed, errorEmbed, shopEmbed } from '../../utils/embeds.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
      .setDescription('Buy an item from the shop.')
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

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply();

    const discordId = interaction.user.id;
    const username = interaction.user.username;

    // Load player
    const player = await findOrCreatePlayer(discordId, username);

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'list') {
      const page = interaction.options.getInteger('page') || 1;
      const pageSize = 10;

      const shopData = getShopItems(player.level, page, pageSize);

      const mappedItems = shopData.items.map((i) => ({
        name: i.name,
        price: i.buyPrice,
        rarity: i.rarity,
        description: `[Lv.${i.levelReq}] ${i.description}`
      }));

      const totalPages = Math.max(1, shopData.totalPages);

      const embed = shopEmbed(mappedItems, page, totalPages);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (subcommand === 'buy') {
      const inputName = interaction.options.getString('item', true).toLowerCase();
      const quantity = interaction.options.getInteger('quantity') || 1;

      const catalog = loadItemsCatalog();

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
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}

function loadItemsCatalog(): any[] {
  const filePath = join(__dirname, '..', '..', '..', 'data', 'items.json');
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}
