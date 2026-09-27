import { questsCatalog } from '../catalog/index.js';
import { getXpForLevel } from './leveling.js';

export const STORY_QUEST_ORDER = [
  'tutorial_01_hearth',
  'tutorial_02_stew',
  'tutorial_03_slimes',
  'tutorial_04_world',
  'story_01_begin',
  'story_02_meadows_clear',
  'story_01_supply',
  'story_03_forest_enter',
  'story_02_river_king',
  'story_04_stalker_slay',
  'story_03_forest_depths',
  'story_05_witch_hex',
  'story_04_watchtower_siege',
  'story_03_goblin_raids',
  'story_06_caverns_enter',
  'story_06_cavern_entry',
  'story_07_golem_slay',
  'story_08_troll_hunt',
  'story_04_underworld',
  'story_09_mine_exploration',
  'story_09_colossus_defeat',
  'story_05_chieftain',
  'story_10_volcanic_entry',
  'story_10_wastes_enter',
  'story_11_hound_slay',
  'story_12_wraith_hunt',
  'story_13_scorpion_slay',
  'story_14_titan_defeat',
  'story_14_keep_siege',
  'story_15_depths_enter',
  'story_15_ocean_descent',
  'story_16_walker_slay',
  'story_17_lurker_hunt',
  'story_18_kraken_defeat',
  'story_19_nameless_defeat'
];

/**
 * Returns the next story quest ID in chronological order, or null if complete.
 */
export function getNextStoryQuestId(currentQuestId: string): string | null {
  const currentIndex = STORY_QUEST_ORDER.indexOf(currentQuestId);
  if (currentIndex === -1 || currentIndex >= STORY_QUEST_ORDER.length - 1) {
    return null;
  }
  return STORY_QUEST_ORDER[currentIndex + 1] || null;
}

/**
 * Checks whether a single quest condition has been satisfied.
 */
export function isQuestConditionMet(
  condition: { type: string; target: string; required: number },
  currentAmount: number
): boolean {
  return currentAmount >= condition.required;
}

/**
 * Pure calculation of rewards earned from completing a quest definition.
 */
export function calculateQuestRewards(
  questDef: any,
  playerLevel: number
): { exp: number; gold: number; gems: number; items: any[] } {
  const rewards = questDef?.rewards || {};
  let exp = rewards.exp || 0;

  if (questDef?.type === 'story' && playerLevel < 20) {
    const nextLevelXp = getXpForLevel(playerLevel + 1);
    exp = Math.max(exp, nextLevelXp);
  }

  return {
    exp,
    gold: rewards.gold || 0,
    gems: rewards.gems || 0,
    items: rewards.itemId ? [{ id: rewards.itemId, quantity: rewards.itemQty || 1 }] : []
  };
}
