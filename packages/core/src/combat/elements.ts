export type ElementalAffinity = 'Physical' | 'Fire' | 'Frost' | 'Lightning' | 'Holy' | 'Void';

export interface CombatStatusEffect {
  id: string;
  name: string;
  element?: ElementalAffinity;
  type: 'buff' | 'debuff';
  damagePerTurn?: number;
  healPerTurn?: number;
  stat?: any;
  value?: number;
  percentValue?: number;
  statModifier?: {
    stat: 'attack' | 'defense' | 'speed';
    percent: number;
  };
  turnsRemaining: number;
}

export type SynergyReactionType = 'electrocute' | 'shatter' | 'hellfire' | 'purify' | 'superconduct';

export interface SynergyReactionResult {
  reaction: SynergyReactionType | null;
  name: string;
  bonusDamage: number;
  remainingEffects: CombatStatusEffect[];
  addedEffects: CombatStatusEffect[];
  message: string;
}

/**
 * Evaluates elemental interactions between an incoming attack element and active status effects.
 */
export function evaluateElementalSynergy(
  incomingElement: ElementalAffinity,
  activeEffects: CombatStatusEffect[],
  baseDamage: number
): SynergyReactionResult {
  const hasEffect = (name: string) => activeEffects.some(e => e.name.toLowerCase() === name.toLowerCase());
  const removeEffect = (name: string) => activeEffects.filter(e => e.name.toLowerCase() !== name.toLowerCase());

  // 1. ELECTROCUTE: Wet/Chilled + Lightning
  if (incomingElement === 'Lightning' && (hasEffect('wet') || hasEffect('chilled'))) {
    const bonus = Math.round(baseDamage * 0.40);
    const electrocuteDebuff: CombatStatusEffect = {
      id: `electrocute_${Date.now()}`,
      name: 'Electrocuted',
      element: 'Lightning',
      type: 'debuff',
      damagePerTurn: Math.round(baseDamage * 0.15),
      statModifier: { stat: 'speed', percent: -30 },
      turnsRemaining: 2
    };

    return {
      reaction: 'electrocute',
      name: '⚡ ELECTROCUTE',
      bonusDamage: bonus,
      remainingEffects: removeEffect('wet'),
      addedEffects: [electrocuteDebuff],
      message: `⚡ Synergistic Reaction: ELECTROCUTE! Water surged with lightning, dealing +${bonus} bonus damage and slowing the target!`
    };
  }

  // 2. SHATTER: Frozen/Chilled + Physical Strike
  if (incomingElement === 'Physical' && (hasEffect('frozen') || hasEffect('chilled'))) {
    const isFrozen = hasEffect('frozen');
    const multiplier = isFrozen ? 0.60 : 0.35;
    const bonus = Math.round(baseDamage * multiplier);

    const staggerDebuff: CombatStatusEffect = {
      id: `stagger_${Date.now()}`,
      name: 'Staggered',
      element: 'Physical',
      type: 'debuff',
      statModifier: { stat: 'defense', percent: -20 },
      turnsRemaining: 2
    };

    return {
      reaction: 'shatter',
      name: '💥 SHATTER',
      bonusDamage: bonus,
      remainingEffects: removeEffect(isFrozen ? 'frozen' : 'chilled'),
      addedEffects: [staggerDebuff],
      message: `💥 Synergistic Reaction: SHATTER! The brittle ice shattered, dealing +${bonus} true damage and sundering defenses!`
    };
  }

  // 3. HELLFIRE: Burn + Void (or Void + Fire)
  if ((incomingElement === 'Void' && hasEffect('burned')) || (incomingElement === 'Fire' && hasEffect('void-touched'))) {
    const bonus = Math.round(baseDamage * 0.50);
    const hellfireDebuff: CombatStatusEffect = {
      id: `hellfire_${Date.now()}`,
      name: 'Hellfire',
      element: 'Fire',
      type: 'debuff',
      damagePerTurn: Math.round(baseDamage * 0.30),
      statModifier: { stat: 'defense', percent: -25 },
      turnsRemaining: 3
    };

    let remaining = removeEffect('burned');
    remaining = remaining.filter(e => e.name.toLowerCase() !== 'void-touched');

    return {
      reaction: 'hellfire',
      name: '🔥 HELLFIRE',
      bonusDamage: bonus,
      remainingEffects: remaining,
      addedEffects: [hellfireDebuff],
      message: `🔥 Synergistic Reaction: HELLFIRE! Nether voids ignited with demonic flame for +${bonus} damage and defense reduction!`
    };
  }

  // 4. PURIFY: Holy on Cursed/Void targets
  if (incomingElement === 'Holy' && (hasEffect('void-touched') || hasEffect('poisoned'))) {
    const bonus = Math.round(baseDamage * 0.45);
    return {
      reaction: 'purify',
      name: '✨ PURIFY',
      bonusDamage: bonus,
      remainingEffects: removeEffect('void-touched').filter(e => e.name.toLowerCase() !== 'poisoned'),
      addedEffects: [],
      message: `✨ Synergistic Reaction: RADIANT PURIFY! Holy light purged dark afflictions, detonating for +${bonus} radiant damage!`
    };
  }

  return {
    reaction: null,
    name: '',
    bonusDamage: 0,
    remainingEffects: activeEffects,
    addedEffects: [],
    message: ''
  };
}
