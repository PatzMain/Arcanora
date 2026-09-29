import type {
  Comrade,
  ComradeRole,
  CyberpunkGameState,
  SectorId,
} from './types.js';

export function createInitialComrades(): Comrade[] {
  return [
    {
      id: 'comrade_jax',
      name: 'Jax Vance',
      handle: 'Sparks',
      role: 'scrapper',
      assignedSector: 'platform_04',
      status: 'healthy',
      efficiency: 1.0,
      specialty: 'Jury-Rigged Dynamo Harvester (+25% scrap speed)',
      quote: 'If it hums, sparks, or leaks coolant, I can tear it down for alloy.',
    },
  ];
}

export const RESCUE_CANDIDATES: Record<SectorId, Comrade> = {
  platform_04: {
    id: 'comrade_jax',
    name: 'Jax Vance',
    handle: 'Sparks',
    role: 'scrapper',
    assignedSector: 'platform_04',
    status: 'healthy',
    efficiency: 1.0,
    specialty: 'Jury-Rigged Dynamo Harvester',
    quote: 'If it hums, sparks, or leaks coolant, I can tear it down for alloy.',
  },
  sector_01_power: {
    id: 'comrade_echo',
    name: 'Echo Liu',
    handle: 'Zero-Trace',
    role: 'netrunner',
    assignedSector: 'sector_01_power',
    status: 'healthy',
    efficiency: 1.2,
    specialty: 'Quantum Siphon (+30% crypto yields, decrypt key finder)',
    quote: 'Corporate firewalls are just polite suggestions written in binary.',
  },
  sector_02_chop_shop: {
    id: 'comrade_kane',
    name: 'Marcus Kane',
    handle: 'Ironclad',
    role: 'enforcer',
    assignedSector: 'sector_02_chop_shop',
    status: 'healthy',
    efficiency: 1.3,
    specialty: 'Titan Barricade (Halves blast door breach damage)',
    quote: 'Corporate droids are made of metal. Metal bends when I hit it.',
  },
  sector_03_ripper_clinic: {
    id: 'comrade_vane',
    name: 'Dr. Evelyn Vane',
    handle: 'Doc Needle',
    role: 'ripperdoc',
    assignedSector: 'sector_03_ripper_clinic',
    status: 'healthy',
    efficiency: 1.25,
    specialty: 'Adrenaline Bio-Synthesizer (Crafts trauma med-stims)',
    quote: 'Hold still. The neural graft only stings if you have an active pulse.',
  },
  sector_04_mag_junction: {
    id: 'comrade_fang',
    name: 'Ren Fang',
    handle: 'Scrap-Rat',
    role: 'scrapper',
    assignedSector: 'sector_04_mag_junction',
    status: 'healthy',
    efficiency: 1.4,
    specialty: 'Industrial Mag-Stripper (+50% scrap from mag-trains)',
    quote: 'You see junk, I see three hundred rounds of kinetic ammunition.',
  },
  sector_05_deep_vault: {
    id: 'comrade_nyx',
    name: 'Cipher Nyx',
    handle: 'Ghost-Core',
    role: 'netrunner',
    assignedSector: 'sector_05_deep_vault',
    status: 'healthy',
    efficiency: 1.5,
    specialty: 'Apex Cyber-Warfare (Automated EMP defense ping)',
    quote: 'I cracked Arasaka before breakfast; this vault mainframe is child’s play.',
  },
};

export function assignComradeRole(
  state: CyberpunkGameState,
  comradeId: string,
  newRole: ComradeRole,
  newSectorId: SectorId | null
): { success: boolean; newState: CyberpunkGameState; error?: string } {
  const index = state.comrades.findIndex((c) => c.id === comradeId);
  if (index === -1) return { success: false, newState: state, error: 'Comrade not found.' };

  const comrade = state.comrades[index];

  if (comrade.status === 'injured') {
    return { success: false, newState: state, error: 'Injured comrades cannot work until treated with Med-Stim.' };
  }

  if (newSectorId) {
    const sector = state.sectors[newSectorId];
    if (!sector || !sector.unlocked) {
      return { success: false, newState: state, error: 'Cannot assign comrade to a locked sector.' };
    }
    const currentInSector = state.comrades.filter(
      (c) => c.assignedSector === newSectorId && c.id !== comradeId
    ).length;
    if (currentInSector >= sector.maxComrades) {
      return { success: false, newState: state, error: `Sector is at maximum comrade capacity (${sector.maxComrades}).` };
    }
  }

  const updatedComrade: Comrade = {
    ...comrade,
    role: newRole,
    assignedSector: newSectorId,
  };

  const updatedComrades = [...state.comrades];
  updatedComrades[index] = updatedComrade;

  return {
    success: true,
    newState: {
      ...state,
      comrades: updatedComrades,
    },
  };
}

export function healComrade(
  state: CyberpunkGameState,
  comradeId: string
): { success: boolean; newState: CyberpunkGameState; error?: string } {
  const index = state.comrades.findIndex((c) => c.id === comradeId);
  if (index === -1) return { success: false, newState: state, error: 'Comrade not found.' };

  const comrade = state.comrades[index];
  if (comrade.status !== 'injured') {
    return { success: false, newState: state, error: 'Comrade is not injured.' };
  }

  if (state.player.medStims < 1) {
    return { success: false, newState: state, error: 'No Med-Stims available. Synthesize one at the Ripper Clinic.' };
  }

  const updatedComrade: Comrade = {
    ...comrade,
    status: 'healthy',
  };

  const updatedComrades = [...state.comrades];
  updatedComrades[index] = updatedComrade;

  return {
    success: true,
    newState: {
      ...state,
      player: {
        ...state.player,
        medStims: state.player.medStims - 1,
      },
      comrades: updatedComrades,
    },
  };
}

export interface TickProductionSummary {
  creditsEarned: number;
  scrapEarned: number;
  medStimsCrafted: number;
  decryptKeysFound: number;
  shieldRestored: number;
  enforcersGuarding: number;
}

export function processComradeTick(
  state: CyberpunkGameState,
  deltaSec: number
): { newState: CyberpunkGameState; summary: TickProductionSummary } {
  let creditsDelta = 0;
  let scrapDelta = 0;
  let medStimsDelta = 0;
  let decryptKeysDelta = 0;
  let shieldRestoreDelta = 0;
  let enforcersGuarding = 0;

  for (const comrade of state.comrades) {
    if (comrade.status !== 'healthy' || comrade.role === 'idle') continue;

    const sector = comrade.assignedSector ? state.sectors[comrade.assignedSector] : null;
    const hasWorkingTerminal =
      sector && sector.terminals.some((t) => t.operational);
    const terminalMultiplier = hasWorkingTerminal ? 1.0 : 0.5;

    switch (comrade.role) {
      case 'scrapper': {
        // Base 0.5 scrap / sec * efficiency * sector bonus
        const sectorBonus = comrade.assignedSector === 'sector_04_mag_junction' ? 1.5 : 1.0;
        const generated = 0.5 * comrade.efficiency * sectorBonus * terminalMultiplier * deltaSec;
        scrapDelta += generated;
        break;
      }
      case 'netrunner': {
        // Base 5 credits / sec * efficiency * sector bonus
        const sectorBonus = comrade.assignedSector === 'sector_05_deep_vault' ? 2.0 : 1.0;
        const generated = 5.0 * comrade.efficiency * sectorBonus * terminalMultiplier * deltaSec;
        creditsDelta += generated;

        // Decrypt key rare find chance (approx 1% per 10s tick)
        const roll = Math.random();
        if (roll < 0.001 * deltaSec * comrade.efficiency) {
          decryptKeysDelta += 1;
        }
        break;
      }
      case 'ripperdoc': {
        // Synthesizes 1 med stim every ~30s
        const stimChance = 0.033 * comrade.efficiency * terminalMultiplier * deltaSec;
        if (Math.random() < stimChance) {
          medStimsDelta += 1;
        }
        // Regenerates player shield: 2 shield / sec
        shieldRestoreDelta += 2.0 * comrade.efficiency * deltaSec;
        break;
      }
      case 'enforcer': {
        enforcersGuarding += 1;
        break;
      }
    }
  }

  const intCredits = Math.floor(creditsDelta);
  const intScrap = Math.floor(scrapDelta);

  const updatedPlayer = {
    ...state.player,
    credits: state.player.credits + intCredits,
    scrap: state.player.scrap + intScrap,
    medStims: state.player.medStims + medStimsDelta,
    decryptKeys: state.player.decryptKeys + decryptKeysDelta,
    shield: Math.min(state.player.maxShield, state.player.shield + Math.floor(shieldRestoreDelta)),
  };

  const newState: CyberpunkGameState = {
    ...state,
    player: updatedPlayer,
    stats: {
      ...state.stats,
      creditsMined: state.stats.creditsMined + intCredits,
      scrapHarvested: state.stats.scrapHarvested + intScrap,
      timeAliveSec: state.stats.timeAliveSec + deltaSec,
    },
  };

  return {
    newState,
    summary: {
      creditsEarned: intCredits,
      scrapEarned: intScrap,
      medStimsCrafted: medStimsDelta,
      decryptKeysFound: decryptKeysDelta,
      shieldRestored: Math.floor(shieldRestoreDelta),
      enforcersGuarding,
    },
  };
}

export function rescueComradeForSector(
  state: CyberpunkGameState,
  sectorId: SectorId
): { success: boolean; newState: CyberpunkGameState; comrade?: Comrade } {
  const candidate = RESCUE_CANDIDATES[sectorId];
  if (!candidate) return { success: false, newState: state };

  const alreadyRescued = state.comrades.some((c) => c.id === candidate.id);
  if (alreadyRescued) return { success: false, newState: state };

  const newComrades = [...state.comrades, { ...candidate }];

  return {
    success: true,
    newState: {
      ...state,
      comrades: newComrades,
    },
    comrade: candidate,
  };
}
