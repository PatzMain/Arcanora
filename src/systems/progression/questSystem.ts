import { db } from '../../database/client.js';
import { players, playerQuests } from '../../database/schema.js';
import { eq, and } from 'drizzle-orm';
import { questsCatalog, itemsCatalog } from '../../utils/catalog.js';
import {
  completeQuest,
  getActiveQuests,
  updateQuestProgress,
  startQuest
} from '../../database/queries/quest.js';
import { incrementQuestsCompleted } from '../../database/queries/player.js';
import { awardGold, awardGems } from '../../economy/currency.js';
import { getEquippedItems, addItem } from '../../database/queries/inventory.js';
import { computeStats } from './stats.js';
import { successEmbed } from '../../utils/embeds.js';

export const STORY_QUEST_ORDER = [
  'story_01_begin',
  'story_02_meadows_clear',
  'story_03_forest_enter',
  'story_04_stalker_slay',
  'story_05_witch_hex',
  'story_06_caverns_enter',
  'story_07_golem_slay',
  'story_08_troll_hunt',
  'story_09_colossus_defeat',
  'story_10_wastes_enter',
  'story_11_hound_slay',
  'story_12_wraith_hunt',
  'story_13_scorpion_slay',
  'story_14_titan_defeat',
  'story_15_depths_enter',
  'story_16_walker_slay',
  'story_17_lurker_hunt',
  'story_18_kraken_defeat',
  'story_19_nameless_defeat'
];

/**
 * Advances quest progress for all active matching quests of the player.
 */
export async function advanceQuestProgress(
  playerId: string,
  type: 'kill' | 'explore' | 'gather',
  target: string,
  amount: number,
  interaction: any
) {
  try {
    const activeQuests = await getActiveQuests(playerId);
    if (activeQuests.length === 0) return;

    for (const activeQuest of activeQuests) {
      const questDef = questsCatalog.find((q) => q.id === activeQuest.questId);
      if (!questDef) continue;

      const matchingCond = questDef.conditions?.find(
        (c: { type: string; target: string; required: number }) => c.type === type && c.target === target
      );

      if (!matchingCond) continue;

      // Update progress
      const progress = (activeQuest.progress || {}) as Record<string, number>;
      const current = progress[target] || 0;
      const nextProgressVal = Math.min(matchingCond.required, current + amount);
      
      const newProgress = { ...progress, [target]: nextProgressVal };
      
      // Update in DB
      await updateQuestProgress(activeQuest.id, { [target]: nextProgressVal });

      // Check if all conditions are met
      let allMet = true;
      for (const cond of questDef.conditions) {
        const currentProgress = newProgress[cond.target] || 0;
        if (currentProgress < cond.required) {
          allMet = false;
          break;
        }
      }

      if (allMet) {
        await completeQuestAndCheckNext(playerId, activeQuest.id, questDef, interaction);
      }
    }
  } catch (error) {
    console.error(`Failed to advance quest progress for player ${playerId}:`, error);
  }
}

/**
 * Completes the quest, awards rewards (including level up if story quest),
 * and automatically accepts the next story quest in the chain.
 */
async function completeQuestAndCheckNext(
  playerId: string,
  questEntryId: string,
  questDef: any,
  interaction: any
) {
  // 1. Mark as completed in database
  await completeQuest(questEntryId);
  await incrementQuestsCompleted(playerId);

  // 2. Fetch player details
  const player = await db.query.players.findFirst({
    where: eq(players.id, playerId)
  });

  if (!player) return;

  // 3. Award standard rewards
  const rewards = questDef.rewards || {};
  
  if (rewards.gold && rewards.gold > 0) {
    await awardGold(playerId, rewards.gold, `Quest completed: ${questDef.name}`);
  }
  if (rewards.gems && rewards.gems > 0) {
    await awardGems(playerId, rewards.gems, `Quest completed: ${questDef.name}`);
  }
  if (rewards.itemId && rewards.itemQty > 0) {
    await addItem(playerId, rewards.itemId, rewards.itemQty);
  }

  // 4. Handle Level Up if it is a story quest
  let newLevel = player.level;
  let nextQuestId: string | null = null;

  if (questDef.type === 'story') {
    newLevel = Math.min(20, player.level + 1);
    
    // Update player level
    await db
      .update(players)
      .set({ level: newLevel })
      .where(eq(players.id, playerId));

    // Clamp current HP/Mana to new maximums
    const equippedDbItems = await getEquippedItems(playerId);
    const equippedItemsList = equippedDbItems.map((dbItem) => {
      const def = itemsCatalog.find((i) => i.id === dbItem.itemId);
      return { slot: def?.type || 'accessory', rarity: def?.rarity || 'common', stats: def?.stats || {} };
    });
    
    const newStats = computeStats(newLevel, player.prestige, player.playerClass, equippedItemsList, null, []);
    
    await db
      .update(players)
      .set({
        hpCurrent: Math.min(newStats.hpMax, player.hpCurrent),
        manaCurrent: Math.min(newStats.manaMax, player.manaCurrent)
      })
      .where(eq(players.id, playerId));

    // Determine next story quest to start
    const currentIndex = STORY_QUEST_ORDER.indexOf(questDef.id);
    if (currentIndex !== -1 && currentIndex + 1 < STORY_QUEST_ORDER.length) {
      nextQuestId = STORY_QUEST_ORDER[currentIndex + 1]!;
      await startQuest(playerId, nextQuestId);
    }
  }

  // 5. Send completion announcement to Discord
  if (interaction && interaction.channel) {
    try {
      const rewardLines: string[] = [];
      if (rewards.gold) rewardLines.push(`🪙 +**${rewards.gold.toLocaleString()}** Gold`);
      if (rewards.gems) rewardLines.push(`💎 +**${rewards.gems}** Gems`);
      if (rewards.itemId) {
        const itemDef = itemsCatalog.find((i) => i.id === rewards.itemId);
        rewardLines.push(`🎒 +**${rewards.itemQty}** **${itemDef?.name || rewards.itemId}**`);
      }

      const embed = successEmbed(
        '📜 Quest Completed!',
        `**${questDef.name}**\n*${questDef.description}*\n\n` +
        `**Rewards Awarded:**\n${rewardLines.join('\n') || '*None*'}`
      );

      if (questDef.type === 'story') {
        embed.addFields({
          name: '🎉 LEVEL UP!',
          value: `You reached **Level ${newLevel}**!`,
          inline: false
        });

        if (nextQuestId) {
          const nextDef = questsCatalog.find((q) => q.id === nextQuestId);
          if (nextDef) {
            embed.addFields({
              name: '📜 Next Story Chapter Begun',
              value: `**${nextDef.name}**:\n*${nextDef.description}*`,
              inline: false
            });
          }
        } else {
          embed.addFields({
            name: '🏆 Story Complete!',
            value: `You have completed the main story and reached maximum level!`,
            inline: false
          });
        }
      }

      await interaction.channel.send({
        content: `<@${player.discordId}>`,
        embeds: [embed]
      });
    } catch (err) {
      console.error('Failed to send quest completion announcement:', err);
    }
  }
}
