import { rollChance, rollBetween } from '../../utils/random.js';

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

// ─── Damage Calculation ──────────────────────────────────────────────

/**
 * Calculates damage dealt from an attacker to a defender.
 * Formula: baseDmg = max(1, atk - def/2) * randomVariance(0.85–1.15)
 * If crit rolls, multiply by critDmg / 100.
 *
 * At equal-ish stats (10 atk vs 5 def), base damage ≈ 7–9.
 */
export function calculateDamage(
  attackerAtk: number,
  defenderDef: number,
  critChance: number,
  critDmg: number,
): { damage: number; isCrit: boolean } {
  // Base damage: attack minus half of defense, minimum 1
  const rawBase = Math.max(1, attackerAtk - defenderDef / 2);

  // Random variance between 0.85 and 1.15 (inclusive range mapped to float)
  const varianceRoll = rollBetween(85, 115);
  const variance = varianceRoll / 100;

  let damage = Math.round(rawBase * variance);

  // Crit check
  const isCrit = rollChance(critChance);
  if (isCrit) {
    damage = Math.round(damage * (critDmg / 100));
  }

  // Ensure at least 1 damage
  damage = Math.max(1, damage);

  return { damage, isCrit };
}

// ─── Dodge Calculation ───────────────────────────────────────────────

/**
 * Calculates dodge chance based on speed differential.
 * Base 5% + (defenderSpeed - attackerSpeed) * 0.5, clamped 0–30%.
 */
export function calculateDodgeChance(
  attackerSpeed: number,
  defenderSpeed: number,
): number {
  const raw = 5 + (defenderSpeed - attackerSpeed) * 0.5;
  return Math.min(30, Math.max(0, raw));
}

// ─── Flee Check ──────────────────────────────────────────────────────

/**
 * Determines if a flee attempt is successful.
 * Chance = 30% + (playerSpeed * 0.5)%, so faster characters escape easier.
 */
export function isFleeSuccessful(
  playerSpeed: number,
  _enemySpeed: number,
): boolean {
  const chance = 30 + playerSpeed * 0.5;
  return rollChance(Math.min(chance, 90)); // Cap at 90% max flee chance
}

// ─── Status Effects Processing ───────────────────────────────────────

/**
 * Returns the total flat modifier for a given stat from active buffs/debuffs.
 */
export function getStatModifier(effects: StatusEffect[], stat: keyof CombatStats): number {
  let total = 0;
  for (const eff of effects) {
    if (eff.stat === stat && eff.value !== undefined) {
      total += eff.type === 'buff' ? eff.value : -eff.value;
    }
  }
  return total;
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
  const effectiveDef = Math.max(0, enemyStats.defense + defMod);

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
