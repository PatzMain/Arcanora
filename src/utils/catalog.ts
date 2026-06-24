import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { Registry } from './registry.js';

// Generic Registry instantiation
export const itemsRegistry = new Registry<any>();
export const enemiesRegistry = new Registry<any>();
export const recipesRegistry = new Registry<any>();
export const questsRegistry = new Registry<any>();
export const petsRegistry = new Registry<any>();
export const zonesRegistry = new Registry<any>();
export const achievementsRegistry = new Registry<any>();

// Helper to load and parse all JSON files in a subdirectory
function loadJsonDirectory<T>(dirName: string): T[] {
  const dirPath = join(process.cwd(), 'data', dirName);
  try {
    const files = readdirSync(dirPath);
    const data: T[] = [];
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = join(dirPath, file);
        data.push(JSON.parse(readFileSync(filePath, 'utf-8')));
      }
    }
    return data;
  } catch (error) {
    console.error(`Failed to load directory ${dirName}:`, error);
    return [];
  }
}

// Populate registries from subdirectory JSON files
function populateRegistryFromDir<T>(registry: Registry<T>, dirName: string): void {
  const data = loadJsonDirectory<any>(dirName);
  for (const entry of data) {
    if (entry && typeof entry.id === 'string') {
      registry.register(entry.id, entry);
    }
  }
}

// Perform initial loading from subdirectories
populateRegistryFromDir(itemsRegistry, 'items');
populateRegistryFromDir(enemiesRegistry, 'enemies');
populateRegistryFromDir(zonesRegistry, 'zones');
populateRegistryFromDir(recipesRegistry, 'recipes');
populateRegistryFromDir(questsRegistry, 'quests');
populateRegistryFromDir(petsRegistry, 'pets');
populateRegistryFromDir(achievementsRegistry, 'achievements');

// Helper to create a backward-compatible Array Proxy for the registries
function createRegistryProxy<T>(registry: Registry<T>): T[] {
  return new Proxy([] as T[], {
    get(target, prop, receiver) {
      const all = registry.getAll();
      const value = Reflect.get(all, prop);
      if (typeof value === 'function') {
        return value.bind(all);
      }
      return value;
    },
    getOwnPropertyDescriptor(target, prop) {
      const all = registry.getAll();
      return Reflect.getOwnPropertyDescriptor(all, prop);
    },
    ownKeys(target) {
      const all = registry.getAll();
      return Reflect.ownKeys(all);
    },
    has(target, prop) {
      const all = registry.getAll();
      return Reflect.has(all, prop);
    }
  });
}

// Proxies to maintain 100% backward compatibility with static array imports
export const itemsCatalog = createRegistryProxy(itemsRegistry);
export const enemiesCatalog = createRegistryProxy(enemiesRegistry);
export const recipesCatalog = createRegistryProxy(recipesRegistry);
export const questsCatalog = createRegistryProxy(questsRegistry);
export const petsCatalog = createRegistryProxy(petsRegistry);
export const zonesCatalog = createRegistryProxy(zonesRegistry);
export const achievementsCatalog = createRegistryProxy(achievementsRegistry);

// Registry-backed helper functions
export function getItemById(id: string): any | undefined {
  return itemsRegistry.get(id);
}

export function getEnemyById(id: string): any | undefined {
  return enemiesRegistry.get(id);
}

export function getRecipeById(id: string): any | undefined {
  return recipesRegistry.get(id);
}

export function getQuestById(id: string): any | undefined {
  return questsRegistry.get(id);
}

export function getPetById(id: string): any | undefined {
  return petsRegistry.get(id);
}

export function getZoneById(id: string): any | undefined {
  return zonesRegistry.get(id);
}

export function getAchievementById(id: string): any | undefined {
  return achievementsRegistry.get(id);
}
