import { weightedRandom, type WeightedEntry } from '../../utils/random.js';
import { zonesCatalog } from '../../utils/catalog.js';

/**
 * Represents the data structure for a game zone.
 */
export interface ZoneData {
  id: string;
  name: string;
  description: string;
  minLevel: number;
  maxLevel: number;
  encounters: { type: string; weight: number }[];
  enemies: string[];
  explorationCooldown: number;
}

/**
 * Encounter result returned by the encounter generator.
 */
export interface EncounterResult {
  type: 'normal_mob' | 'rare_mob' | 'boss' | 'treasure' | 'empty';
  enemyId?: string;
}

const CACHE_KEY = 'zones_data';

/**
 * Loads zone definitions from zones.json, caching the result for performance.
 */
export function loadZones(): ZoneData[] {
  return zonesCatalog;
}

/**
 * Retrieves a single zone by its unique ID.
 */
export function getZoneById(id: string): ZoneData | undefined {
  const zones = loadZones();
  return zones.find((z) => z.id === id);
}

/**
 * Returns all zones accessible to a player of the given level.
 * A zone is accessible if the player's level meets or exceeds the zone's minLevel.
 */
export function getAccessibleZones(playerLevel: number): ZoneData[] {
  const zones = loadZones();
  return zones.filter((z) => playerLevel >= z.minLevel);
}

/**
 * Generates a random encounter within a zone using weighted probabilities.
 * Combat encounters (normal_mob, rare_mob, boss) also select a random enemy
 * from the zone's enemy pool.
 */
export function generateEncounter(zone: ZoneData): EncounterResult {
  const encounterTable: WeightedEntry<string>[] = zone.encounters.map((e) => ({
    value: e.type,
    weight: e.weight,
  }));

  const encounterType = weightedRandom(encounterTable) as EncounterResult['type'];

  const combatTypes: string[] = ['normal_mob', 'rare_mob', 'boss'];
  if (combatTypes.includes(encounterType) && zone.enemies.length > 0) {
    const randomIndex = Math.floor(Math.random() * zone.enemies.length);
    return {
      type: encounterType,
      enemyId: zone.enemies[randomIndex],
    };
  }

  return { type: encounterType };
}

/**
 * Returns the exploration cooldown for a zone in milliseconds.
 * The zone stores cooldown in seconds; this converts to ms.
 */
export function getZoneCooldownMs(zone: ZoneData): number {
  return zone.explorationCooldown * 1000;
}
