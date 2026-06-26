import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { db } from '../../../database/client.js';
import { players } from '../../../database/schema.js';
import { eq } from 'drizzle-orm';
import { getPlayerWithClampedStats } from '../../../database/queries/player.js';
import { getEquippedItems, addItem } from '../../../database/queries/inventory.js';
import { computeStats } from '../../progression/stats.js';
import { itemsCatalog } from '../../../utils/catalog.js';
import { type NodeInteractionHandler } from '../dungeonInteractions.js';

export const eventHandler: NodeInteractionHandler = {
  async onEnter(context) {
    const event = context.node.encounterData?.event;
    const embed = new EmbedBuilder()
      .setColor(0xF59E0B) // Amber
      .setTitle(event?.title || '✨ Strange Discovery')
      .setDescription(event?.description || 'You encounter a mysterious phenomenon.');

    const examineBtn = new ButtonBuilder()
      .setCustomId(`dungeon_action_event_${context.playerId}`)
      .setLabel('Examine')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('✨');

    if (context.node.status === 'cleared') {
      examineBtn.setDisabled(true).setLabel('Already Examined');
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(examineBtn);

    return {
      embeds: [embed],
      components: [row]
    };
  },

  async onAction(action, context, extraData) {
    const player = await getPlayerWithClampedStats(context.discordId);
    if (!player) {
      return { success: false, embeds: [], components: [], log: 'Player not found.' };
    }

    if (action === 'choose') {
      const event = context.node.encounterData?.event;
      const outcomeId = extraData?.outcomeId;
      const choice = event?.choices.find((c: any) => c.outcomeId === outcomeId);

      if (!event || !choice) {
        return { success: false, embeds: [], components: [], log: 'Event outcome choice missing.' };
      }

      // Mark node as cleared
      context.dbSession.mapState.nodes[context.node.id].status = 'cleared';

      let resultText = choice.text;
      let updatedPlayer = player;

      // Apply choices outcomes
      if (outcomeId === 'shrine_touch') {
        if (Math.random() < 0.5) {
          const newHp = Math.max(1, player.hpCurrent - 20);
          await db.update(players).set({ hpCurrent: newHp }).where(eq(players.id, player.id));
          resultText += `\n\n💥 You take **20 shadow damage** from the backlash!`;
        } else {
          const newGold = player.gold + 250;
          await db.update(players).set({ gold: newGold }).where(eq(players.id, player.id));
          resultText += `\n\n🪙 You find **250 gold** hidden inside the altar!`;
        }
      } else if (outcomeId === 'shrine_pray') {
        const equippedDbItems = await getEquippedItems(player.id);
        const equippedItemsList = equippedDbItems.map((dbItem) => {
          const def = itemsCatalog.find((i) => i.id === dbItem.itemId);
          return { slot: def?.type || 'accessory', rarity: def?.rarity || 'common', stats: def?.stats || {} };
        });
        const stats = computeStats(player.level, player.prestige, player.playerClass, equippedItemsList, null, []);
        const restoredMana = Math.min(stats.manaMax, player.manaCurrent + Math.round(stats.manaMax * 0.3));
        await db.update(players).set({ manaCurrent: restoredMana }).where(eq(players.id, player.id));
        resultText += `\n\n💙 Restored **30% Mana**!`;
      } else if (outcomeId === 'fountain_drink') {
        const equippedDbItems = await getEquippedItems(player.id);
        const equippedItemsList = equippedDbItems.map((dbItem) => {
          const def = itemsCatalog.find((i) => i.id === dbItem.itemId);
          return { slot: def?.type || 'accessory', rarity: def?.rarity || 'common', stats: def?.stats || {} };
        });
        const stats = computeStats(player.level, player.prestige, player.playerClass, equippedItemsList, null, []);
        const restoredHp = Math.min(stats.hpMax, player.hpCurrent + Math.round(stats.hpMax * 0.4));
        const restoredMana = Math.min(stats.manaMax, player.manaCurrent + Math.round(stats.manaMax * 0.4));
        await db.update(players).set({ hpCurrent: restoredHp, manaCurrent: restoredMana }).where(eq(players.id, player.id));
        resultText += `\n\n💚 Restored **40% HP & Mana**!`;
      } else if (outcomeId === 'fountain_coin') {
        if (player.gold >= 50) {
          const newGold = player.gold - 50;
          await db.update(players).set({ gold: newGold }).where(eq(players.id, player.id));
          resultText += `\n\n✨ You feel a warm blessing! (Deducted 50 Gold).`;
        } else {
          resultText = `You don't have enough gold to toss! Nothing happens.`;
        }
      } else if (outcomeId === 'bones_search') {
        if (Math.random() < 0.3) {
          const newHp = Math.max(1, player.hpCurrent - 10);
          await db.update(players).set({ hpCurrent: newHp }).where(eq(players.id, player.id));
          resultText += `\n\n🕷️ A toxic spider bites you! You lose **10 HP**.`;
        } else {
          await addItem(player.id, 'potion_stamina_small', 1);
          resultText += `\n\n🎒 You found a **Small Stamina Potion**!`;
        }
      }

      // Reload player to fetch computed stats cleanly
      const refreshed = await getPlayerWithClampedStats(player.discordId);
      if (refreshed) {
        updatedPlayer = refreshed;
      }

      const embed = new EmbedBuilder()
        .setColor(0x10B981)
        .setTitle(event?.title || '✨ Strange Discovery')
        .setDescription(resultText);

      return {
        success: true,
        embeds: [embed],
        components: [],
        log: 'Completed event choice.',
        updatedPlayer
      };
    }

    return { success: false, embeds: [], components: [], log: 'Invalid action.' };
  }
};
