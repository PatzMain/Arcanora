import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction
} from 'discord.js';
import { runBag } from './bag.js';
import { runEquip } from './equip.js';
import { runSell } from './sell.js';

export { runBag, handleBagInteraction } from './bag.js';
export { runEquip, handleEquipInteraction } from './equip.js';
export { runSell, handleSellInteraction } from './sell.js';

export const data = new SlashCommandBuilder()
  .setName('inventory')
  .setDescription('Manage your equipment, bag, and sell items.')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('bag')
      .setDescription('View items in your bag.')
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
      .setName('equip')
      .setDescription('Equip an item from your bag.')
      .addStringOption((option) =>
        option
          .setName('item')
          .setDescription('Name or ID of the item to equip.')
          .setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('sell')
      .setDescription('Sell an item from your bag back to the NPC shop.')
      .addStringOption((option) =>
        option
          .setName('item')
          .setDescription('Name or ID of the item to sell.')
          .setRequired(false)
      )
      .addIntegerOption((option) =>
        option
          .setName('quantity')
          .setDescription('Quantity to sell (default: 1).')
          .setMinValue(1)
          .setRequired(false)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();
  if (subcommand === 'bag') {
    const page = interaction.options.getInteger('page') || 1;
    await runBag(interaction, page);
  } else if (subcommand === 'equip') {
    const item = interaction.options.getString('item') || undefined;
    await runEquip(interaction, item);
  } else if (subcommand === 'sell') {
    const item = interaction.options.getString('item') || undefined;
    const quantity = interaction.options.getInteger('quantity') || 1;
    await runSell(interaction, item, quantity);
  }
}
