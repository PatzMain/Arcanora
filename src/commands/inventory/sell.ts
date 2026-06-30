import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  type StringSelectMenuInteraction
} from 'discord.js';
import { findOrCreatePlayer } from '../../database/queries/player.js';
import { sellItem } from '../../economy/shop.js';
import { db } from '../../database/client.js';
import { inventory } from '../../database/schema.js';
import { eq, and } from 'drizzle-orm';
import { getNavButtons } from '../../utils/navigation.js';
import { successEmbed, errorEmbed, buildCompactItemCard, COLORS, DIVIDER, capitalize } from '../../utils/embeds.js';
import { itemsCatalog } from '../../utils/catalog.js';

export async function runSell(
  interaction: ChatInputCommandInteraction | ButtonInteraction | StringSelectMenuInteraction,
  itemInput?: string,
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

    const performSell = async (targetInventoryId: string, sellQty: number) => {
      const result = await sellItem(player.id, targetInventoryId, sellQty);
      if (!result.success) {
        return { embeds: [errorEmbed('Sell Failed', result.message)], components: [] };
      }

      const dbItem = await db.query.inventory.findFirst({ where: eq(inventory.id, targetInventoryId) });
      const itemDef = catalog.find((i) => i.id === dbItem?.itemId);

      const embed = successEmbed(
        'Item Sold',
        `You successfully sold **x${sellQty}** **${itemDef?.name || 'Item'}** for 🪙 **${result.earned?.toLocaleString()}** Gold.\n\n` +
        `*NPC purchase rate is standard. Value was added directly to your pouch.*`
      );
      const navButtons = getNavButtons('economy_buy_result', player.discordId);
      return { embeds: [embed], components: navButtons ? [navButtons] : [] };
    };

    if (itemInput) {
      const dbInventory = await db
        .select()
        .from(inventory)
        .where(eq(inventory.playerId, player.id));

      const targetItem = dbInventory.find((dbItem) => {
        if (dbItem.equipped) return false;
        if (dbItem.id === itemInput) return true;
        const def = catalog.find((i) => i.id === dbItem.itemId);
        if (!def) return false;
        return (
          def.id.toLowerCase() === itemInput.toLowerCase() ||
          def.name.toLowerCase().includes(itemInput.toLowerCase())
        );
      });

      if (!targetItem) {
        const embed = errorEmbed('Item Not Found', `No sellable item matching **"${itemInput}"** was found in your bag.`);
        await interaction.editReply({ embeds: [embed], components: [] });
        return;
      }

      const itemDef = catalog.find((i) => i.id === targetItem.itemId);
      if (itemDef && itemDef.sellPrice <= 0) {
        const embed = errorEmbed('Not Sellable', `**${itemDef.name}** cannot be sold back to the shop.`);
        await interaction.editReply({ embeds: [embed], components: [] });
        return;
      }

      const payload = await performSell(targetItem.id, quantity);
      await interaction.editReply(payload);
      return;
    }

    // No input: show select menu of sellable items
    const dbInventory = await db
      .select()
      .from(inventory)
      .where(and(eq(inventory.playerId, player.id), eq(inventory.equipped, false)));

    const sellables = dbInventory.map((dbItem) => {
      const def = catalog.find((i) => i.id === dbItem.itemId);
      if (def && def.sellPrice > 0) {
        return { dbItem, def };
      }
      return null;
    }).filter(Boolean) as { dbItem: any; def: any }[];

    if (sellables.length === 0) {
      const embed = errorEmbed('No Sellables', 'You do not have any sellable items in your bag.');
      const navButtons = getNavButtons('economy_shop', player.discordId);
      await interaction.editReply({ embeds: [embed], components: navButtons ? [navButtons] : [] });
      return;
    }

    const itemLines = sellables.map((s) => {
      return buildCompactItemCard(s.def, { quantity: s.dbItem.quantity, sellMode: true });
    }).join('\n');

    const embed = successEmbed('Sell Gear', 'Select an item from the dropdown below to sell it (1x).');
    embed.setColor(COLORS.SHOP);
    embed.setDescription(
      `Select an item from the dropdown below to sell it (1x).\n\n` +
      `${DIVIDER}\n` +
      itemLines
    );

    const selectMenuOptions = sellables.slice(0, 25).map((s) => {
      let label = `${s.def.name} (x${s.dbItem.quantity})`;
      if (s.dbItem.enhancement > 0) {
        label += ` +${s.dbItem.enhancement}`;
      }
      return {
        label,
        description: `Sell price: ${s.def.sellPrice}g each | [${capitalize(s.def.rarity)} ${capitalize(s.def.type)}]`,
        value: s.dbItem.id
      };
    });

    const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`sell_select_${player.discordId}`)
        .setPlaceholder('💰 Choose an item to sell')
        .addOptions(selectMenuOptions)
    );

    await interaction.editReply({
      embeds: [embed],
      components: [selectRow]
    });
  } catch (error) {
    console.error('Error running sell:', error);
    const embed = errorEmbed('Sell Error', 'Failed to sell the item.');
    await interaction.editReply({ embeds: [embed], components: [] });
  }
}

export async function handleSellInteraction(interaction: StringSelectMenuInteraction) {
  const parts = interaction.customId.split('_');
  const userId = parts[2];

  if (interaction.user.id !== userId) return;

  const targetInventoryId = interaction.values[0]!;
  await runSell(interaction, targetInventoryId, 1);
}
