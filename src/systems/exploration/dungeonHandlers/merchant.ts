import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { db } from '../../../database/client.js';
import { players } from '../../../database/schema.js';
import { eq } from 'drizzle-orm';
import { getPlayerWithClampedStats } from '../../../database/queries/player.js';
import { addItem } from '../../../database/queries/inventory.js';
import { itemsCatalog } from '../../../utils/catalog.js';
import { type NodeInteractionHandler } from '../dungeonInteractions.js';

export const merchantHandler: NodeInteractionHandler = {
  async onEnter(context) {
    const embed = new EmbedBuilder()
      .setColor(0x3B82F6) // Blue
      .setTitle('🏪 Traveling Merchant')
      .setDescription('A hooded merchant bows politely. "Greetings, traveler! Need any potions for your journey? My prices are fair."');

    // Create a button to shop
    const shopBtn = new ButtonBuilder()
      .setCustomId(`dungeon_action_merchant_${context.playerId}`)
      .setLabel('Browse Wares')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🏪');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(shopBtn);

    return {
      embeds: [embed],
      components: [row]
    };
  },

  async onAction(action, context, extraData) {
    // This is resolved when buying an item. ExtraData should contain itemId.
    if (action !== 'buy') {
      return { success: false, embeds: [], components: [], log: 'Invalid action.' };
    }

    const player = await getPlayerWithClampedStats(context.discordId);
    if (!player) {
      return { success: false, embeds: [], components: [], log: 'Player not found.' };
    }

    const itemId = extraData?.itemId;
    const itemStock = context.node.encounterData?.shopItems || [];
    const itemSpec = itemStock.find((i: any) => i.id === itemId);

    if (!itemSpec) {
      return { success: false, embeds: [], components: [], log: 'Item not in merchant stock.' };
    }

    const itemDef = itemsCatalog.find(i => i.id === itemId);
    if (!itemDef) {
      return { success: false, embeds: [], components: [], log: 'Item definition missing.' };
    }

    if (player.gold < itemSpec.price) {
      return { success: false, embeds: [], components: [], log: `Insufficient gold. Costs ${itemSpec.price} gold.` };
    }

    // Deduct gold
    const updatedGold = player.gold - itemSpec.price;
    const [updatedPlayer] = await db
      .update(players)
      .set({ gold: updatedGold })
      .where(eq(players.id, player.id))
      .returning();

    // Add item
    await addItem(player.id, itemId, 1);

    const embed = new EmbedBuilder()
      .setColor(0x10B981)
      .setTitle('🏪 Purchase Complete')
      .setDescription(`You successfully purchased 1x **${itemDef.name}** for **${itemSpec.price} gold**!`);

    return {
      success: true,
      embeds: [embed],
      components: [],
      log: `Purchased ${itemDef.name}.`,
      updatedPlayer
    };
  }
};
