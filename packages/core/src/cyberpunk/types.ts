export type SectorId =
  | 'platform_04'
  | 'sector_01_power'
  | 'sector_02_chop_shop'
  | 'sector_03_ripper_clinic'
  | 'sector_04_mag_junction'
  | 'sector_05_deep_vault';

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface SpatialBounds {
  min: Vector3D;
  max: Vector3D;
}

export type BlastDoorId =
  | 'door_power_substation'
  | 'door_chop_shop'
  | 'door_ripper_clinic'
  | 'door_mag_junction'
  | 'door_deep_vault';

export type ComradeRole = 'idle' | 'scrapper' | 'netrunner' | 'ripperdoc' | 'enforcer';

export type ComradeStatus = 'healthy' | 'injured' | 'captured';

export type WeaponId = 'scrap_pistol' | 'auto_shotgun' | 'kinetic_smg' | 'heavy_rail_rifle';

export type OverclockTier = 0 | 1 | 2 | 3;

export type ElementalEffect = 'none' | 'shock' | 'incendiary' | 'plasma' | 'pierce';

export type CyberPerkId =
  | 'titan_subdermal'
  | 'overclock_stim'
  | 'smart_link'
  | 'trauma_ghost'
  | 'emp_capacitance';

export interface ResourceCost {
  credits?: number;
  scrap?: number;
  decryptKeys?: number;
  energyCells?: number;
}

export interface TerminalState {
  id: string;
  name: string;
  type: 'power' | 'chop_shop' | 'clinic' | 'scrapper_station' | 'vault_mainframe';
  operational: boolean;
  repairCost: ResourceCost;
  description: string;
}

export interface BlastDoor {
  id: BlastDoorId;
  name: string;
  code: string;
  fromSector: SectorId;
  toSector: SectorId;
  unlocked: boolean;
  cost: ResourceCost;
  description: string;
  integrity: number;
  maxIntegrity: number;
}

export interface Sector {
  id: SectorId;
  code: string;
  name: string;
  subtitle: string;
  unlocked: boolean;
  description: string;
  connectedDoors: BlastDoorId[];
  terminals: TerminalState[];
  maxComrades: number;
  hazardLevel: number;
  ambientPowerSignature: number;
}

export interface Comrade {
  id: string;
  name: string;
  handle: string;
  role: ComradeRole;
  assignedSector: SectorId | null;
  status: ComradeStatus;
  efficiency: number;
  specialty: string;
  quote: string;
}

export interface WeaponStats {
  id: string;
  baseId: WeaponId;
  name: string;
  code: string;
  tier: OverclockTier;
  damage: number;
  fireRate: number; // shots per trigger / attack tick
  magazineSize: number;
  currentAmmo: number;
  reloadTimeMs: number;
  elementalEffect: ElementalEffect;
  neonColor: string;
  overclockCost: ResourceCost | null;
  description: string;
}

export interface CyberPerk {
  id: CyberPerkId;
  name: string;
  code: string;
  cost: ResourceCost;
  description: string;
  passiveEffect: {
    maxShieldBonus?: number;
    speedBonus?: number;
    critChanceBonus?: number;
    revivePassive?: boolean;
    empBonus?: number;
  };
}

export interface CombatEnemy {
  id: string;
  name: string;
  code: string;
  type: 'security_droid' | 'shock_hound' | 'corp_enforcer' | 'heavy_mech' | 'stealth_infiltrator';
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  damage: number;
  armor: number;
  loot: {
    credits: number;
    scrap: number;
    keycardChance: number;
  };
}

export interface BreachDamageReport {
  id: string;
  timestamp: number;
  doorId: BlastDoorId;
  creditsLooted: number;
  scrapLooted: number;
  terminalsDamaged: string[];
  injuredComrades: string[];
  repelled: boolean;
  summary: string;
}

export interface RaidState {
  threatLevel: number; // 0 - 100
  powerSignature: number;
  countdownSec: number;
  isActive: boolean;
  targetDoorId: BlastDoorId | null;
  activeSquad: CombatEnemy[];
  lastReport: BreachDamageReport | null;
}

export interface CyberpunkPlayer {
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  credits: number;
  scrap: number;
  energyCells: number;
  decryptKeys: number;
  medStims: number;
  equippedWeapon: WeaponStats;
  inventoryWeapons: WeaponStats[];
  activePerks: CyberPerkId[];
  isDowned: boolean;
  revivalCount: number;
}

export interface CyberpunkGameState {
  player: CyberpunkPlayer;
  sectors: Record<SectorId, Sector>;
  doors: Record<BlastDoorId, BlastDoor>;
  comrades: Comrade[];
  raidState: RaidState;
  stats: {
    droidsEliminated: number;
    creditsMined: number;
    scrapHarvested: number;
    doorsUnlocked: number;
    overclocksPerformed: number;
    raidsRepelled: number;
    revivals: number;
    timeAliveSec: number;
  };
  lastSavedAt: number;
}
