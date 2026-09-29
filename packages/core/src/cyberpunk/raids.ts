import type {
  BlastDoorId,
  BreachDamageReport,
  CyberpunkGameState,
  RaidState,
  SectorId,
} from './types.js';
import { generateWaveEnemies } from './combatEngine.js';
import { createInitialSectors, createInitialDoors } from './sectors.js';
import { createInitialComrades } from './comrades.js';
import { createInitialPlayerState } from './weapons.js';

export function createInitialRaidState(): RaidState {
  return {
    threatLevel: 10,
    powerSignature: 5,
    countdownSec: 120,
    isActive: false,
    targetDoorId: null,
    activeSquad: [],
    lastReport: null,
  };
}

export function calculateTotalPowerSignature(state: CyberpunkGameState): number {
  return Object.values(state.sectors)
    .filter((s) => s.unlocked)
    .reduce((sum, s) => sum + s.ambientPowerSignature, 0);
}

export function updateRaidThreatTick(
  state: CyberpunkGameState,
  deltaSec: number
): { newState: CyberpunkGameState; raidTriggered: boolean } {
  const totalPower = calculateTotalPowerSignature(state);
  let raidState = { ...state.raidState, powerSignature: totalPower };

  if (raidState.isActive) {
    return { newState: { ...state, raidState }, raidTriggered: false };
  }

  // Threat rises proportionally to total power signature
  // Base 0.15% per second + 0.02% per power unit
  const threatDelta = (0.15 + totalPower * 0.02) * deltaSec;
  const newThreat = Math.min(100, raidState.threatLevel + threatDelta);
  const newCountdown = Math.max(0, raidState.countdownSec - deltaSec);

  let raidTriggered = false;

  if (newThreat >= 100 || newCountdown <= 0) {
    raidTriggered = true;
    const unlockedDoors = Object.values(state.doors).filter((d) => d.unlocked);
    const targetDoor =
      unlockedDoors.length > 0
        ? unlockedDoors[Math.floor(Math.random() * unlockedDoors.length)].id
        : ('door_power_substation' as BlastDoorId);

    const unlockedSectorCount = Object.values(state.sectors).filter((s) => s.unlocked).length;
    const currentWave = Math.floor(state.stats.raidsRepelled + 1);
    const enemies = generateWaveEnemies(currentWave, unlockedSectorCount);

    raidState = {
      ...raidState,
      threatLevel: 100,
      countdownSec: 0,
      isActive: true,
      targetDoorId: targetDoor,
      activeSquad: enemies,
    };
  } else {
    raidState = {
      ...raidState,
      threatLevel: newThreat,
      countdownSec: newCountdown,
    };
  }

  return {
    newState: {
      ...state,
      raidState,
    },
    raidTriggered,
  };
}

export function processBreachDamageTick(
  state: CyberpunkGameState,
  deltaSec: number
): { newState: CyberpunkGameState; breachOccurred: boolean; report?: BreachDamageReport } {
  if (!state.raidState.isActive || !state.raidState.targetDoorId) {
    return { newState: state, breachOccurred: false };
  }

  const doorId = state.raidState.targetDoorId;
  const door = state.doors[doorId];
  if (!door) return { newState: state, breachOccurred: false };

  // Calculate enforcer defense mitigation
  const enforcers = state.comrades.filter(
    (c) => c.status === 'healthy' && c.role === 'enforcer'
  ).length;
  const defenseMultiplier = enforcers > 0 ? Math.max(0.3, 1.0 - enforcers * 0.25) : 1.0;

  // Breach damage: squad size * 2 dmg/sec * defense multiplier
  const damagePerSec = state.raidState.activeSquad.length * 2.5 * defenseMultiplier;
  const appliedDamage = damagePerSec * deltaSec;
  const newIntegrity = Math.max(0, door.integrity - appliedDamage);

  const updatedDoors = {
    ...state.doors,
    [doorId]: {
      ...door,
      integrity: newIntegrity,
    },
  };

  // If door integrity hits 0, execute full breach consequences
  if (newIntegrity <= 0) {
    const targetSectorId: SectorId = door.toSector;
    const targetSector = state.sectors[targetSectorId];

    // Steal resources (15% credits, 20% scrap)
    const creditsLooted = Math.floor(state.player.credits * 0.15);
    const scrapLooted = Math.floor(state.player.scrap * 0.2);

    // Disable operational terminals in the sector
    const damagedTerminals: string[] = [];
    const updatedTerminals = (targetSector?.terminals || []).map((t) => {
      if (t.operational) {
        damagedTerminals.push(t.name);
        return { ...t, operational: false };
      }
      return t;
    });

    const updatedSectors = {
      ...state.sectors,
      [targetSectorId]: {
        ...targetSector,
        terminals: updatedTerminals,
      },
    };

    // Injure comrades assigned to that sector
    const injuredComrades: string[] = [];
    const updatedComrades = state.comrades.map((c) => {
      if (c.assignedSector === targetSectorId && c.status === 'healthy') {
        injuredComrades.push(c.name);
        return { ...c, status: 'injured' as const };
      }
      return c;
    });

    const report: BreachDamageReport = {
      id: `breach_${Date.now()}`,
      timestamp: Date.now(),
      doorId,
      creditsLooted,
      scrapLooted,
      terminalsDamaged: damagedTerminals,
      injuredComrades,
      repelled: false,
      summary: `Breach at ${door.name}! Sector ${targetSector?.name || targetSectorId} overwhelmed. ${creditsLooted} Credits & ${scrapLooted} Scrap stolen.`,
    };

    const newState: CyberpunkGameState = {
      ...state,
      doors: updatedDoors,
      sectors: updatedSectors,
      comrades: updatedComrades,
      player: {
        ...state.player,
        credits: Math.max(0, state.player.credits - creditsLooted),
        scrap: Math.max(0, state.player.scrap - scrapLooted),
      },
      raidState: {
        ...state.raidState,
        threatLevel: 0,
        countdownSec: 150,
        isActive: false,
        targetDoorId: null,
        activeSquad: [],
        lastReport: report,
      },
    };

    return { newState, breachOccurred: true, report };
  }

  return {
    newState: {
      ...state,
      doors: updatedDoors,
    },
    breachOccurred: false,
  };
}

export function repelRaid(
  state: CyberpunkGameState
): { newState: CyberpunkGameState; report: BreachDamageReport } {
  const bountyCredits = 500 + state.stats.raidsRepelled * 150;
  const bountyScrap = 25 + state.stats.raidsRepelled * 10;
  const keycardsWon = 1;

  const report: BreachDamageReport = {
    id: `repel_${Date.now()}`,
    timestamp: Date.now(),
    doorId: state.raidState.targetDoorId || ('door_power_substation' as BlastDoorId),
    creditsLooted: 0,
    scrapLooted: 0,
    terminalsDamaged: [],
    injuredComrades: [],
    repelled: true,
    summary: `Corporate Strike Repelled! Awarded ${bountyCredits} Credits, ${bountyScrap} Tech Scrap, and ${keycardsWon} Decrypt Keycard.`,
  };

  const newState: CyberpunkGameState = {
    ...state,
    player: {
      ...state.player,
      credits: state.player.credits + bountyCredits,
      scrap: state.player.scrap + bountyScrap,
      decryptKeys: state.player.decryptKeys + keycardsWon,
    },
    raidState: {
      ...state.raidState,
      threatLevel: 0,
      countdownSec: 180,
      isActive: false,
      targetDoorId: null,
      activeSquad: [],
      lastReport: report,
    },
    stats: {
      ...state.stats,
      raidsRepelled: state.stats.raidsRepelled + 1,
    },
  };

  return { newState, report };
}

export function revivePlayerAtClinic(
  state: CyberpunkGameState
): { newState: CyberpunkGameState; usedMedStim: boolean } {
  const hasStim = state.player.medStims > 0;

  let newCredits = state.player.credits;
  let newStims = state.player.medStims;
  let newHp = 100;
  let newShield = state.player.maxShield;

  if (hasStim) {
    newStims -= 1;
    newHp = state.player.maxHp;
  } else {
    // 10% ambulance / emergency resuscitation cost
    newCredits = Math.floor(state.player.credits * 0.9);
    newHp = Math.round(state.player.maxHp * 0.5);
    newShield = Math.round(state.player.maxShield * 0.5);
  }

  const newState: CyberpunkGameState = {
    ...state,
    player: {
      ...state.player,
      credits: newCredits,
      medStims: newStims,
      hp: newHp,
      shield: newShield,
      isDowned: false,
      revivalCount: state.player.revivalCount + 1,
    },
    stats: {
      ...state.stats,
      revivals: state.stats.revivals + 1,
    },
  };

  return { newState, usedMedStim: hasStim };
}

export function createInitialCyberpunkGameState(): CyberpunkGameState {
  return {
    player: createInitialPlayerState(),
    sectors: createInitialSectors(),
    doors: createInitialDoors(),
    comrades: createInitialComrades(),
    raidState: createInitialRaidState(),
    stats: {
      droidsEliminated: 0,
      creditsMined: 0,
      scrapHarvested: 0,
      doorsUnlocked: 0,
      overclocksPerformed: 0,
      raidsRepelled: 0,
      revivals: 0,
      timeAliveSec: 0,
      currentWave: 1,
    },
    lastSavedAt: Date.now(),
  };
}
