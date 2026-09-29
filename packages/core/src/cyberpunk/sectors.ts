import type {
  BlastDoor,
  BlastDoorId,
  CyberpunkGameState,
  Sector,
  SectorId,
  TerminalState,
} from './types.js';

export function createInitialSectors(): Record<SectorId, Sector> {
  return {
    platform_04: {
      id: 'platform_04',
      code: 'SEC-00',
      name: 'Platform 04 Safehouse',
      subtitle: 'Decommissioned Metro Underbelly',
      unlocked: true,
      description:
        'A fortified subway platform powered by a sputtering diesel-fusion dynamo. Damp neon reflections, rusted iron girders, and your primary defense hub.',
      connectedDoors: ['door_power_substation', 'door_chop_shop'],
      terminals: [
        {
          id: 'term_hub_generator',
          name: 'Main Dynamo Generator',
          type: 'power',
          operational: true,
          repairCost: { scrap: 10 },
          description: 'Supplies low-voltage emergency wattage to Platform 04 life support and command monitors.',
        },
        {
          id: 'term_hub_scrappers',
          name: 'Scavenger Sorting Bench',
          type: 'scrapper_station',
          operational: true,
          repairCost: { scrap: 15 },
          description: 'Bench for stripping harvested corporate drone chassis and alloy plates into raw tech scrap.',
        },
      ],
      maxComrades: 4,
      hazardLevel: 1,
      ambientPowerSignature: 5,
    },
    sector_01_power: {
      id: 'sector_01_power',
      code: 'SEC-01',
      name: 'Power Sub-Station Sigma',
      subtitle: 'High-Voltage Transformer Hall',
      unlocked: false,
      description:
        'A humming cavern filled with massive arc transformers and humming coolant piping. Restoring grid power illuminates perimeter corridors.',
      connectedDoors: ['door_power_substation', 'door_ripper_clinic'],
      terminals: [
        {
          id: 'term_substation_grid',
          name: 'Grid Circuit Breaker',
          type: 'power',
          operational: true,
          repairCost: { scrap: 30, credits: 150 },
          description: 'Regulates high-voltage current to secondary sectors and automated perimeter defense turrets.',
        },
      ],
      maxComrades: 2,
      hazardLevel: 2,
      ambientPowerSignature: 15,
    },
    sector_02_chop_shop: {
      id: 'sector_02_chop_shop',
      code: 'SEC-02',
      name: 'Abandoned Chop-Shop',
      subtitle: 'Illegal Munitions & Overclock Lathe',
      unlocked: false,
      description:
        'A clandestine weapon workshop littered with spent plasma casings, tungsten lathes, and high-frequency soldering rigs.',
      connectedDoors: ['door_chop_shop', 'door_mag_junction'],
      terminals: [
        {
          id: 'term_overclock_bench',
          name: 'Chop-Shop Weapon Lathe',
          type: 'chop_shop',
          operational: true,
          repairCost: { scrap: 40, credits: 250 },
          description: 'Overclocks kinetic ballistic weapons into high-yield plasma and electrified prototypes.',
        },
      ],
      maxComrades: 2,
      hazardLevel: 2,
      ambientPowerSignature: 12,
    },
    sector_03_ripper_clinic: {
      id: 'sector_03_ripper_clinic',
      code: 'SEC-03',
      name: 'Black-Market Ripper Clinic',
      subtitle: 'Dr. Vane’s Cyber-Surgical Pods',
      unlocked: false,
      description:
        'A sterilizer-scented medical subterranean vault housing cryo-stasis tubes, neuro-graft needles, and combat-stim centrifuges.',
      connectedDoors: ['door_ripper_clinic'],
      terminals: [
        {
          id: 'term_cyber_perk_pod',
          name: 'Bio-Synthetic Perk Terminal',
          type: 'clinic',
          operational: true,
          repairCost: { scrap: 50, credits: 300 },
          description: 'Synthesizes neural stims and grafts permanent sub-dermal cyberware enhancements.',
        },
      ],
      maxComrades: 3,
      hazardLevel: 3,
      ambientPowerSignature: 18,
    },
    sector_04_mag_junction: {
      id: 'sector_04_mag_junction',
      code: 'SEC-04',
      name: 'Derelict Mag-Rail Junction',
      subtitle: 'Collapsed Transit Switchyard',
      unlocked: false,
      description:
        'Massive derailed magnetic train cars piled high with heavy lithium battery packs, severed fiber cables, and industrial alloys.',
      connectedDoors: ['door_mag_junction', 'door_deep_vault'],
      terminals: [
        {
          id: 'term_mag_crane',
          name: 'Heavy Scrap Salvage Rig',
          type: 'scrapper_station',
          operational: true,
          repairCost: { scrap: 60, credits: 400 },
          description: 'Industrial magnetic crane designed to process heavy bulk alloy scrap.',
        },
      ],
      maxComrades: 4,
      hazardLevel: 4,
      ambientPowerSignature: 22,
    },
    sector_05_deep_vault: {
      id: 'sector_05_deep_vault',
      code: 'SEC-05',
      name: 'Megacorp Research Vault',
      subtitle: 'Reinforced Apex Black-Site',
      unlocked: false,
      description:
        'An obsidian-walled black-budget corporate research laboratory with shielded quantum mainframes and prototype defense drones.',
      connectedDoors: ['door_deep_vault'],
      terminals: [
        {
          id: 'term_vault_mainframe',
          name: 'Quantum Data Core',
          type: 'vault_mainframe',
          operational: true,
          repairCost: { scrap: 100, credits: 1000 },
          description: 'Decodes top-tier corporate military blueprints and mines massive crypto bounties.',
        },
      ],
      maxComrades: 3,
      hazardLevel: 5,
      ambientPowerSignature: 35,
    },
  };
}

export function createInitialDoors(): Record<BlastDoorId, BlastDoor> {
  return {
    door_power_substation: {
      id: 'door_power_substation',
      name: 'Sigma Sub-Station Pressure Hatch',
      code: 'GATE-01',
      fromSector: 'platform_04',
      toSector: 'sector_01_power',
      unlocked: false,
      cost: { credits: 350 },
      description: 'Heavy hydraulic blast door locking off the humming high-voltage power conduits.',
      integrity: 100,
      maxIntegrity: 100,
    },
    door_chop_shop: {
      id: 'door_chop_shop',
      name: 'Maintenance Tunnel Chop-Shop Door',
      code: 'GATE-02',
      fromSector: 'platform_04',
      toSector: 'sector_02_chop_shop',
      unlocked: false,
      cost: { credits: 750, scrap: 15 },
      description: 'Reinforced sliding steel barricade securing the underground illegal munitions shop.',
      integrity: 100,
      maxIntegrity: 100,
    },
    door_ripper_clinic: {
      id: 'door_ripper_clinic',
      name: 'Airlock Clinic Bio-Seal',
      code: 'GATE-03',
      fromSector: 'sector_01_power',
      toSector: 'sector_03_ripper_clinic',
      unlocked: false,
      cost: { credits: 1200, decryptKeys: 1 },
      description: 'Bio-hazard security door encrypted with military cipher keys.',
      integrity: 120,
      maxIntegrity: 120,
    },
    door_mag_junction: {
      id: 'door_mag_junction',
      name: 'Mag-Rail Heavy Bulkhead',
      code: 'GATE-04',
      fromSector: 'sector_02_chop_shop',
      toSector: 'sector_04_mag_junction',
      unlocked: false,
      cost: { credits: 2000, scrap: 35 },
      description: 'Pneumatic bulkhead sealing off the collapsed subway rail switchyard.',
      integrity: 150,
      maxIntegrity: 150,
    },
    door_deep_vault: {
      id: 'door_deep_vault',
      name: 'Apex Black-Site Armored Blast Gate',
      code: 'GATE-05',
      fromSector: 'sector_04_mag_junction',
      toSector: 'sector_05_deep_vault',
      unlocked: false,
      cost: { credits: 4000, decryptKeys: 2 },
      description: 'Ultra-dense carbon-fiber reinforced blast door guarding the corporate black-site.',
      integrity: 200,
      maxIntegrity: 200,
    },
  };
}

export function canUnlockDoor(
  state: CyberpunkGameState,
  doorId: BlastDoorId
): { canUnlock: boolean; reason?: string } {
  const door = state.doors[doorId];
  if (!door) return { canUnlock: false, reason: 'Door does not exist.' };
  if (door.unlocked) return { canUnlock: false, reason: 'Door is already unlocked.' };

  const fromSector = state.sectors[door.fromSector];
  const toSector = state.sectors[door.toSector];
  if (!fromSector || !toSector) return { canUnlock: false, reason: 'Adjacent sector not found.' };

  // At least one adjacent sector must already be unlocked (spatial graph connectivity)
  if (!fromSector.unlocked && !toSector.unlocked) {
    return { canUnlock: false, reason: `Requires access to adjacent sector ${fromSector.name}.` };
  }

  const { credits = 0, scrap = 0, decryptKeys = 0 } = door.cost;
  if (state.player.credits < credits) {
    return { canUnlock: false, reason: `Insufficient Credits (needs ${credits}, have ${state.player.credits}).` };
  }
  if (state.player.scrap < scrap) {
    return { canUnlock: false, reason: `Insufficient Tech Scrap (needs ${scrap}, have ${state.player.scrap}).` };
  }
  if (state.player.decryptKeys < decryptKeys) {
    return { canUnlock: false, reason: `Requires ${decryptKeys} Decrypt Keycard(s).` };
  }

  return { canUnlock: true };
}

export function unlockDoor(
  state: CyberpunkGameState,
  doorId: BlastDoorId
): { success: boolean; newState: CyberpunkGameState; error?: string } {
  const check = canUnlockDoor(state, doorId);
  if (!check.canUnlock) {
    return { success: false, newState: state, error: check.reason };
  }

  const door = state.doors[doorId];
  const cost = door.cost;

  // Deduct resources
  const updatedPlayer = {
    ...state.player,
    credits: state.player.credits - (cost.credits || 0),
    scrap: state.player.scrap - (cost.scrap || 0),
    decryptKeys: state.player.decryptKeys - (cost.decryptKeys || 0),
  };

  // Unlock door
  const updatedDoors = {
    ...state.doors,
    [doorId]: {
      ...door,
      unlocked: true,
      integrity: door.maxIntegrity,
    },
  };

  // Unlock adjacent sector that was previously locked
  const updatedSectors = { ...state.sectors };
  if (!updatedSectors[door.toSector].unlocked) {
    updatedSectors[door.toSector] = {
      ...updatedSectors[door.toSector],
      unlocked: true,
    };
  }
  if (!updatedSectors[door.fromSector].unlocked) {
    updatedSectors[door.fromSector] = {
      ...updatedSectors[door.fromSector],
      unlocked: true,
    };
  }

  const newState: CyberpunkGameState = {
    ...state,
    player: updatedPlayer,
    doors: updatedDoors,
    sectors: updatedSectors,
    stats: {
      ...state.stats,
      doorsUnlocked: state.stats.doorsUnlocked + 1,
    },
  };

  return { success: true, newState };
}

export function repairDoor(
  state: CyberpunkGameState,
  doorId: BlastDoorId,
  scrapToInvest: number
): { success: boolean; newState: CyberpunkGameState; error?: string } {
  const door = state.doors[doorId];
  if (!door) return { success: false, newState: state, error: 'Door not found.' };
  if (door.integrity >= door.maxIntegrity) {
    return { success: false, newState: state, error: 'Door is already at maximum integrity.' };
  }
  if (scrapToInvest <= 0 || state.player.scrap < scrapToInvest) {
    return { success: false, newState: state, error: 'Not enough tech scrap.' };
  }

  // 1 Scrap repairs 5 points of door integrity
  const maxNeeded = Math.ceil((door.maxIntegrity - door.integrity) / 5);
  const actualScrap = Math.min(scrapToInvest, maxNeeded);
  const repairedAmount = actualScrap * 5;
  const newIntegrity = Math.min(door.maxIntegrity, door.integrity + repairedAmount);

  const newState: CyberpunkGameState = {
    ...state,
    player: {
      ...state.player,
      scrap: state.player.scrap - actualScrap,
    },
    doors: {
      ...state.doors,
      [doorId]: {
        ...door,
        integrity: newIntegrity,
      },
    },
  };

  return { success: true, newState };
}

export function repairTerminal(
  state: CyberpunkGameState,
  sectorId: SectorId,
  terminalId: string
): { success: boolean; newState: CyberpunkGameState; error?: string } {
  const sector = state.sectors[sectorId];
  if (!sector) return { success: false, newState: state, error: 'Sector not found.' };

  const termIndex = sector.terminals.findIndex((t) => t.id === terminalId);
  if (termIndex === -1) return { success: false, newState: state, error: 'Terminal not found.' };

  const term = sector.terminals[termIndex];
  if (term.operational) return { success: false, newState: state, error: 'Terminal is already operational.' };

  const { scrap = 0, credits = 0 } = term.repairCost;
  if (state.player.scrap < scrap || state.player.credits < credits) {
    return { success: false, newState: state, error: 'Insufficient scrap or credits for terminal repairs.' };
  }

  const updatedTerminals = [...sector.terminals];
  updatedTerminals[termIndex] = {
    ...term,
    operational: true,
  };

  const newState: CyberpunkGameState = {
    ...state,
    player: {
      ...state.player,
      scrap: state.player.scrap - scrap,
      credits: state.player.credits - credits,
    },
    sectors: {
      ...state.sectors,
      [sectorId]: {
        ...sector,
        terminals: updatedTerminals,
      },
    },
  };

  return { success: true, newState };
}
