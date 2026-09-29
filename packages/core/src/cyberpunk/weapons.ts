import type {
  CyberPerk,
  CyberPerkId,
  CyberpunkGameState,
  CyberpunkPlayer,
  OverclockTier,
  WeaponId,
  WeaponStats,
} from './types.js';

export const WEAPON_DEFINITIONS: Record<WeaponId, Record<OverclockTier, WeaponStats>> = {
  scrap_pistol: {
    0: {
      id: 'scrap_pistol_t0',
      baseId: 'scrap_pistol',
      name: 'P-04 Scrap Autopistol',
      code: 'WPN-P0',
      tier: 0,
      damage: 24,
      fireRate: 350,
      magazineSize: 12,
      currentAmmo: 12,
      reloadTimeMs: 1400,
      elementalEffect: 'none',
      neonColor: '#38bdf8', // Neon Sky Blue
      overclockCost: { credits: 500, scrap: 15 },
      description: 'Salvaged metro police sidearm pieced together with scrap metal and magnetic coils.',
    },
    1: {
      id: 'scrap_pistol_t1',
      baseId: 'scrap_pistol',
      name: 'Twin-Arc Sparker',
      code: 'WPN-P1',
      tier: 1,
      damage: 48,
      fireRate: 300,
      magazineSize: 16,
      currentAmmo: 16,
      reloadTimeMs: 1200,
      elementalEffect: 'shock',
      neonColor: '#06b6d4', // Cyan Arc
      overclockCost: { credits: 1200, scrap: 30 },
      description: 'Overclocked capacitors cycle dual electric arcs, shocking nearby droid chassis.',
    },
    2: {
      id: 'scrap_pistol_t2',
      baseId: 'scrap_pistol',
      name: 'Overcharged Tesla Coil',
      code: 'WPN-P2',
      tier: 2,
      damage: 85,
      fireRate: 260,
      magazineSize: 20,
      currentAmmo: 20,
      reloadTimeMs: 1000,
      elementalEffect: 'plasma',
      neonColor: '#a855f7', // High Purple
      overclockCost: { credits: 2500, scrap: 60 },
      description: 'Miniaturized fusion lathe coils melt tungsten slugs into high-velocity plasma bursts.',
    },
    3: {
      id: 'scrap_pistol_t3',
      baseId: 'scrap_pistol',
      name: 'Singularity Sidearm',
      code: 'WPN-P3',
      tier: 3,
      damage: 160,
      fireRate: 220,
      magazineSize: 24,
      currentAmmo: 24,
      reloadTimeMs: 800,
      elementalEffect: 'plasma',
      neonColor: '#ec4899', // Hot Neon Pink
      overclockCost: null,
      description: 'Peak black-market overclock. Collapses micro-gravitational fields on hit.',
    },
  },
  auto_shotgun: {
    0: {
      id: 'auto_shotgun_t0',
      baseId: 'auto_shotgun',
      name: 'Street Sweeper Trench Gun',
      code: 'WPN-SG0',
      tier: 0,
      damage: 14, // 8 pellets = 112 total
      fireRate: 700,
      magazineSize: 6,
      currentAmmo: 6,
      reloadTimeMs: 2000,
      elementalEffect: 'none',
      neonColor: '#fb923c', // Amber
      overclockCost: { credits: 750, scrap: 20 },
      description: 'Drum-fed 12-gauge close-quarters shotgun built for tight subway corridor skirmishes.',
    },
    1: {
      id: 'auto_shotgun_t1',
      baseId: 'auto_shotgun',
      name: 'Dragon-Breath Scatterer',
      code: 'WPN-SG1',
      tier: 1,
      damage: 24, // 8 pellets = 192 total
      fireRate: 600,
      magazineSize: 8,
      currentAmmo: 8,
      reloadTimeMs: 1800,
      elementalEffect: 'incendiary',
      neonColor: '#ef4444', // Red Flame
      overclockCost: { credits: 1600, scrap: 40 },
      description: 'Thermite-infused buckshot sets robotic armor ablatives ablaze on contact.',
    },
    2: {
      id: 'auto_shotgun_t2',
      baseId: 'auto_shotgun',
      name: 'Mag-Slug Shredder',
      code: 'WPN-SG2',
      tier: 2,
      damage: 44, // 8 pellets = 352 total
      fireRate: 500,
      magazineSize: 10,
      currentAmmo: 10,
      reloadTimeMs: 1500,
      elementalEffect: 'pierce',
      neonColor: '#f59e0b', // Gold Pierce
      overclockCost: { credits: 3200, scrap: 75 },
      description: 'Accelerates tungsten-carbide sabots capable of piercing reinforced blast doors.',
    },
    3: {
      id: 'auto_shotgun_t3',
      baseId: 'auto_shotgun',
      name: 'Void Ripper Flak Cannon',
      code: 'WPN-SG3',
      tier: 3,
      damage: 75, // 8 pellets = 600 total
      fireRate: 400,
      magazineSize: 12,
      currentAmmo: 12,
      reloadTimeMs: 1200,
      elementalEffect: 'plasma',
      neonColor: '#d946ef', // Fuchsia Plasma
      overclockCost: null,
      description: 'Disintegrates targets into ionized ash with zero recoil and instant spread.',
    },
  },
  kinetic_smg: {
    0: {
      id: 'kinetic_smg_t0',
      baseId: 'kinetic_smg',
      name: 'Vanguard Vector SMG',
      code: 'WPN-SMG0',
      tier: 0,
      damage: 16,
      fireRate: 100,
      magazineSize: 30,
      currentAmmo: 30,
      reloadTimeMs: 1600,
      elementalEffect: 'none',
      neonColor: '#22d3ee', // Electric Cyan
      overclockCost: { credits: 800, scrap: 25 },
      description: 'High-cadence submachine gun with hydraulic recoil mitigation for laser-sharp corridor fire.',
    },
    1: {
      id: 'kinetic_smg_t1',
      baseId: 'kinetic_smg',
      name: 'Hyper-Velocity Puncture',
      code: 'WPN-SMG1',
      tier: 1,
      damage: 28,
      fireRate: 90,
      magazineSize: 40,
      currentAmmo: 40,
      reloadTimeMs: 1400,
      elementalEffect: 'pierce',
      neonColor: '#10b981', // Emerald
      overclockCost: { credits: 1800, scrap: 45 },
      description: 'Pneumatically compressed rounds penetrate robotic chassis and hit multiple targets.',
    },
    2: {
      id: 'kinetic_smg_t2',
      baseId: 'kinetic_smg',
      name: 'Cryo-Plasma Needle',
      code: 'WPN-SMG2',
      tier: 2,
      damage: 46,
      fireRate: 80,
      magazineSize: 50,
      currentAmmo: 50,
      reloadTimeMs: 1200,
      elementalEffect: 'plasma',
      neonColor: '#6366f1', // Indigo Plasma
      overclockCost: { credits: 3500, scrap: 80 },
      description: 'Flash-freezes mechanical servos while melting core logic boards in microsecond bursts.',
    },
    3: {
      id: 'kinetic_smg_t3',
      baseId: 'kinetic_smg',
      name: 'Chrono-Burst Reaper',
      code: 'WPN-SMG3',
      tier: 3,
      damage: 80,
      fireRate: 65,
      magazineSize: 60,
      currentAmmo: 60,
      reloadTimeMs: 950,
      elementalEffect: 'shock',
      neonColor: '#e11d48', // Crimson Overcharge
      overclockCost: null,
      description: 'Emits a blinding storm of charged tachyon needles with virtually zero spread.',
    },
  },
  heavy_rail_rifle: {
    0: {
      id: 'heavy_rail_rifle_t0',
      baseId: 'heavy_rail_rifle',
      name: 'M-99 Heavy Rail Rifle',
      code: 'WPN-RR0',
      tier: 0,
      damage: 150,
      fireRate: 1000,
      magazineSize: 4,
      currentAmmo: 4,
      reloadTimeMs: 2400,
      elementalEffect: 'pierce',
      neonColor: '#818cf8', // Indigo
      overclockCost: { credits: 1200, scrap: 30 },
      description: 'Electromagnetic accelerator launching hyper-sonic slugs capable of punching through bulkhead steel.',
    },
    1: {
      id: 'heavy_rail_rifle_t1',
      baseId: 'heavy_rail_rifle',
      name: 'High-Flux Gauss Piercer',
      code: 'WPN-RR1',
      tier: 1,
      damage: 280,
      fireRate: 900,
      magazineSize: 5,
      currentAmmo: 5,
      reloadTimeMs: 2100,
      elementalEffect: 'shock',
      neonColor: '#3b82f6', // Cobalt Electric
      overclockCost: { credits: 2400, scrap: 60 },
      description: 'Capacitive rails trigger an EMP shockwave along the bullet trajectory, stunning droids.',
    },
    2: {
      id: 'heavy_rail_rifle_t2',
      baseId: 'heavy_rail_rifle',
      name: 'Particle Annihilator',
      code: 'WPN-RR2',
      tier: 2,
      damage: 500,
      fireRate: 800,
      magazineSize: 6,
      currentAmmo: 6,
      reloadTimeMs: 1800,
      elementalEffect: 'plasma',
      neonColor: '#8b5cf6', // Violet
      overclockCost: { credits: 4500, scrap: 100 },
      description: 'Superheats anti-matter particulates to core sun temperatures, vaporizing heavy mechs.',
    },
    3: {
      id: 'heavy_rail_rifle_t3',
      baseId: 'heavy_rail_rifle',
      name: 'God-Slayer Particle Lance',
      code: 'WPN-RR3',
      tier: 3,
      damage: 900,
      fireRate: 700,
      magazineSize: 8,
      currentAmmo: 8,
      reloadTimeMs: 1400,
      elementalEffect: 'plasma',
      neonColor: '#f43f5e', // Rose Singularity
      overclockCost: null,
      description: 'Absolute apex destruction. Pierces every target in a line and tears localized spacetime.',
    },
  },
};

export const CYBER_PERKS: Record<CyberPerkId, CyberPerk> = {
  titan_subdermal: {
    id: 'titan_subdermal',
    name: 'Titan Sub-Dermal Weave',
    code: 'PRK-TITAN',
    cost: { credits: 2500 },
    description: 'Carbon-nanotube dermal layer. Grants +100 Max Shield and doubles shield regeneration speed.',
    passiveEffect: {
      maxShieldBonus: 100,
    },
  },
  overclock_stim: {
    id: 'overclock_stim',
    name: 'Adrenaline Overclock Injector',
    code: 'PRK-STIM',
    cost: { credits: 2000 },
    description: 'Neural stim pump. Increases sprint/movement speed by +35% and cuts weapon reload time by 25%.',
    passiveEffect: {
      speedBonus: 0.35,
    },
  },
  smart_link: {
    id: 'smart_link',
    name: 'Mil-Spec Smart-Link HUD',
    code: 'PRK-SMART',
    cost: { credits: 3000 },
    description: 'Optical telemetry implant. Increases critical hit chance by +30% and boosts headshot damage to 2.5x.',
    passiveEffect: {
      critChanceBonus: 0.3,
    },
  },
  trauma_ghost: {
    id: 'trauma_ghost',
    name: 'Trauma-Ghost Defibrillator',
    code: 'PRK-REVIVE',
    cost: { credits: 1500 },
    description: 'Emergency sub-clavicle defibrillator. Automatically pulses when downed, instantly reviving the player.',
    passiveEffect: {
      revivePassive: true,
    },
  },
  emp_capacitance: {
    id: 'emp_capacitance',
    name: 'EMP Static Discharge Coil',
    code: 'PRK-EMP',
    cost: { credits: 2200 },
    description: 'Capacitive skin coils. Every weapon reload releases a disruptive EMP blast damaging nearby security droids.',
    passiveEffect: {
      empBonus: 60,
    },
  },
};

export function getWeaponStats(baseId: WeaponId, tier: OverclockTier): WeaponStats {
  return WEAPON_DEFINITIONS[baseId][tier];
}

export function createInitialPlayerState(): CyberpunkPlayer {
  const initialWeapon = { ...WEAPON_DEFINITIONS.scrap_pistol[0] };
  return {
    name: 'Mercenary V-04',
    level: 1,
    hp: 100,
    maxHp: 100,
    shield: 100,
    maxShield: 100,
    credits: 500,
    scrap: 30,
    energyCells: 250,
    decryptKeys: 0,
    medStims: 2,
    equippedWeapon: initialWeapon,
    inventoryWeapons: [
      initialWeapon,
      { ...WEAPON_DEFINITIONS.auto_shotgun[0] },
      { ...WEAPON_DEFINITIONS.kinetic_smg[0] },
      { ...WEAPON_DEFINITIONS.heavy_rail_rifle[0] },
    ],
    activePerks: [],
    isDowned: false,
    revivalCount: 0,
  };
}

export function canOverclockWeapon(
  player: CyberpunkPlayer,
  weapon: WeaponStats
): { canOverclock: boolean; reason?: string } {
  if (weapon.tier >= 3) {
    return { canOverclock: false, reason: 'Weapon is already at maximum Overclock Tier (Tier 3).' };
  }

  const nextTier = (weapon.tier + 1) as OverclockTier;
  const nextStats = WEAPON_DEFINITIONS[weapon.baseId][nextTier];
  const cost = weapon.overclockCost;

  if (!cost) {
    return { canOverclock: false, reason: 'No overclock blueprint available.' };
  }

  const creditsNeeded = cost.credits || 0;
  const scrapNeeded = cost.scrap || 0;

  if (player.credits < creditsNeeded) {
    return {
      canOverclock: false,
      reason: `Insufficient credits (needs ${creditsNeeded}, have ${player.credits}).`,
    };
  }

  if (player.scrap < scrapNeeded) {
    return {
      canOverclock: false,
      reason: `Insufficient tech scrap (needs ${scrapNeeded}, have ${player.scrap}).`,
    };
  }

  return { canOverclock: true };
}

export function overclockWeapon(
  state: CyberpunkGameState,
  weaponId?: string
): { success: boolean; newState: CyberpunkGameState; error?: string } {
  const targetId = weaponId || state.player.equippedWeapon.id;
  const invIndex = state.player.inventoryWeapons.findIndex((w) => w.id === targetId);

  if (invIndex === -1) {
    return { success: false, newState: state, error: 'Weapon not found in inventory.' };
  }

  const currentWeapon = state.player.inventoryWeapons[invIndex];
  const check = canOverclockWeapon(state.player, currentWeapon);

  if (!check.canOverclock) {
    return { success: false, newState: state, error: check.reason };
  }

  const nextTier = (currentWeapon.tier + 1) as OverclockTier;
  const upgradedStats = { ...WEAPON_DEFINITIONS[currentWeapon.baseId][nextTier] };
  const cost = currentWeapon.overclockCost!;

  const updatedPlayer: CyberpunkPlayer = {
    ...state.player,
    credits: state.player.credits - (cost.credits || 0),
    scrap: state.player.scrap - (cost.scrap || 0),
    inventoryWeapons: state.player.inventoryWeapons.map((w, idx) =>
      idx === invIndex ? upgradedStats : w
    ),
    equippedWeapon:
      state.player.equippedWeapon.id === currentWeapon.id
        ? upgradedStats
        : state.player.equippedWeapon,
  };

  const newState: CyberpunkGameState = {
    ...state,
    player: updatedPlayer,
    stats: {
      ...state.stats,
      overclocksPerformed: state.stats.overclocksPerformed + 1,
    },
  };

  return { success: true, newState };
}

export function canBuyPerk(
  player: CyberpunkPlayer,
  perkId: CyberPerkId
): { canBuy: boolean; reason?: string } {
  if (player.activePerks.includes(perkId)) {
    return { canBuy: false, reason: 'Perk already installed in neural cyberware.' };
  }

  const perk = CYBER_PERKS[perkId];
  if (!perk) {
    return { canBuy: false, reason: 'Perk does not exist.' };
  }

  const cost = perk.cost.credits || 0;
  if (player.credits < cost) {
    return {
      canBuy: false,
      reason: `Insufficient credits (needs ${cost}, have ${player.credits}).`,
    };
  }

  return { canBuy: true };
}

export function buyPerk(
  state: CyberpunkGameState,
  perkId: CyberPerkId
): { success: boolean; newState: CyberpunkGameState; error?: string } {
  const check = canBuyPerk(state.player, perkId);
  if (!check.canBuy) {
    return { success: false, newState: state, error: check.reason };
  }

  const perk = CYBER_PERKS[perkId];
  const cost = perk.cost.credits || 0;

  let newMaxShield = state.player.maxShield;
  let newShield = state.player.shield;
  if (perk.passiveEffect.maxShieldBonus) {
    newMaxShield += perk.passiveEffect.maxShieldBonus;
    newShield += perk.passiveEffect.maxShieldBonus;
  }

  const updatedPlayer: CyberpunkPlayer = {
    ...state.player,
    credits: state.player.credits - cost,
    maxShield: newMaxShield,
    shield: newShield,
    activePerks: [...state.player.activePerks, perkId],
  };

  return {
    success: true,
    newState: {
      ...state,
      player: updatedPlayer,
    },
  };
}

export function switchWeapon(
  state: CyberpunkGameState,
  baseId: WeaponId
): { success: boolean; newState: CyberpunkGameState } {
  const target = state.player.inventoryWeapons.find((w) => w.baseId === baseId);
  if (!target) return { success: false, newState: state };

  return {
    success: true,
    newState: {
      ...state,
      player: {
        ...state.player,
        equippedWeapon: target,
      },
    },
  };
}
