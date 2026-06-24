import { enemiesCatalog } from '../../utils/catalog.js';
import { rollChance, rollBetween } from '../../utils/random.js';
import type { CombatState, EnemyStats, EnemyAbility } from './engine.js';



export interface EnemyData {
  id: string;
  name: string;
  description: string;
  zone: string;
  rarity: 'normal' | 'rare' | 'boss';
  level: number;
  stats: {
    hp: number;
    attack: number;
    defense: number;
    speed: number;
  };
  abilities: {
    id: string;
    name: string;
    damage?: number;
    healing?: number;
    effect?: {
      id: string;
      name: string;
      type: 'buff' | 'debuff';
      stat?: string;
      value?: number;
      percentValue?: number;
      damagePerTurn?: number;
      healPerTurn?: number;
      duration: number;
      target: 'self' | 'player';
    };
    chance: number;
  }[];
  lootTable: {
    itemId: string;
    dropRate: number;
    minQty: number;
    maxQty: number;
  }[];
  expReward: number;
  goldReward: number;
}

const ENEMIES_CACHE_KEY = 'enemies_catalog';

/**
 * Loads all enemy definitions from enemies.json, caching for performance.
 */
export function loadEnemies(): EnemyData[] {
  return enemiesCatalog;
}

export function getEnemyById(id: string): EnemyData | undefined {
  return enemiesCatalog.find((e) => e.id === id);
}

/**
 * Returns all enemies assigned to the specified zone.
 */
export function getEnemiesByZone(zoneId: string): EnemyData[] {
  const enemies = loadEnemies();
  return enemies.filter((e) => e.zone === zoneId);
}

/**
 * Enemy AI logic to select an ability based on current combat situation.
 * - If enemy HP < 30%, prioritize healing abilities.
 * - If player HP < 30%, prioritize damage abilities.
 * - Otherwise, do a random weighted selection based on chance.
 * Returns the selected ability and a description, or null for basic attack.
 */
export function selectEnemyAbility(
  enemy: EnemyData,
  combatState: CombatState,
): { ability: any; description: string } | null {
  const enemyHpPct = combatState.enemyHp / combatState.enemyMaxHp;
  const playerHpPct = combatState.playerHp / combatState.playerMaxHp;

  // 1. HP < 30% - Prioritize Healing
  if (enemyHpPct < 0.3) {
    const healAbilities = enemy.abilities.filter(
      (a) => (a.healing && a.healing > 0) || (a.effect?.healPerTurn && a.effect.healPerTurn > 0)
    );
    if (healAbilities.length > 0) {
      // Find the one with highest chance or highest healing
      const chosen = healAbilities[Math.floor(Math.random() * healAbilities.length)]!;
      if (rollChance(chosen.chance * 1.5)) { // Boosted chance under emergency
        return { ability: chosen, description: `emergency heal` };
      }
    }
  }

  // 2. Player HP < 30% - Prioritize Damage
  if (playerHpPct < 0.3) {
    const dmgAbilities = enemy.abilities.filter(
      (a) => (a.damage && a.damage > 0) || (a.effect?.damagePerTurn && a.effect.damagePerTurn > 0)
    );
    if (dmgAbilities.length > 0) {
      const chosen = dmgAbilities[Math.floor(Math.random() * dmgAbilities.length)]!;
      if (rollChance(chosen.chance * 1.5)) {
        return { ability: chosen, description: `finishing move` };
      }
    }
  }

  // 3. Regular Weighted Selection
  // Shuffle to avoid evaluation order bias
  const shuffledAbilities = [...enemy.abilities].sort(() => Math.random() - 0.5);
  for (const ability of shuffledAbilities) {
    if (rollChance(ability.chance)) {
      return { ability, description: `used ability` };
    }
  }

  return null; // Basic attack
}

/**
 * Scale enemy stats based on the difference between player level and enemy base level.
 * Scaling: Each level difference above the enemy level adds 5% to HP/Attack/Defense.
 */
export function scaleEnemyStats(
  enemy: EnemyData,
  playerLevel: number,
): { hp: number; attack: number; defense: number; speed: number } {
  const levelDiff = Math.max(0, playerLevel - enemy.level);
  const scalingFactor = 1 + levelDiff * 0.05;

  return {
    hp: Math.round(enemy.stats.hp * scalingFactor),
    attack: Math.round(enemy.stats.attack * scalingFactor),
    defense: Math.round(enemy.stats.defense * scalingFactor),
    speed: enemy.stats.speed, // Keep speed constant
  };
}
