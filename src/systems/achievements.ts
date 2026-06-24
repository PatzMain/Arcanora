import { achievementsCatalog } from '../utils/catalog.js';
import { Registry } from '../utils/registry.js';

/**
 * Represents an achievement definition.
 */
export interface AchievementData {
  id: string;
  name: string;
  description: string;
  condition: {
    type: string;
    value: number;
  };
  rewards: {
    gold?: number;
    gems?: number;
    itemId?: string;
    title?: string;
  };
  hidden: boolean;
}

/**
 * Player data used for achievement condition evaluation.
 */
export interface AchievementPlayerData {
  totalKills: number;
  level: number;
  gold: number;
  totalQuestsCompleted: number;
  prestige: number;
  hasGuild: boolean;
}

export interface AchievementEvaluator {
  evaluate(playerData: AchievementPlayerData, conditionValue: number): boolean;
  getCurrentValue(playerData: AchievementPlayerData): number;
}

export const achievementEvaluatorRegistry = new Registry<AchievementEvaluator>();

// Register default evaluators
achievementEvaluatorRegistry.register('kills', {
  evaluate: (pd, val) => pd.totalKills >= val,
  getCurrentValue: (pd) => pd.totalKills
});
achievementEvaluatorRegistry.register('level', {
  evaluate: (pd, val) => pd.level >= val,
  getCurrentValue: (pd) => pd.level
});
achievementEvaluatorRegistry.register('gold', {
  evaluate: (pd, val) => pd.gold >= val,
  getCurrentValue: (pd) => pd.gold
});
achievementEvaluatorRegistry.register('quests', {
  evaluate: (pd, val) => pd.totalQuestsCompleted >= val,
  getCurrentValue: (pd) => pd.totalQuestsCompleted
});
achievementEvaluatorRegistry.register('prestige', {
  evaluate: (pd, val) => pd.prestige >= val,
  getCurrentValue: (pd) => pd.prestige
});
achievementEvaluatorRegistry.register('guild', {
  evaluate: (pd) => pd.hasGuild === true,
  getCurrentValue: (pd) => pd.hasGuild ? 1 : 0
});

const ACHIEVEMENTS_CACHE_KEY = 'achievements_data';

/**
 * Loads all achievement definitions from achievements.json, caching for performance.
 */
export function loadAchievements(): AchievementData[] {
  return achievementsCatalog;
}

export function getAchievementById(id: string): AchievementData | undefined {
  return achievementsCatalog.find((a) => a.id === id);
}

/**
 * Checks all achievements against the player's current data and returns
 * any newly unlocked achievements (not already in `unlockedIds`).
 *
 * Supported condition types:
 * - `kills`:           totalKills >= value
 * - `level`:           level >= value
 * - `gold`:            gold >= value
 * - `quests`:          totalQuestsCompleted >= value
 * - `prestige`:        prestige >= value
 * - `guild`:           hasGuild === true (value ignored)
 */
export function checkAchievements(
  playerData: AchievementPlayerData,
  unlockedIds: string[],
): AchievementData[] {
  const allAchievements = loadAchievements();
  const newlyUnlocked: AchievementData[] = [];

  for (const achievement of allAchievements) {
    // Skip already unlocked
    if (unlockedIds.includes(achievement.id)) continue;

    const { type, value } = achievement.condition;
    let met = false;
    const evaluator = achievementEvaluatorRegistry.get(type);
    if (evaluator) {
      met = evaluator.evaluate(playerData, value);
    }

    if (met) {
      newlyUnlocked.push(achievement);
    }
  }

  return newlyUnlocked;
}

/**
 * Returns the progress toward a specific achievement.
 *
 * @returns An object with current value, required value, and completion percentage.
 */
export function getAchievementProgress(
  achievement: AchievementData,
  playerData: AchievementPlayerData,
): {
  current: number;
  required: number;
  percentage: number;
} {
  const { type, value } = achievement.condition;
  let current = 0;

  const evaluator = achievementEvaluatorRegistry.get(type);
  if (evaluator) {
    current = evaluator.getCurrentValue(playerData);
  }

  const required = type === 'guild' ? 1 : value;
  const percentage = Math.min(Math.round((current / required) * 100), 100);

  return { current, required, percentage };
}
