import { cacheGet, cacheSet } from '../utils/cache.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

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

const ACHIEVEMENTS_CACHE_KEY = 'achievements_data';

/**
 * Loads all achievement definitions from achievements.json, caching for performance.
 */
export function loadAchievements(): AchievementData[] {
  const cached = cacheGet<AchievementData[]>(ACHIEVEMENTS_CACHE_KEY);
  if (cached) return cached;

  const filePath = join(process.cwd(), 'data', 'achievements.json');
  const raw = readFileSync(filePath, 'utf-8');
  const achievements: AchievementData[] = JSON.parse(raw);

  cacheSet(ACHIEVEMENTS_CACHE_KEY, achievements);
  return achievements;
}

/**
 * Retrieves a single achievement by its unique ID.
 */
export function getAchievementById(id: string): AchievementData | undefined {
  const achievements = loadAchievements();
  return achievements.find((a) => a.id === id);
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

    switch (type) {
      case 'kills':
        met = playerData.totalKills >= value;
        break;
      case 'level':
        met = playerData.level >= value;
        break;
      case 'gold':
        met = playerData.gold >= value;
        break;
      case 'quests':
        met = playerData.totalQuestsCompleted >= value;
        break;
      case 'prestige':
        met = playerData.prestige >= value;
        break;
      case 'guild':
        met = playerData.hasGuild === true;
        break;
      default:
        // Unknown condition type — skip
        break;
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

  switch (type) {
    case 'kills':
      current = playerData.totalKills;
      break;
    case 'level':
      current = playerData.level;
      break;
    case 'gold':
      current = playerData.gold;
      break;
    case 'quests':
      current = playerData.totalQuestsCompleted;
      break;
    case 'prestige':
      current = playerData.prestige;
      break;
    case 'guild':
      current = playerData.hasGuild ? 1 : 0;
      break;
    default:
      current = 0;
      break;
  }

  const required = type === 'guild' ? 1 : value;
  const percentage = Math.min(Math.round((current / required) * 100), 100);

  return { current, required, percentage };
}
