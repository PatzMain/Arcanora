import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { findOrCreatePlayer } from '../../database/queries/player.js';
import { getPlayerInventory } from '../../database/queries/inventory.js';
import { inventoryEmbed, errorEmbed } from '../../utils/embeds.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const data = new SlashCommandBuilder()
  .setName('bag')
  .setDescription('View items in your bag.')
  .addIntegerOption((option) =>
    option
      .setName('page')
      .setDescription('Page number to view.')
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

    const page = interaction.options.getInteger('page') || 1;
    const pageSize = 10;

    const invData = await getPlayerInventory(player.id, page, pageSize);

    const catalog = loadItemsCatalog();

    const mappedItems = invData.items.map((dbItem) => {
      const def = catalog.find((i) => i.id === dbItem.itemId);
      let name = def ? def.name : dbItem.itemId;
      if (dbItem.enhancement > 0) {
        name += ` +${dbItem.enhancement}`;
      }
      return {
        name,
        quantity: dbItem.quantity,
        rarity: def?.rarity || 'common',
        slot: dbItem.equipped ? (def?.type ? capitalize(def.type) : 'Equipped') : undefined
      };
    });

    const totalPages = Math.max(1, invData.totalPages);

    const embed = inventoryEmbed(mappedItems, page, totalPages);
    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    console.error(error);
    const embed = errorEmbed('Bag Error', 'Failed to retrieve your bag contents.');
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

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
