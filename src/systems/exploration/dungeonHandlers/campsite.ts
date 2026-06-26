import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { eq } from 'drizzle-orm';
import { db } from '../../../database/client.js';
import { players } from '../../../database/schema.js';
import { getPlayerWithClampedStats } from '../../../database/queries/player.js';
import { getEquippedItems } from '../../../database/queries/inventory.js';
import { computeStats } from '../../progression/stats.js';
import { itemsCatalog } from '../../../utils/catalog.js';
import { type NodeInteractionHandler } from '../dungeonInteractions.js';

export const campsiteHandler: NodeInteractionHandler = {
  async onEnter(context) {
    const embed = new EmbedBuilder()
      .setColor(0x10B981) // Emerald green
      .setTitle('🏕️ Campsite — Safe Haven')
      .setDescription(
        'A crackling campfire provides warmth and light in this quiet chamber. ' +
        'It seems safe enough to rest here for a moment and recover your strength.'
      );

    const restBtn = new ButtonBuilder()
      .setCustomId(`dungeon_action_rest_${context.playerId}`)
      .setLabel('Rest & Recover (50% HP/Mana)')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🏕️');

    if (context.node.status === 'cleared' || context.node.status === 'visited') {
      restBtn.setDisabled(true).setLabel('Already Rested Here');
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(restBtn);

    return {
      embeds: [embed],
      components: [row]
    };
  },

  async onAction(action, context) {
    if (action !== 'rest') {
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

    const hpRestore = Math.round(stats.hpMax * 0.5);
    const manaRestore = Math.round(stats.manaMax * 0.5);

    const newHp = Math.min(stats.hpMax, player.hpCurrent + hpRestore);
    const newMana = Math.min(stats.manaMax, player.manaCurrent + manaRestore);

    const [updatedPlayer] = await db
      .update(players)
      .set({
        hpCurrent: newHp,
        manaCurrent: newMana
      })
      .where(eq(players.id, player.id))
      .returning();

    // Mark node as cleared
    context.dbSession.mapState.nodes[context.node.id].status = 'cleared';
    const { explorationSessions } = await import('../../../database/schema.js');
    await db
      .update(explorationSessions)
      .set({ mapState: context.dbSession.mapState })
      .where(eq(explorationSessions.id, context.dbSession.id));

    const embed = new EmbedBuilder()
      .setColor(0x10B981)
      .setTitle('🏕️ Campsite — Rest Complete')
      .setDescription(
        `🔥 You sat by the campfire and rested.\n\n` +
        `💚 **HP Restored**: \`+${hpRestore}\` (${newHp}/${stats.hpMax})\n` +
        `💙 **Mana Restored**: \`+${manaRestore}\` (${newMana}/${stats.manaMax})`
      );

    return {
      success: true,
      embeds: [embed],
      components: [],
      log: 'Rest complete.',
      updatedPlayer
    };
  }
};
