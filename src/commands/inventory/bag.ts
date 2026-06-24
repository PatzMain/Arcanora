import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, type ChatInputCommandInteraction } from 'discord.js';
import { findOrCreatePlayer } from '../../database/queries/player.js';
import { getPlayerInventory } from '../../database/queries/inventory.js';
import { inventoryEmbed, errorEmbed } from '../../utils/embeds.js';
import { itemsCatalog } from '../../utils/catalog.js';

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

    let currentPage = interaction.options.getInteger('page') || 1;
    const pageSize = 10;
    const catalog = itemsCatalog;

    const getInventoryPageData = async (pageNum: number) => {
      const invData = await getPlayerInventory(player.id, pageNum, pageSize);
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
      const embed = inventoryEmbed(mappedItems, pageNum, totalPages);

      const prevBtn = new ButtonBuilder()
        .setCustomId('bag_prev')
        .setLabel('◀️ Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pageNum <= 1);

      const nextBtn = new ButtonBuilder()
        .setCustomId('bag_next')
        .setLabel('Next ▶️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pageNum >= totalPages);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(prevBtn, nextBtn);
      return { embed, row, totalPages };
    };

    let { embed, row, totalPages } = await getInventoryPageData(currentPage);

    const response = await interaction.editReply({
      embeds: [embed],
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

          if (btnInteraction.customId === 'bag_prev') {
            currentPage = Math.max(1, currentPage - 1);
          } else if (btnInteraction.customId === 'bag_next') {
            currentPage = Math.min(totalPages, currentPage + 1);
          }

          const pageData = await getInventoryPageData(currentPage);
          await btnInteraction.update({
            embeds: [pageData.embed],
            components: [pageData.row]
          });
        } catch (e) {
          // Timeout, disable buttons
          const prevDisabled = new ButtonBuilder()
            .setCustomId('bag_prev')
            .setLabel('◀️ Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true);

          const nextDisabled = new ButtonBuilder()
            .setCustomId('bag_next')
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

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
