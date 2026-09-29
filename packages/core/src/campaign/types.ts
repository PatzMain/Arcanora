export type Resource = 'timber' | 'provisions' | 'essence';
export type Resources = Record<Resource, number>;
export type CampaignPhase = 'opening' | 'preparation' | 'combat' | 'rewards' | 'refuge' | 'expedition' | 'defeat' | 'chapter_complete';
export type WorkerRole = 'timber' | 'provisions' | 'ward' | 'repair' | 'craft' | 'study' | 'scout' | 'recover' | 'construction';
export type EquipmentSlot = 'weapon' | 'armor' | 'focus';
export type StatusKind = 'chill' | 'burn' | 'barrier' | 'curse' | 'warded';

export interface CampaignStatus { kind: StatusKind; turns: number; strength: number }
export interface CampaignVillager {
  id: string; name: string; role: WorkerRole; traits: string[]; efficiency: number;
  injury: number; specialization: Partial<Record<WorkerRole, number>>;
  occupied?: { kind: 'construction' | 'research' | 'recover'; id: string; remaining: number };
}
export interface CampaignBuilding {
  id: string; level: number; hp: number; maxHp: number; upgrades: string[];
  construction?: { remaining: number; paid: Resources };
}
export interface CampaignHero {
  name: string; level: number; xp: number; hp: number; maxHp: number; mana: number; maxMana: number;
  attack: number; spellPower: number; resilience: number;
  equipment: Partial<Record<EquipmentSlot, string>>; inventory: Record<string, number>;
  consumables: string[]; learnedSpells: string[]; equippedSpells: string[];
  talents: string[]; pendingTalent: boolean; cooldowns: Record<string, number>;
  statuses: CampaignStatus[];
}
export interface CampaignRefuge {
  resources: Resources; recovery: Resources; wardHp: number; maxWardHp: number;
  buildings: Record<string, CampaignBuilding>; villagers: CampaignVillager[];
  research: string[]; activeResearch?: { id: string; remaining: number; paid: Resources };
  securedSites: string[]; settlementLevel: number;
}
export interface EnemyIntention { kind: string; target: 'hero' | 'ward' | 'barricade' | 'ally'; power: number; label: string }
export interface CampaignEnemy {
  id: string; instanceId: string; name: string; role: string; hp: number; maxHp: number;
  attack: number; armor: number; elite: boolean; statuses: CampaignStatus[];
  intention: EnemyIntention; lastHeavy: boolean; phase?: number;
}
export type HeroAction =
  | { kind: 'attack'; targetId: string }
  | { kind: 'guard' }
  | { kind: 'spell'; spellId: string; targetId: string }
  | { kind: 'consumable'; itemId: string; targetId?: string }
  | { kind: 'retreat' };
export type VillageOrder = { kind: 'reinforce' | 'support' };
export interface GroupCombatState {
  source: 'night' | 'expedition' | 'boss'; round: number; enemies: CampaignEnemy[];
  selectedHeroAction: HeroAction | null; selectedVillageOrder: VillageOrder | null;
  guarded: boolean; firstSpellUsed: boolean; lastResolvedActionId?: string; log: string[];
}
export interface CampaignAttempt {
  kind: 'first' | 'generated' | 'boss'; wave: number; prepRemaining: number;
  preview: string; modifier?: string; objective?: string; objectiveProgress: number;
  resources: Resources; unbanked: Resources; pendingWaveIds: string[][]; recentEvents: string[];
  unluckyScavenges: number; orderProvisionsSpent: number; eliteDefeatedRound?: number; firstSpellUsed: boolean;
}
export interface CampaignExpedition {
  locationId: string; step: number; turns: number; secured: Resources; unbanked: Resources;
  choicesMade: string[]; combatReturnStep?: number;
}
export interface CampaignReward { id: string; name: string; description: string; kind: string; resources?: Partial<Resources>; itemId?: string; improvementId?: string; quantity?: number; wardHeal?: number; barricadeHeal?: number; immediate?: boolean; unlock?: string }
export interface CampaignState {
  version: 1; contentVersion: string; phase: CampaignPhase; seed: number; rngState: number;
  revision: number; turn: number; night: number; nightsWon: number; chapter: number;
  hero: CampaignHero; refuge: CampaignRefuge; attempt: CampaignAttempt | null;
  combat: GroupCombatState | null; expedition: CampaignExpedition | null;
  rewardChoices: CampaignReward[]; claimedRewards: string[];
  flags: string[]; unlockedLocations: string[]; recentEvents: string[];
  pendingEventId?: string; log: string[];
}
export type CampaignAction =
  | { type: 'rekindle' }
  | { type: 'assign'; villagerId: string; role: WorkerRole }
  | { type: 'prepare'; kind: 'scavenge' | 'rest' | 'repair' | 'construct'; targetId?: string }
  | { type: 'beginWave' }
  | { type: 'selectHeroAction'; action: HeroAction }
  | { type: 'selectVillageOrder'; order: VillageOrder | null }
  | { type: 'endTurn'; expectedRevision?: number; actionId?: string }
  | { type: 'claimReward'; rewardId: string }
  | { type: 'chooseUpgrade'; upgradeId: string }
  | { type: 'startNight'; boss?: boolean }
  | { type: 'equip'; itemId: string; slot: EquipmentSlot }
  | { type: 'setSpells'; spellIds: string[] }
  | { type: 'setConsumables'; itemIds: string[] }
  | { type: 'startExpedition'; locationId: string }
  | { type: 'expeditionChoice'; choiceId: string }
  | { type: 'retreat' }
  | { type: 'startResearch'; researchId: string }
  | { type: 'craft'; recipeId: string }
  | { type: 'chooseTalent'; talentId: string }
  | { type: 'chooseEvent'; choiceId: string };
export interface CampaignPreview {
  valid: boolean; reason?: string; timeCost: number; production: Resources;
  cost: Resources; description: string;
}
export interface CampaignTransition { state: CampaignState; events: string[] }

export interface CampaignCatalog {
  contentVersion: string;
  balance: {
    starting: { hero: { hp: number; mana: number; attack: number; spellPower: number; resilience?: number }; resources: Resources; wardHp: number; barricadeHp: number; villagers?: string[]; inventory?: Record<string, number> };
    preparationTurns: number; interludeTurns: number; waveBudgets: number[];
    workerOutput: Resources;
    actions: { scavenge: Resources; restHeal: number; repairAmount: number };
    villageOrders: { reinforce: { provisions: number; repair: number }; support: { provisions: number; heal: number } };
  };
  enemies: Array<{ id: string; name: string; role: string; hp: number; attack: number; armor: number; threat: number; target: EnemyIntention['target']; affinity?: string; intentModes?: string[]; unlock?: string; weight?: number; heavyCooldown?: number; eliteEffect?: string; summons?: string; retaliation?: number; resistances?: Record<string, number>; vulnerabilities?: Record<string, number>; phases?: Array<{ atHpPercent: number; intent: string; target?: EnemyIntention['target']; summons?: string }>; description?: string }>;
  spells: Array<{ id: string; name: string; element: string; manaCost: number; cooldown: number; power: number; status?: StatusKind; statusDuration?: number; statusPower?: number; bonusAgainst?: { status: string; power: number }; unlock?: string; description?: string }>;
  buildings: Array<{ id: string; name: string; cost: Resources; turns: number; maxHp: number; upgrades: string[] }>;
  upgrades: Array<{ id: string; name?: string; description?: string; building: string; branch: string; tier: number; cost: Resources; requires: string[]; effects: Record<string, number | string>; unlockEffect?: string }>;
  items: Array<{ id: string; name: string; slot: EquipmentSlot | 'consumable'; bonus?: Record<string, number>; effect?: string; power?: number; cost?: Resources; unlock?: string; rarity?: string }>;
  villagers: Array<{ id: string; name: string; role: WorkerRole; traits: string[]; efficiency: number; traitEffects?: Array<{ id: string; role: WorkerRole | 'essence'; bonusEvery?: number; bonus?: number }>; description?: string; unlock?: string }>;
  locations: Array<{ id: string; name: string; risk: number; turns: number; unlock?: string; threat?: string; rewards?: Partial<Resources>; siteEffect?: Record<string, number>; secureFlag?: string; steps: Array<{ id: string; text: string; choices: Array<{ id: string; label: string; risk: number; cost?: Partial<Resources>; reward?: Partial<Resources> & { villager?: string; item?: string }; rewardItem?: string; combat?: string[]; flag?: string; secure?: boolean; recruit?: string }> }> }>;
  rewards: Array<CampaignReward & { weight?: number }>;
  research: Array<{ id: string; name: string; cost: Resources; turns: number; requires?: string[]; unlocks: string[] }>;
  recipes: Array<{ id: string; name: string; cost: Resources; outputItemId: string; quantity: number; requires?: string[] }>;
  talents: Array<{ id: string; name: string; description: string; unlock?: string; direction?: string; effects: Record<string, number> }>;
  events: Array<{ id: string; text: string; unlock?: string; weight?: number; choices: Array<{ id: string; label: string; cost?: Partial<Resources>; reward?: Partial<Resources>; rewardItem?: string; flag?: string; recruit?: string; risk?: number; combat?: string[]; effect?: Record<string, number | string> }> }>;
  milestones: Array<{ id: string; description: string; requires: { flags?: string[]; nights?: number; sites?: string[]; upgrades?: number }; flag: string; goal?: { nightsWon?: number; villagersAtLeast?: number; sitesSecuredAtLeast?: number; cryptClue?: boolean; bossDefeated?: string; flag?: string }; unlocks?: string[]; story?: string }>;
  modifiers: Array<{ id: string; name: string; description: string; unlock?: string; weight?: number; effect?: Record<string, number | boolean> }>;
  objectives: Array<{ id: string; name: string; description: string; kind: string; target?: number; reward?: Partial<Resources>; unlock?: string; condition?: Record<string, number | string | boolean> }>;
  encounters: Array<{ id: string; enemyIds: string[]; budget: number; unlock?: string }>;
}
