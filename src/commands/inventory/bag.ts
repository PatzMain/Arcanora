import {
  ButtonStyle,
  ButtonBuilder,
  ActionRowBuilder,
  type ChatInputCommandInteraction,
  type ButtonInteraction
} from 'discord.js';
import { findOrCreatePlayer } from '../../database/queries/player.js';
import { getPlayerInventory } from '../../database/queries/inventory.js';
import { itemsCatalog } from '../../utils/catalog.js';
import { inventoryEmbed, errorEmbed } from '../../utils/embeds.js';
import { getNavButtons } from '../../utils/navigation.js';

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export async function runBag(
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
    const currentPage = pageNum || 1;
    const pageSize = 10;
    const catalog = itemsCatalog;

    const invData = await getPlayerInventory(player.id, currentPage, pageSize);
    const mappedItems = invData.items.map((dbItem) => {
      const def = catalog.find((i) => i.id === dbItem.itemId);
      let name = def ? def.name : dbItem.itemId;
      return {
        name,
        quantity: dbItem.quantity,
        rarity: def?.rarity || 'common',
        id: dbItem.itemId,
        slot: dbItem.equipped ? (def?.type ? capitalize(def.type) : 'Equipped') : undefined,
        equipped: dbItem.equipped,
        type: def?.type || 'item',
        stats: def?.stats,
        levelReq: def?.levelReq,
        enhancement: dbItem.enhancement
      };
    });
    const totalPages = Math.max(1, invData.totalPages);
    const embed = inventoryEmbed(mappedItems, currentPage, totalPages);

    // 1. Pagination Buttons
    const prevBtn = new ButtonBuilder()
      .setCustomId(`bag_prev_${player.discordId}_${currentPage - 1}`)
      .setLabel('◀️ Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage <= 1);

    const nextBtn = new ButtonBuilder()
      .setCustomId(`bag_next_${player.discordId}_${currentPage + 1}`)
      .setLabel('Next ▶️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage >= totalPages);

    const paginationRow = new ActionRowBuilder<ButtonBuilder>().addComponents(prevBtn, nextBtn);
    
    // 2. Navigation Actions Row (Equip, Sell, Shop)
    const navButtons = getNavButtons('inventory_bag', player.discordId);
    
    const components: any[] = [];
    if (totalPages > 1) {
      components.push(paginationRow);
    }
    if (navButtons) {
      components.push(navButtons);
    }

    await interaction.editReply({
      embeds: [embed],
      components
    });
  } catch (error) {
    console.error('Error running bag:', error);
    const embed = errorEmbed('Bag Error', 'Failed to retrieve your bag contents.');
    await interaction.editReply({ embeds: [embed], components: [] });
  }
}

export async function handleBagInteraction(interaction: ButtonInteraction) {
  const parts = interaction.customId.split('_'); // bag_prev_{userId}_{page} or bag_next_{userId}_{page}
  const userId = parts[2];
  const targetPage = parseInt(parts[3] || '1');

  if (interaction.user.id !== userId) {
    return;
  }

  await runBag(interaction, targetPage);
}
