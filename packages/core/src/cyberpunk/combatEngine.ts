import type {
  CombatEnemy,
  CyberpunkGameState,
  CyberpunkPlayer,
  ElementalEffect,
  WeaponStats,
} from './types.js';

export interface ShotImpactResult {
  hit: boolean;
  isHeadshot: boolean;
  isCrit: boolean;
  totalDamage: number;
  shieldDamage: number;
  hpDamage: number;
  killed: boolean;
  elementalEffect: ElementalEffect;
  lootAwarded?: {
    credits: number;
    scrap: number;
    keycardDropped: boolean;
  };
}

export function calculateShotDamage(
  player: CyberpunkPlayer,
  weapon: WeaponStats,
  enemy: CombatEnemy,
  isHeadshot: boolean = false
): ShotImpactResult {
  const hasSmartLink = player.activePerks.includes('smart_link');
  const baseCritChance = hasSmartLink ? 0.35 : 0.05;
  const isCrit = Math.random() < baseCritChance;

  let damageMultiplier = 1.0;
  if (isHeadshot) {
    damageMultiplier *= hasSmartLink ? 2.5 : 2.0;
  }
  if (isCrit) {
    damageMultiplier *= 1.5;
  }

  // Base raw damage
  let rawDamage = weapon.damage * damageMultiplier;

  // Elemental multipliers
  if (weapon.elementalEffect === 'shock' && enemy.shield > 0) {
    rawDamage *= 1.5; // Shock strips shields
  } else if (weapon.elementalEffect === 'plasma') {
    rawDamage *= 1.25; // Plasma melts armor and core alloy
  } else if (weapon.elementalEffect === 'incendiary') {
    rawDamage *= 1.2; // Extra thermal burn
  } else if (weapon.elementalEffect === 'pierce' && enemy.armor > 10) {
    rawDamage *= 1.3; // Penetrates heavy chassis
  }

  const effectiveArmor = weapon.elementalEffect === 'plasma' ? enemy.armor * 0.5 : enemy.armor;
  const mitigatedDamage = Math.max(1, Math.round(rawDamage - effectiveArmor * 0.4));

  let currentEnemyShield = enemy.shield;
  let currentEnemyHp = enemy.hp;

  let shieldDmg = 0;
  let hpDmg = 0;

  if (currentEnemyShield > 0) {
    if (mitigatedDamage <= currentEnemyShield) {
      shieldDmg = mitigatedDamage;
      currentEnemyShield -= mitigatedDamage;
    } else {
      shieldDmg = currentEnemyShield;
      const leftover = mitigatedDamage - currentEnemyShield;
      currentEnemyShield = 0;
      hpDmg = Math.min(currentEnemyHp, leftover);
      currentEnemyHp -= hpDmg;
    }
  } else {
    hpDmg = Math.min(currentEnemyHp, mitigatedDamage);
    currentEnemyHp -= hpDmg;
  }

  const killed = currentEnemyHp <= 0;
  let lootAwarded: ShotImpactResult['lootAwarded'];

  if (killed) {
    const keycardDropped = Math.random() < enemy.loot.keycardChance;
    lootAwarded = {
      credits: enemy.loot.credits,
      scrap: enemy.loot.scrap,
      keycardDropped,
    };
  }

  return {
    hit: true,
    isHeadshot,
    isCrit,
    totalDamage: shieldDmg + hpDmg,
    shieldDamage: shieldDmg,
    hpDamage: hpDmg,
    killed,
    elementalEffect: weapon.elementalEffect,
    lootAwarded,
  };
}

export function applyEnemyDamageToPlayer(
  player: CyberpunkPlayer,
  incomingDamage: number
): { updatedPlayer: CyberpunkPlayer; downed: boolean; traumaRevived: boolean } {
  let shield = player.shield;
  let hp = player.hp;
  let remaining = incomingDamage;

  if (shield > 0) {
    if (remaining <= shield) {
      shield -= remaining;
      remaining = 0;
    } else {
      remaining -= shield;
      shield = 0;
    }
  }

  hp = Math.max(0, hp - remaining);
  let downed = hp <= 0;
  let traumaRevived = false;

  // Check trauma_ghost perk auto-revive
  if (downed && player.activePerks.includes('trauma_ghost')) {
    traumaRevived = true;
    downed = false;
    hp = Math.round(player.maxHp * 0.6);
    shield = player.maxShield;
    // Remove one-time trauma ghost perk after triggering
    const perks = player.activePerks.filter((p) => p !== 'trauma_ghost');
    return {
      updatedPlayer: {
        ...player,
        hp,
        shield,
        activePerks: perks,
        isDowned: false,
        revivalCount: player.revivalCount + 1,
      },
      downed: false,
      traumaRevived: true,
    };
  }

  return {
    updatedPlayer: {
      ...player,
      hp,
      shield,
      isDowned: downed,
    },
    downed,
    traumaRevived: false,
  };
}

export function createEnemy(
  type: CombatEnemy['type'],
  waveMultiplier: number = 1.0,
  uniqueId?: string
): CombatEnemy {
  const id = uniqueId || `droid_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  switch (type) {
    case 'shock_hound':
      return {
        id,
        name: 'A-7 Shock Hound',
        code: 'DROID-HOUND',
        type: 'shock_hound',
        hp: Math.round(50 * waveMultiplier),
        maxHp: Math.round(50 * waveMultiplier),
        shield: 0,
        maxShield: 0,
        damage: Math.round(15 * waveMultiplier),
        armor: 5,
        loot: { credits: 40, scrap: 5, keycardChance: 0.05 },
      };
    case 'corp_enforcer':
      return {
        id,
        name: 'Vanguard Corp Enforcer',
        code: 'DROID-ENF',
        type: 'corp_enforcer',
        hp: Math.round(130 * waveMultiplier),
        maxHp: Math.round(130 * waveMultiplier),
        shield: Math.round(50 * waveMultiplier),
        maxShield: Math.round(50 * waveMultiplier),
        damage: Math.round(22 * waveMultiplier),
        armor: 15,
        loot: { credits: 120, scrap: 12, keycardChance: 0.15 },
      };
    case 'heavy_mech':
      return {
        id,
        name: 'Goliath Siege Automaton',
        code: 'DROID-MECH',
        type: 'heavy_mech',
        hp: Math.round(350 * waveMultiplier),
        maxHp: Math.round(350 * waveMultiplier),
        shield: Math.round(120 * waveMultiplier),
        maxShield: Math.round(120 * waveMultiplier),
        damage: Math.round(35 * waveMultiplier),
        armor: 25,
        loot: { credits: 300, scrap: 35, keycardChance: 0.3 },
      };
    case 'stealth_infiltrator':
      return {
        id,
        name: 'Ghost-Blade Infiltrator',
        code: 'DROID-GHOST',
        type: 'stealth_infiltrator',
        hp: Math.round(90 * waveMultiplier),
        maxHp: Math.round(90 * waveMultiplier),
        shield: Math.round(40 * waveMultiplier),
        maxShield: Math.round(40 * waveMultiplier),
        damage: Math.round(26 * waveMultiplier),
        armor: 8,
        loot: { credits: 90, scrap: 8, keycardChance: 0.1 },
      };
    case 'security_droid':
    default:
      return {
        id,
        name: 'Sec-Drone Mk.IV',
        code: 'DROID-SEC4',
        type: 'security_droid',
        hp: Math.round(70 * waveMultiplier),
        maxHp: Math.round(70 * waveMultiplier),
        shield: Math.round(20 * waveMultiplier),
        maxShield: Math.round(20 * waveMultiplier),
        damage: Math.round(14 * waveMultiplier),
        armor: 8,
        loot: { credits: 60, scrap: 6, keycardChance: 0.08 },
      };
  }
}

export function generateWaveEnemies(
  waveNumber: number,
  unlockedSectorCount: number
): CombatEnemy[] {
  const multiplier = 1 + (waveNumber - 1) * 0.15 + (unlockedSectorCount - 1) * 0.1;
  const count = Math.min(18, 4 + waveNumber * 2 + unlockedSectorCount * 2);
  const enemies: CombatEnemy[] = [];

  for (let i = 0; i < count; i++) {
    let type: CombatEnemy['type'] = 'security_droid';
    const roll = Math.random();

    if (waveNumber >= 4 && roll < 0.2) {
      type = 'heavy_mech';
    } else if (waveNumber >= 3 && roll < 0.45) {
      type = 'corp_enforcer';
    } else if (waveNumber >= 2 && roll < 0.7) {
      type = 'stealth_infiltrator';
    } else if (roll < 0.4) {
      type = 'shock_hound';
    }

    enemies.push(createEnemy(type, multiplier, `wave_${waveNumber}_enemy_${i}`));
  }

  return enemies;
}

export function triggerEmpDischarge(
  state: CyberpunkGameState,
  damage: number = 60
): { newState: CyberpunkGameState; droidsDamaged: number } {
  let count = 0;
  const updatedSquad = state.raidState.activeSquad.map((droid) => {
    count++;
    const newShield = Math.max(0, droid.shield - damage * 1.5);
    const leftover = Math.max(0, damage - droid.shield);
    const newHp = Math.max(0, droid.hp - leftover);
    return {
      ...droid,
      shield: newShield,
      hp: newHp,
    };
  }).filter((d) => d.hp > 0);

  return {
    newState: {
      ...state,
      raidState: {
        ...state.raidState,
        activeSquad: updatedSquad,
      },
    },
    droidsDamaged: count,
  };
}
