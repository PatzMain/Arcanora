import { readFileSync } from 'fs';
import { join } from 'path';

// Helper to load and parse JSON from the data directory
function loadJsonFile<T>(filename: string): T {
  const filePath = join(process.cwd(), 'data', filename);
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

// Loaded once when the module is imported
export const itemsCatalog = loadJsonFile<any[]>('items.json');
export const enemiesCatalog = loadJsonFile<any[]>('enemies.json');
export const recipesCatalog = loadJsonFile<any[]>('recipes.json');
export const questsCatalog = loadJsonFile<any[]>('quests.json');
export const petsCatalog = loadJsonFile<any[]>('pets.json');
export const zonesCatalog = loadJsonFile<any[]>('zones.json');
export const achievementsCatalog = loadJsonFile<any[]>('achievements.json');

// Convenience helper functions
export function getItemById(id: string): any | undefined {
  return itemsCatalog.find((i) => i.id === id);
}

export function getEnemyById(id: string): any | undefined {
  return enemiesCatalog.find((e) => e.id === id);
}

export function getRecipeById(id: string): any | undefined {
  return recipesCatalog.find((r) => r.id === id);
}

export function getQuestById(id: string): any | undefined {
  return questsCatalog.find((q) => q.id === id);
}

export function getPetById(id: string): any | undefined {
  return petsCatalog.find((p) => p.id === id);
}

export function getZoneById(id: string): any | undefined {
  return zonesCatalog.find((z) => z.id === id);
}

export function getAchievementById(id: string): any | undefined {
  return achievementsCatalog.find((a) => a.id === id);
}
