import { rollChance } from '../utils/random.js';
import {
  calculateDamage,
  calculateDodgeChance,
  isFleeSuccessful,
  getStatModifier
} from './formulas.js';
import {
  type ElementalAffinity,
  type CombatStatusEffect,
  type SynergyReactionResult,
  evaluateElementalSynergy
} from './elements.js';
import {
  type EnemyIntent,
  type PlayerDefensiveStance,
  generateEnemyIntent,
  resolveDefensiveStance
} from './tactics.js';

export {
  calculateDamage,
  calculateDodgeChance,
  isFleeSuccessful,
  getStatModifier
};

export interface CombatStats {
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  attack: number;
  defense: number;
  speed: number;
  critChance: number;
  critDmg: number;
  luck: number;
  element?: ElementalAffinity;
}

export type StatusEffect = CombatStatusEffect;

export interface CombatAction {
  type: 'attack' | 'defend' | 'parry' | 'skill' | 'item' | 'flee';
  skillId?: string;
  itemId?: string;
  element?: ElementalAffinity;
}

export interface FloatingDamageNumber {
  id: string;
  text: string;
  type: 'damage' | 'crit' | 'heal' | 'synergy' | 'parry';
  target: 'player' | 'enemy';
}

export interface CombatState {
  playerHp: number;
  playerMana: number;
  playerMaxHp: number;
  playerMaxMana: number;
  enemyHp: number;
  enemyMaxHp: number;
  round: number;
  playerBuffs: CombatStatusEffect[];
  enemyBuffs: CombatStatusEffect[];
  isPlayerDefending: boolean;
  playerStance: PlayerDefensiveStance;
  combatLog: string[];
  isOver: boolean;
  playerWon: boolean;
  enemyIntent: EnemyIntent;
  lastSynergy: SynergyReactionResult | null;
  floatingNumbers: FloatingDamageNumber[];
}

export interface EnemyStats {
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  element?: ElementalAffinity;
}

export interface EnemyAbility {
  id: string;
  name: string;
  damage?: number;
  element?: ElementalAffinity;
  chance: number;
}

export function createCombatState(
  playerStats: CombatStats,
  enemyStats: EnemyStats,
  enemyAbilities: EnemyAbility[] = []
): CombatState {
  const initialIntent = generateEnemyIntent(1, 100, enemyAbilities);
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
    playerStance: 'none',
    combatLog: ['⚔️ Tactical Combat initialized!'],
    isOver: false,
    playerWon: false,
    enemyIntent: initialIntent,
    lastSynergy: null,
    floatingNumbers: []
  };
}

/**
 * Executes a full tactical combat turn including elemental synergies and telegraphed actions.
 */
export function executeCombatTurn(
  state: CombatState,
  action: CombatAction,
  playerStats: CombatStats,
  enemyStats: EnemyStats,
  enemyAbilities: EnemyAbility[] = []
): { state: CombatState; playerDmg: number; enemyDmg: number; synergy: SynergyReactionResult | null } {
  if (state.isOver) {
    return { state, playerDmg: 0, enemyDmg: 0, synergy: null };
  }

  const floatingNumbers: FloatingDamageNumber[] = [];
  let playerDamageDealt = 0;
  let enemyDamageDealt = 0;
  let synergyResult: SynergyReactionResult | null = null;

  // 1. Process player action
  if (action.type === 'flee') {
    const fled = isFleeSuccessful(playerStats.speed, enemyStats.speed);
    if (fled) {
      state.isOver = true;
      state.playerWon = false;
      state.combatLog.push('💨 You successfully fled from battle!');
      return { state, playerDmg: 0, enemyDmg: 0, synergy: null };
    } else {
      state.combatLog.push('❌ Escape failed! The enemy blocks your retreat.');
    }
  } else if (action.type === 'defend') {
    state.playerStance = 'guard';
    state.isPlayerDefending = true;
    state.combatLog.push('🛡️ You brace into a sturdy Guard stance, preparing to mitigate incoming strikes.');
  } else if (action.type === 'parry') {
    state.playerStance = 'parry';
    state.isPlayerDefending = true;
    state.combatLog.push('⚡ You focus your blade into a Counter-Parry posture, waiting for the enemy swing.');
  } else {
    // Attack or Skill
    state.playerStance = 'none';
    state.isPlayerDefending = false;

    const attackElement: ElementalAffinity = action.element || playerStats.element || 'Physical';
    const dmgCalc = calculateDamage(playerStats.attack, enemyStats.defense, playerStats.critChance, playerStats.critDmg);
    let baseDamage = dmgCalc.damage;
    const isCrit = dmgCalc.isCrit;

    // Evaluate elemental synergy against active enemy debuffs
    synergyResult = evaluateElementalSynergy(attackElement, state.enemyBuffs, baseDamage);
    if (synergyResult.reaction) {
      baseDamage += synergyResult.bonusDamage;
      state.enemyBuffs = [...synergyResult.remainingEffects, ...synergyResult.addedEffects];
      state.combatLog.push(synergyResult.message);
      floatingNumbers.push({
        id: `syn_${Date.now()}`,
        text: synergyResult.name,
        type: 'synergy',
        target: 'enemy'
      });
    }

    playerDamageDealt = baseDamage;
    state.enemyHp = Math.max(0, state.enemyHp - playerDamageDealt);
    state.combatLog.push(
      `⚔️ You strike with ${attackElement} dealing ${playerDamageDealt} damage!${isCrit ? ' 💥 CRITICAL HIT!' : ''}`
    );

    floatingNumbers.push({
      id: `dmg_${Date.now()}`,
      text: `-${playerDamageDealt}`,
      type: isCrit ? 'crit' : 'damage',
      target: 'enemy'
    });
  }

  // Check if enemy defeated
  if (state.enemyHp <= 0) {
    state.isOver = true;
    state.playerWon = true;
    state.combatLog.push('🏆 Victory! The hostile foe has been vanquished!');
    state.lastSynergy = synergyResult;
    state.floatingNumbers = floatingNumbers;
    return { state, playerDmg: playerDamageDealt, enemyDmg: 0, synergy: synergyResult };
  }

  // 2. Enemy turn against player defensive stance
  const currentIntent = state.enemyIntent;
  let enemyRawDamage = Math.round(enemyStats.attack * currentIntent.damageMultiplier);

  // Apply defense mitigation based on player stance
  const mitigation = resolveDefensiveStance(enemyRawDamage, state.playerStance, playerStats.speed, enemyStats.speed);
  enemyDamageDealt = mitigation.damageTaken;

  if (mitigation.damageReflected > 0) {
    state.enemyHp = Math.max(0, state.enemyHp - mitigation.damageReflected);
    state.combatLog.push(mitigation.message);
    floatingNumbers.push({
      id: `ref_${Date.now()}`,
      text: `-${mitigation.damageReflected} Reflected`,
      type: 'parry',
      target: 'enemy'
    });
  } else if (mitigation.message) {
    state.combatLog.push(mitigation.message);
  } else {
    state.combatLog.push(`👾 Enemy unleashed ${currentIntent.name} dealing ${enemyDamageDealt} damage.`);
  }

  state.playerHp = Math.max(0, state.playerHp - enemyDamageDealt);
  floatingNumbers.push({
    id: `edmg_${Date.now()}`,
    text: `-${enemyDamageDealt}`,
    type: 'damage',
    target: 'player'
  });

  if (mitigation.staminaRestored > 0 || mitigation.manaRestored > 0) {
    state.playerMana = Math.min(state.playerMaxMana, state.playerMana + mitigation.manaRestored);
  }

  // Check if player defeated
  if (state.playerHp <= 0) {
    state.isOver = true;
    state.playerWon = false;
    state.combatLog.push('💀 You were overwhelmed in combat...');
  }

  // 3. Increment round and telegraph NEXT enemy intent
  state.round += 1;
  const enemyHpPercent = Math.round((state.enemyHp / state.enemyMaxHp) * 100);
  state.enemyIntent = generateEnemyIntent(state.round, enemyHpPercent, enemyAbilities);
  state.lastSynergy = synergyResult;
  state.floatingNumbers = floatingNumbers;

  return { state, playerDmg: playerDamageDealt, enemyDmg: enemyDamageDealt, synergy: synergyResult };
}
