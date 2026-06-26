import { rollChance } from '../../utils/random.js';
import {
  type CombatState,
  type CombatStats,
  type EnemyStats,
  type EnemyAbility,
  type TurnResult,
  type StatusEffect,
  processStatusEffects
} from './engine.js';
import {
  calculateDamage,
  calculateDodgeChance,
  getStatModifier
} from './formulas.js';

/**
 * Processes the enemy's turn. The enemy AI picks abilities based on chance
 * weights; otherwise it performs a basic attack. Returns updated state.
 */
export function processEnemyTurn(
  state: CombatState,
  playerStats: CombatStats,
  enemyStats: EnemyStats,
  enemyAbilities: EnemyAbility[],
): TurnResult {
  let enemyDamageDealt = 0;
  let enemyAction = '';

  // Process enemy status effects at the start of their turn
  const enemyEffectLogs = processStatusEffects(state, 'enemy');
  state.combatLog.push(...enemyEffectLogs);

  // Check if enemy died from DoTs
  if (state.enemyHp <= 0) {
    state.isOver = true;
    state.playerWon = true;
    state.combatLog.push('🎉 The enemy succumbed to its wounds!');
    return {
      state,
      playerDamageDealt: 0,
      enemyDamageDealt: 0,
      playerAction: '',
      enemyAction: '💀 The enemy has been defeated!',
    };
  }

  // Apply stat modifiers from buffs/debuffs
  const atkMod = getStatModifier(state.enemyBuffs, 'attack');
  const defMod = getStatModifier(state.enemyBuffs, 'defense');

  const effectiveAtk = Math.max(1, enemyStats.attack + atkMod);
  const _effectiveDef = Math.max(0, enemyStats.defense + defMod);

  // Try to use an ability
  let usedAbility = false;

  if (enemyAbilities.length > 0) {
    // Shuffle and try each ability by its chance
    for (const ability of enemyAbilities) {
      if (rollChance(ability.chance)) {
        // Use this ability
        if (ability.damage && ability.damage > 0) {
          let dmg = ability.damage;

          // Apply defend reduction
          if (state.isPlayerDefending) {
            dmg = Math.round(dmg * 0.5);
          }

          enemyDamageDealt = dmg;
          state.playerHp = Math.max(0, state.playerHp - dmg);
          enemyAction = `🔮 Enemy used ${ability.name} and dealt ${dmg} damage!`;
        } else if (ability.healing && ability.healing > 0) {
          const maxHeal = state.enemyMaxHp - state.enemyHp;
          const healed = Math.min(ability.healing, maxHeal);
          state.enemyHp += healed;
          enemyAction = `💚 Enemy used ${ability.name} and healed ${healed} HP!`;
        } else {
          enemyAction = `🔮 Enemy used ${ability.name}!`;
        }

        // Apply ability status effect if it has one
        if (ability.effect) {
          const statusEffect: StatusEffect = {
            id: ability.effect.id,
            name: ability.effect.name,
            type: ability.effect.type,
            stat: ability.effect.stat,
            value: ability.effect.value,
            percentValue: ability.effect.percentValue,
            damagePerTurn: ability.effect.damagePerTurn,
            healPerTurn: ability.effect.healPerTurn,
            turnsRemaining: ability.effect.duration,
          };

          if (ability.effect.target === 'self') {
            state.enemyBuffs.push(statusEffect);
            enemyAction += ` (${statusEffect.name} applied!)`;
          } else {
            state.playerBuffs.push(statusEffect);
            enemyAction += ` (${statusEffect.name} applied to you!)`;
          }
        }

        state.combatLog.push(enemyAction);
        usedAbility = true;
        break;
      }
    }
  }

  // Basic attack if no ability was used
  if (!usedAbility) {
    // Check if player dodges
    const playerDefMod = getStatModifier(state.playerBuffs, 'speed');
    const effectivePlayerSpeed = Math.max(0, playerStats.speed + playerDefMod);
    const dodgeChance = calculateDodgeChance(enemyStats.speed, effectivePlayerSpeed);

    if (rollChance(dodgeChance)) {
      enemyAction = '💨 You dodged the enemy\'s attack!';
      state.combatLog.push(enemyAction);
    } else {
      const { damage, isCrit } = calculateDamage(
        effectiveAtk,
        playerStats.defense + getStatModifier(state.playerBuffs, 'defense'),
        5, // enemies have a flat 5% crit chance
        150, // enemies have 150% crit damage
      );

      let finalDmg = damage;

      // Apply defend reduction
      if (state.isPlayerDefending) {
        finalDmg = Math.round(finalDmg * 0.5);
      }

      enemyDamageDealt = finalDmg;
      state.playerHp = Math.max(0, state.playerHp - finalDmg);

      if (isCrit) {
        enemyAction = `⚡ Enemy CRITICAL HIT! Dealt ${finalDmg} damage to you!`;
      } else {
        enemyAction = `👊 Enemy attacks and deals ${finalDmg} damage!`;
      }
      state.combatLog.push(enemyAction);
    }
  }

  // Check if player is dead after enemy's action
  if (state.playerHp <= 0) {
    state.isOver = true;
    state.playerWon = false;
    state.combatLog.push('💀 You have been defeated...');
  }

  // Increment round after both turns
  state.round += 1;

  // Reset defend flag at the end of the round
  state.isPlayerDefending = false;

  return {
    state,
    playerDamageDealt: 0,
    enemyDamageDealt,
    playerAction: '',
    enemyAction,
  };
}
