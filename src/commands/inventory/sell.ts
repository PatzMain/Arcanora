import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { findOrCreatePlayer } from '../../database/queries/player.js';
import { sellItem } from '../../economy/shop.js';
import { db } from '../../database/client.js';
import { inventory } from '../../database/schema.js';
import { eq } from 'drizzle-orm';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const data = new SlashCommandBuilder()
  .setName('sell')
  .setDescription('Sell an item from your bag back to the NPC shop.')
  .addStringOption((option) =>
    option
      .setName('item')
      .setDescription('Name or ID of the item to sell.')
      .setRequired(true)
  )
  .addIntegerOption((option) =>
    option
      .setName('quantity')
      .setDescription('Quantity to sell (default: 1).')
      .setMinValue(1)
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply();

    const discordId = interaction.user.id;
    const username = interaction.user.username;

    // Load player
    const player = await findOrCreatePlayer(discordId, username);

    const inputName = interaction.options.getString('item', true).toLowerCase();
    const quantity = interaction.options.getInteger('quantity') || 1;

    // Fetch player inventory
    const dbInventory = await db
      .select()
      .from(inventory)
      .where(eq(inventory.playerId, player.id));

    const catalog = loadItemsCatalog();

    // Find non-equipped item
    const targetItem = dbInventory.find((dbItem) => {
      if (dbItem.equipped) return false;
      const def = catalog.find((i) => i.id === dbItem.itemId);
      if (!def) return false;
      return (
        def.id.toLowerCase() === inputName ||
        def.name.toLowerCase().includes(inputName)
      );
    });

    if (!targetItem) {
      const embed = errorEmbed('Item Not Found', `No sellable item matching **"${inputName}"** was found in your bag.`);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const itemDef = catalog.find((i) => i.id === targetItem.itemId);
    if (!itemDef) {
      const embed = errorEmbed('Sell Error', 'Item catalog definition is missing.');
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (itemDef.sellPrice <= 0) {
      const embed = errorEmbed('Not Sellable', `**${itemDef.name}** cannot be sold back to the shop.`);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Call sellItem from economy shop system
    const result = await sellItem(player.id, targetItem.id, quantity);

    if (!result.success) {
      const embed = errorEmbed('Sell Failed', result.message);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const embed = successEmbed(
      'Item Sold',
      `You successfully sold **x${quantity}** **${itemDef.name}** for 🪙 **${result.earned?.toLocaleString()}** Gold.\n\n` +
      `*NPC purchase rate is standard. Value was added directly to your pouch.*`
    );
    await interaction.editReply({ embeds: [embed] });

  } catch (error: any) {
    console.error(error);
    const embed = errorEmbed('Sell Error', 'Failed to sell the item.');
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
