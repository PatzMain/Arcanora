import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getPlayerWithClampedStats } from '../../../database/queries/player.js';
import { getEquippedItems, addItem } from '../../../database/queries/inventory.js';
import { computeStats } from '../../progression/stats.js';
import { generateTreasureLoot, getItemData } from '../loot.js';
import { awardGold } from '../../../economy/currency.js';
import { itemsCatalog } from '../../../utils/catalog.js';
import { type NodeInteractionHandler } from '../dungeonInteractions.js';
import { buildCompactItemCard } from '../../../utils/embeds/itemCard.js';

export const treasureHandler: NodeInteractionHandler = {
  async onEnter(context) {
    const embed = new EmbedBuilder()
      .setColor(0xFBBF24) // Gold
      .setTitle('🪙 Treasure Chamber')
      .setDescription('An ornate, iron-bound chest sits on a stone pedestal in the center of the room. It hums with faint magic.');

    const openBtn = new ButtonBuilder()
      .setCustomId(`dungeon_action_loot_${context.playerId}`)
      .setLabel('Open Chest')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🪙');

    if (context.node.status === 'cleared') {
      openBtn.setDisabled(true).setLabel('Chest Already Opened');
      embed.setDescription('🔓 **The ornate chest lies wide open and empty.** All of its treasures have already been looted.');
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(openBtn);

    return {
      embeds: [embed],
      components: [row]
    };
  },

  async onAction(action, context) {
    if (action !== 'loot') {
      return { success: false, embeds: [], components: [], log: 'Invalid action.' };
    }

    const player = await getPlayerWithClampedStats(context.discordId);
    if (!player) {
      return { success: false, embeds: [], components: [], log: 'Player not found.' };
    }

    const equippedDbItems = await getEquippedItems(player.id);
    const equippedItemsList = equippedDbItems.map((dbItem) => {
      const def = itemsCatalog.find((i) => i.id === dbItem.itemId);
      return { slot: def?.type || 'accessory', rarity: def?.rarity || 'common', stats: def?.stats || {} };
    });
    const stats = computeStats(player.level, player.prestige, player.playerClass, equippedItemsList, null, []);

    // Generate treasure loot
    const lootDrops = generateTreasureLoot(player.level, stats.luck);

    let goldGained = 0;
    const acquiredCompactCards: string[] = [];

    for (const drop of lootDrops) {
      if (drop.itemId === 'gold') {
        goldGained = drop.quantity;
        await awardGold(player.id, goldGained, 'Dungeon Exploration Chest');
      } else {
        const itemDef = getItemData(drop.itemId);
        if (itemDef) {
          await addItem(player.id, drop.itemId, drop.quantity);
          acquiredCompactCards.push(buildCompactItemCard(itemDef, { quantity: drop.quantity }));
        }
      }
    }

    // Mark node as cleared
    context.dbSession.mapState.nodes[context.node.id].status = 'cleared';

    const embed = new EmbedBuilder()
      .setColor(0xFBBF24)
      .setTitle('🎁 Chest Opened!')
      .setDescription(
        `🎁 ── ── ── ── ── ── ── 🎁\n` +
        `*You pop open the heavy iron-bound lid, revealing the treasures inside:*`
      );

    if (goldGained > 0) {
      embed.addFields({ name: '🪙 Gold Received', value: `\`+${goldGained} Gold\``, inline: true });
    }

    if (acquiredCompactCards.length > 0) {
      const list = acquiredCompactCards.map(card => `▸ ${card}`).join('\n');
      embed.addFields({ name: '🎒 Items Found', value: list, inline: false });
    } else if (goldGained === 0) {
      embed.setDescription('The chest was empty! What bad luck.');
    }

    return {
      success: true,
      embeds: [embed],
      components: [],
      log: 'Opened chest.'
    };
  }
};
