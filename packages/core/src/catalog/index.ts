import { STATIC_CATALOG } from './catalogBundle.js';

export class Registry<T = any> {
  private items = new Map<string, T>();

  constructor(initialItems: readonly T[] = []) {
    for (const item of initialItems) {
      if (item && (item as any).id) {
        this.items.set((item as any).id, item);
      }
    }
  }

  get(id: string): T | undefined {
    return this.items.get(id);
  }

  getAll(): T[] {
    return Array.from(this.items.values());
  }

  has(id: string): boolean {
    return this.items.has(id);
  }

  register(id: string, item: T): void {
    this.items.set(id, item);
  }
}

export const itemsRegistry = new Registry<any>(STATIC_CATALOG.items);
export const enemiesRegistry = new Registry<any>(STATIC_CATALOG.enemies);
export const zonesRegistry = new Registry<any>(STATIC_CATALOG.locations);
export const recipesRegistry = new Registry<any>(STATIC_CATALOG.recipes);
export const questsRegistry = new Registry<any>(STATIC_CATALOG.quests);
export const petsRegistry = new Registry<any>(STATIC_CATALOG.pets);
export const achievementsRegistry = new Registry<any>(STATIC_CATALOG.achievements);
export const classesRegistry = new Registry<any>(STATIC_CATALOG.classes);

export const itemsCatalog: any[] = STATIC_CATALOG.items as any;
export const enemiesCatalog: any[] = STATIC_CATALOG.enemies as any;
export const zonesCatalog: any[] = STATIC_CATALOG.locations as any;
export const recipesCatalog: any[] = STATIC_CATALOG.recipes as any;
export const questsCatalog: any[] = STATIC_CATALOG.quests as any;
export const petsCatalog: any[] = STATIC_CATALOG.pets as any;
export const achievementsCatalog: any[] = STATIC_CATALOG.achievements as any;
export const classesCatalog: any[] = STATIC_CATALOG.classes as any;
export const mapConfig = STATIC_CATALOG.mapConfig;

export function getItemById(id: string) {
  return itemsRegistry.get(id);
}

export function getEnemyById(id: string) {
  return enemiesRegistry.get(id);
}

export function getZoneById(id: string) {
  return zonesRegistry.get(id);
}
