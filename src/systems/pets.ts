import { cacheGet, cacheSet } from '../utils/cache.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Represents a pet definition from the data files.
 */
export interface PetData {
  id: string;
  name: string;
  description: string;
  rarity: string;
  baseStats: {
    attack: number;
    defense: number;
    hpMax: number;
    luck: number;
  };
  ability: {
    name: string;
    description: string;
    effect: string;
    cooldown: number;
  };
  maxLevel: number;
  expPerLevel: number;
}

const PETS_CACHE_KEY = 'pets_data';

/**
 * Loads all pet definitions from pets.json, caching for performance.
 */
export function loadPets(): PetData[] {
  const cached = cacheGet<PetData[]>(PETS_CACHE_KEY);
  if (cached) return cached;

  const filePath = join(process.cwd(), 'data', 'pets.json');
  const raw = readFileSync(filePath, 'utf-8');
  const pets: PetData[] = JSON.parse(raw);

  cacheSet(PETS_CACHE_KEY, pets);
  return pets;
}

/**
 * Retrieves a single pet by its unique ID.
 */
export function getPetById(id: string): PetData | undefined {
  const pets = loadPets();
  return pets.find((p) => p.id === id);
}

/**
 * Calculates a pet's passive stats at a given level.
 *
 * Each stat scales linearly: `base * (1 + (level - 1) * 0.1)`
 * At level 1, stats are equal to base. Each level adds 10% of base.
 */
export function getPetPassiveStats(
  pet: PetData,
  petLevel: number,
): {
  attack: number;
  defense: number;
  hpMax: number;
  luck: number;
} {
  const scale = 1 + (petLevel - 1) * 0.1;
  return {
    attack: Math.round(pet.baseStats.attack * scale),
    defense: Math.round(pet.baseStats.defense * scale),
    hpMax: Math.round(pet.baseStats.hpMax * scale),
    luck: Math.round(pet.baseStats.luck * scale),
  };
}

/**
 * Returns the total cumulative experience needed to reach the specified pet level.
 * Each level requires `pet.expPerLevel * level` XP.
 * Total = sum from 1..level of (expPerLevel * i).
 */
export function getPetExpForLevel(pet: PetData, level: number): number {
  if (level <= 1) return 0;
  // Sum of 1..level = level * (level + 1) / 2
  // Total = expPerLevel * (level * (level + 1) / 2 - 1)
  let total = 0;
  for (let i = 2; i <= level; i++) {
    total += pet.expPerLevel * i;
  }
  return total;
}

/**
 * Checks if a pet has enough experience to level up.
 * Handles multi-level ups if enough exp is accumulated.
 */
export function checkPetLevelUp(
  pet: PetData,
  currentLevel: number,
  currentExp: number,
): {
  leveled: boolean;
  newLevel: number;
  remainingExp: number;
} {
  let level = currentLevel;
  let exp = currentExp;
  let leveled = false;

  while (level < pet.maxLevel) {
    const needed = pet.expPerLevel * (level + 1);
    if (exp >= needed) {
      exp -= needed;
      level++;
      leveled = true;
    } else {
      break;
    }
  }

  return {
    leveled,
    newLevel: level,
    remainingExp: exp,
  };
}
