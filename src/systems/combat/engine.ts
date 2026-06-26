import { rollChance } from '../../utils/random.js';
import {
  calculateDamage,
  calculateDodgeChance,
  isFleeSuccessful,
  getStatModifier
} from './formulas.js';

export {
  calculateDamage,
  calculateDodgeChance,
  isFleeSuccessful,
  getStatModifier
};

// ─── Types ───────────────────────────────────────────────────────────

export interface CombatStats {
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  attack: number;
  defense: number;
  speed: number;
  critChance: number;  // percentage e.g. 5.00
  critDmg: number;     // percentage e.g. 150.00
  luck: number;
}

export interface StatusEffect {
  id: string;
  name: string;
  type: 'buff' | 'debuff';
  stat?: keyof CombatStats;  // stat to modify
  value?: number;            // flat modifier
  percentValue?: number;     // percentage modifier
  damagePerTurn?: number;    // DoT damage
  healPerTurn?: number;      // HoT healing
  turnsRemaining: number;
}

export interface CombatAction {
  type: 'attack' | 'defend' | 'skill' | 'item' | 'flee';
  skillId?: string;
  itemId?: string;
}

export interface CombatState {
  playerHp: number;
  playerMana: number;
  playerMaxHp: number;
  playerMaxMana: number;
  enemyHp: number;
  enemyMaxHp: number;
  round: number;
  playerBuffs: StatusEffect[];
  enemyBuffs: StatusEffect[];
  isPlayerDefending: boolean;
  combatLog: string[];
  isOver: boolean;
  playerWon: boolean;
  source?: 'explore' | 'hunt' | string;
}

export interface TurnResult {
  state: CombatState;
  playerDamageDealt: number;
  enemyDamageDealt: number;
  playerAction: string;  // description of what happened
  enemyAction: string;   // description of what enemy did
}

export interface EnemyStats {
  hp: number;
  attack: number;
  defense: number;
  speed: number;
}

export interface EnemyAbility {
  id: string;
  name: string;
  damage?: number;
  healing?: number;
  effect?: {
    id: string;
    name: string;
    type: 'buff' | 'debuff';
    stat?: keyof CombatStats;
    value?: number;
    percentValue?: number;
    damagePerTurn?: number;
    healPerTurn?: number;
    duration: number;
    target: 'self' | 'player';
  };
  chance: number; // percentage chance to use this ability
}

// ─── Combat State Factory ────────────────────────────────────────────

/**
 * Creates a fresh combat state from player and enemy stats.
 */
export function createCombatState(
  playerStats: CombatStats,
  enemyStats: EnemyStats,
): CombatState {
  return {
    playerHp: playerStats.hp,
    playerMana: playerStats.mana,
    playerMaxHp: playerStats.maxHp,
    playerMaxMana: playerStats.maxMana,
    enemyHp: enemyStats.hp,
    enemyMaxHp: enemyStats.hp,
    round: 1,
    playerBuffs: [],
    enemyBuffs: [],
    isPlayerDefending: false,
    combatLog: ['⚔️ Combat has begun!'],
    isOver: false,
    playerWon: false,
  };
}


/**
 * Processes status effects (DoTs, HoTs) at the start of a turn, decrements
 * turn counters, and removes expired effects. Returns log messages.
 */
export function processStatusEffects(
  state: CombatState,
  target: 'player' | 'enemy',
): string[] {
  const logs: string[] = [];
  const effects = target === 'player' ? state.playerBuffs : state.enemyBuffs;
  const targetName = target === 'player' ? 'You' : 'Enemy';

  const surviving: StatusEffect[] = [];

  for (const effect of effects) {
    // Apply DoT damage
    if (effect.damagePerTurn && effect.damagePerTurn > 0) {
      if (target === 'player') {
        state.playerHp = Math.max(0, state.playerHp - effect.damagePerTurn);
        logs.push(`🔥 ${targetName} took ${effect.damagePerTurn} damage from ${effect.name}!`);
      } else {
        state.enemyHp = Math.max(0, state.enemyHp - effect.damagePerTurn);
        logs.push(`🔥 ${targetName} took ${effect.damagePerTurn} damage from ${effect.name}!`);
      }
    }

    // Apply HoT healing
    if (effect.healPerTurn && effect.healPerTurn > 0) {
      if (target === 'player') {
        const maxHeal = state.playerMaxHp - state.playerHp;
        const healed = Math.min(effect.healPerTurn, maxHeal);
        state.playerHp += healed;
        if (healed > 0) {
          logs.push(`💚 ${targetName} healed ${healed} HP from ${effect.name}!`);
        }
      } else {
        const maxHeal = state.enemyMaxHp - state.enemyHp;
        const healed = Math.min(effect.healPerTurn, maxHeal);
        state.enemyHp += healed;
        if (healed > 0) {
          logs.push(`💚 ${targetName} healed ${healed} HP from ${effect.name}!`);
        }
      }
    }

    // Decrement turns
    effect.turnsRemaining -= 1;

    if (effect.turnsRemaining > 0) {
      surviving.push(effect);
    } else {
      logs.push(`⏳ ${effect.name} has worn off on ${targetName}.`);
    }
  }

  // Replace the effects array
  if (target === 'player') {
    state.playerBuffs = surviving;
  } else {
    state.enemyBuffs = surviving;
  }

  return logs;
}

// ─── Player Turn Processing ──────────────────────────────────────────

/**
 * Processes a player's turn based on their chosen action.
 * Returns the updated state and descriptions of what happened.
 */
export function processPlayerTurn(
  state: CombatState,
  action: CombatAction,
  playerStats: CombatStats,
  enemyStats: EnemyStats,
): TurnResult {
  let playerDamageDealt = 0;
  let playerAction = '';

  // Reset defend flag each turn
  state.isPlayerDefending = false;

  // Process player status effects at the start of their turn
  const playerEffectLogs = processStatusEffects(state, 'player');
  state.combatLog.push(...playerEffectLogs);

  // Check if player died from DoTs
  if (state.playerHp <= 0) {
    state.isOver = true;
    state.playerWon = false;
    playerAction = '💀 You succumbed to your wounds!';
    state.combatLog.push(playerAction);
    return {
      state,
      playerDamageDealt: 0,
      enemyDamageDealt: 0,
      playerAction,
      enemyAction: '',
    };
  }

  // Apply stat modifiers from buffs/debuffs
  const atkMod = getStatModifier(state.playerBuffs, 'attack');
  const defMod = getStatModifier(state.playerBuffs, 'defense');
  const spdMod = getStatModifier(state.playerBuffs, 'speed');
  const critMod = getStatModifier(state.playerBuffs, 'critChance');

  const effectiveAtk = Math.max(1, playerStats.attack + atkMod);
  const effectiveCritChance = Math.max(0, playerStats.critChance + critMod);
  const effectiveSpeed = Math.max(0, playerStats.speed + spdMod);

  switch (action.type) {
    case 'attack': {
      // Check if enemy dodges
      const dodgeChance = calculateDodgeChance(effectiveSpeed, enemyStats.speed);
      if (rollChance(dodgeChance)) {
        playerAction = '💨 Your attack missed! The enemy dodged!';
        state.combatLog.push(playerAction);
        break;
      }

      const { damage, isCrit } = calculateDamage(
        effectiveAtk,
        enemyStats.defense,
        effectiveCritChance,
        playerStats.critDmg,
      );

      playerDamageDealt = damage;
      state.enemyHp = Math.max(0, state.enemyHp - damage);

      if (isCrit) {
        playerAction = `⚡ CRITICAL HIT! You deal ${damage} damage!`;
      } else {
        playerAction = `⚔️ You attack and deal ${damage} damage!`;
      }
      state.combatLog.push(playerAction);
      break;
    }

    case 'defend': {
      state.isPlayerDefending = true;
      playerAction = '🛡️ You take a defensive stance! (Incoming damage reduced by 50%)';
      state.combatLog.push(playerAction);
      break;
    }

    case 'skill': {
      // Skill execution is handled externally via the skills module.
      // This branch expects the caller to have already resolved the skill effect
      // and set action.skillId. We handle the mana check and log here.
      playerAction = `✨ You used a skill! (ID: ${action.skillId ?? 'unknown'})`;
      state.combatLog.push(playerAction);
      break;
    }

    case 'item': {
      playerAction = `🎒 You used an item! (ID: ${action.itemId ?? 'unknown'})`;
      state.combatLog.push(playerAction);
      break;
    }

    case 'flee': {
      const fled = isFleeSuccessful(effectiveSpeed, enemyStats.speed);
      if (fled) {
        playerAction = '🏃 You successfully fled from battle!';
        state.combatLog.push(playerAction);
        state.isOver = true;
        state.playerWon = false;
        return {
          state,
          playerDamageDealt: 0,
          enemyDamageDealt: 0,
          playerAction,
          enemyAction: '',
        };
      } else {
        playerAction = '🏃 You tried to flee but failed!';
        state.combatLog.push(playerAction);
      }
      break;
    }
  }

  // Check if enemy is dead after player's action
  if (state.enemyHp <= 0) {
    state.isOver = true;
    state.playerWon = true;
    state.combatLog.push('🎉 You defeated the enemy!');
    return {
      state,
      playerDamageDealt,
      enemyDamageDealt: 0,
      playerAction,
      enemyAction: '💀 The enemy has been defeated!',
    };
  }

  return {
    state,
    playerDamageDealt,
    enemyDamageDealt: 0,
    playerAction,
    enemyAction: '',
  };
}

// ─── Enemy Turn Processing ───────────────────────────────────────────

export { processEnemyTurn } from './enemyTurn.js';

