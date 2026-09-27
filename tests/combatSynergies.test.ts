import { describe, it, expect } from 'vitest';
import {
  evaluateElementalSynergy,
  type CombatStatusEffect,
  generateEnemyIntent,
  resolveDefensiveStance,
  createCombatState,
  executeCombatTurn,
  type CombatStats,
  type EnemyStats
} from '../packages/core/src/combat/index.js';
import { devCheats } from '../packages/core/src/sandbox/devCheats.js';

describe('Tactical Combat Engine & Elemental Synergies', () => {
  it('should trigger ELECTROCUTE synergy when Lightning strikes a Wet enemy', () => {
    const wetDebuff: CombatStatusEffect = {
      id: 'wet_1',
      name: 'Wet',
      type: 'debuff',
      turnsRemaining: 2
    };

    const result = evaluateElementalSynergy('Lightning', [wetDebuff], 100);

    expect(result.reaction).toBe('electrocute');
    expect(result.bonusDamage).toBe(40);
    expect(result.addedEffects[0].name).toBe('Electrocuted');
    expect(result.addedEffects[0].statModifier?.stat).toBe('speed');
    expect(result.addedEffects[0].statModifier?.percent).toBe(-30);
  });

  it('should trigger SHATTER synergy when Physical attack strikes a Frozen enemy', () => {
    const frozenDebuff: CombatStatusEffect = {
      id: 'freeze_1',
      name: 'Frozen',
      type: 'debuff',
      turnsRemaining: 1
    };

    const result = evaluateElementalSynergy('Physical', [frozenDebuff], 100);

    expect(result.reaction).toBe('shatter');
    expect(result.bonusDamage).toBe(60);
    expect(result.addedEffects[0].name).toBe('Staggered');
    expect(result.remainingEffects.length).toBe(0); // Freeze broken
  });

  it('should trigger HELLFIRE synergy when Void strikes a Burned enemy', () => {
    const burnDebuff: CombatStatusEffect = {
      id: 'burn_1',
      name: 'Burned',
      type: 'debuff',
      turnsRemaining: 3
    };

    const result = evaluateElementalSynergy('Void', [burnDebuff], 120);

    expect(result.reaction).toBe('hellfire');
    expect(result.bonusDamage).toBe(60);
    expect(result.addedEffects[0].name).toBe('Hellfire');
    expect(result.addedEffects[0].statModifier?.percent).toBe(-25);
  });

  it('should generate telegraphed enemy intents and handle Guard / Parry mitigation', () => {
    // Enemy intent telegraph
    const intent = generateEnemyIntent(3, 80, [{ name: 'Molten Slam', chance: 50 }]);
    expect(intent.isTelegraphed).toBe(true);
    expect(intent.damageMultiplier).toBeGreaterThanOrEqual(1.5);

    // Guard mitigation
    const guardResult = resolveDefensiveStance(100, 'guard', 15, 10);
    expect(guardResult.damageTaken).toBe(45); // 55% reduction
    expect(guardResult.staminaRestored).toBe(15);
    expect(guardResult.manaRestored).toBe(10);

    // Parry deflection
    const parryResult = resolveDefensiveStance(100, 'parry', 30, 10);
    expect(parryResult.damageTaken).toBeLessThanOrEqual(70);
    if (parryResult.isStaggered) {
      expect(parryResult.damageReflected).toBeGreaterThan(0);
    }
  });

  it('should execute full tactical combat turn with floating numbers and state progression', () => {
    const playerStats: CombatStats = {
      hp: 150,
      maxHp: 150,
      mana: 80,
      maxMana: 80,
      attack: 35,
      defense: 15,
      speed: 20,
      critChance: 10,
      critDmg: 150,
      luck: 10,
      element: 'Lightning'
    };

    const enemyStats: EnemyStats = {
      hp: 120,
      attack: 20,
      defense: 10,
      speed: 12
    };

    const state = createCombatState(playerStats, enemyStats);
    // Add wet debuff to enemy to test synergy in full turn
    state.enemyBuffs.push({
      id: 'w1',
      name: 'Wet',
      type: 'debuff',
      turnsRemaining: 2
    });

    const turnResult = executeCombatTurn(state, { type: 'attack', element: 'Lightning' }, playerStats, enemyStats);

    expect(turnResult.playerDmg).toBeGreaterThan(0);
    expect(turnResult.synergy?.reaction).toBe('electrocute');
    expect(state.floatingNumbers.length).toBeGreaterThan(0);
    expect(state.round).toBe(2);
  });

  it('should verify developer sandbox cheats mutate state predictably', () => {
    const vitals = devCheats.refillVitals(250, 150, 100);
    expect(vitals.hpCurrent).toBe(250);
    expect(vitals.manaCurrent).toBe(150);
    expect(vitals.stamina).toBe(100);

    const wealth = devCheats.grantWealth(500, 10, 10000, 500);
    expect(wealth.gold).toBe(10500);
    expect(wealth.gems).toBe(510);

    const jump = devCheats.jumpLevel(25);
    expect(jump.level).toBe(25);

    const teleport = devCheats.teleport('shadow_forest');
    expect(teleport.currentZoneId).toBe('shadow_forest');
  });
});
