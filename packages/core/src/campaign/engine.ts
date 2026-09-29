import { CAMPAIGN_CATALOG } from './catalog.generated.js';
import type { CampaignAction, CampaignCatalog, CampaignPreview, CampaignReward, CampaignState, CampaignTransition, CampaignVillager, HeroAction, Resources, WorkerRole } from './types.js';
import { ZERO, addResources, canAfford, clamp, resources, subtractResources } from './math.js';
import { draw, weightedIndex } from './random.js';
import { enterCombat, generateWave, resolveEnemyActions, resolveHeroAction, resolveVillageOrder, tickCombatEffects } from './combat.js';

const catalog: CampaignCatalog = CAMPAIGN_CATALOG;
const VERSION = 1 as const;
const clone = <T>(value: T): T => structuredClone(value);
const invalid = (reason: string): CampaignPreview => ({ valid: false, reason, description: reason, timeCost: 0, production: resources(), cost: resources() });
const valid = (description: string, timeCost = 0, cost: Partial<Resources> = {}, production: Partial<Resources> = {}): CampaignPreview => ({ valid: true, description, timeCost, cost: resources(cost), production: resources(production) });
const roleOutput = (state: CampaignState): Resources => {
  const output = resources();
  for (const villager of state.refuge.villagers) {
    if (villager.occupied || villager.role === 'recover') continue;
    if (villager.role === 'timber' || villager.role === 'provisions' || villager.role === 'ward') {
      const resource = villager.role === 'ward' ? 'essence' : villager.role;
      const definition = catalog.villagers.find((entry) => entry.id === villager.id);
      const trait = (definition?.traitEffects ?? []).filter((effect) => effect.role === resource || effect.role === villager.role)
        .reduce((sum, effect) => sum + ((state.turn + 1) % (effect.bonusEvery ?? 1) === 0 ? effect.bonus ?? 0 : 0), 0);
      const upgrade = catalog.upgrades.filter((entry) => state.refuge.buildings[entry.building]?.upgrades.includes(entry.id))
        .reduce((sum, entry) => sum + (typeof entry.effects[`${resource}Output`] === 'number' ? entry.effects[`${resource}Output`] as number : 0), 0);
      const site = catalog.locations.filter((entry) => state.refuge.securedSites.includes(entry.id))
        .reduce((sum, entry) => sum + (entry.siteEffect?.[`${resource}Output`] ?? 0), 0);
      const base = catalog.balance.workerOutput[resource] + trait + upgrade + site + (villager.specialization[villager.role] ?? 0);
      output[resource] += Math.max(0, Math.floor(base * villager.efficiency * (villager.injury > 0 ? 0.5 : 1)));
    }
  }
  if (state.attempt?.modifier === 'ward_interference') output.essence = Math.max(0, output.essence - 1);
  return output;
};
const activeStock = (state: CampaignState): Resources => state.attempt?.resources ?? state.refuge.resources;
const hasCost = (state: CampaignState, cost: Partial<Resources>, includeRecovery = false): boolean => {
  const stock = activeStock(state);
  return canAfford(includeRecovery ? addResources(stock, state.refuge.recovery) : stock, cost);
};
function spend(state: CampaignState, cost: Partial<Resources>, useRecovery = false): void {
  const stock = activeStock(state);
  const next = resources(stock);
  const recovery = state.refuge.recovery;
  for (const key of ['timber', 'provisions', 'essence'] as const) {
    let amount = cost[key] ?? 0;
    if (useRecovery) { const fromKit = Math.min(recovery[key], amount); recovery[key] -= fromKit; amount -= fromKit; }
    next[key] -= amount;
  }
  if (state.attempt) state.attempt.resources = next;
  else state.refuge.resources = next;
}
function addStock(state: CampaignState, gain: Partial<Resources>): void {
  if (state.attempt) state.attempt.resources = addResources(state.attempt.resources, gain);
  else state.refuge.resources = addResources(state.refuge.resources, gain);
}
function newVillager(id: string): CampaignVillager {
  const definition = catalog.villagers.find((entry) => entry.id === id);
  if (!definition) throw new Error(`Unknown villager ${id}`);
  return { id, name: definition.name, role: definition.role, traits: [...definition.traits], efficiency: definition.efficiency, injury: 0, specialization: {} };
}
function currentThreat(state: CampaignState): string {
  const ids = state.attempt?.pendingWaveIds[state.attempt.wave - 1] ?? [];
  const roles = [...new Set(ids.map((id) => catalog.enemies.find((enemy) => enemy.id === id)?.role ?? 'undead'))];
  return roles.length ? roles.join(', ') : 'Undead nearby';
}
function prepareAttempt(state: CampaignState, kind: 'first' | 'generated' | 'boss'): void {
  const first = kind === 'first';
  state.night++;
  state.attempt = { kind, wave: 1, prepRemaining: catalog.balance.preparationTurns, preview: '', objectiveProgress: 0, resources: first ? resources(catalog.balance.starting.resources) : resources(), unbanked: resources(), pendingWaveIds: [], recentEvents: [], unluckyScavenges: 0, orderProvisionsSpent: 0, firstSpellUsed: false };
  if (kind === 'generated') {
    const modifiers = catalog.modifiers.filter((entry) => !entry.unlock || state.flags.includes(entry.unlock));
    if (modifiers.length) {
      const modifier = modifiers[weightedIndex(state, modifiers.map((entry) => entry.weight ?? 1))];
      state.attempt.modifier = modifier.id;
      const damage = modifier.effect?.startingBarricadeDamage;
      if (typeof damage === 'number') state.refuge.buildings.barricade.hp = Math.max(0, state.refuge.buildings.barricade.hp - damage);
    }
    const objectives = catalog.objectives.filter((entry) => !entry.unlock || state.flags.includes(entry.unlock));
    if (objectives.length) state.attempt.objective = objectives[draw(state, objectives.length)].id;
  }
  for (let wave = 1; wave <= 3; wave++) state.attempt.pendingWaveIds.push(generateWave(state, catalog, wave));
  state.attempt.preview = `${currentThreat(state)}${state.attempt.modifier ? ` · ${catalog.modifiers.find((entry) => entry.id === state.attempt?.modifier)?.name}` : ''}`;
  state.combat = null;
  state.expedition = null;
  state.phase = first ? 'opening' : 'preparation';
  if (first) state.refuge.recovery = resources();
  state.hero.hp = Math.max(state.hero.hp, Math.ceil(state.hero.maxHp * 0.7));
  state.hero.mana = state.hero.maxMana;
  state.hero.cooldowns = {};
}

export function createCampaign(seed = (Math.random() * 0x100000000) >>> 0, name = 'Keeper'): CampaignState {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Seed must be a uint32');
  const start = catalog.balance.starting;
  const state: CampaignState = {
    version: VERSION, contentVersion: catalog.contentVersion, phase: 'opening', seed, rngState: seed >>> 0,
    revision: 0, turn: 0, night: 0, nightsWon: 0, chapter: 1,
    hero: { name: name.trim().slice(0, 32) || 'Keeper', level: 1, xp: 0, hp: start.hero.hp, maxHp: start.hero.hp,
      mana: start.hero.mana, maxMana: start.hero.mana, attack: start.hero.attack, spellPower: start.hero.spellPower, resilience: start.hero.resilience ?? 1,
      equipment: { weapon: 'worn_blade', armor: 'patched_coat', focus: 'ward_token' },
      inventory: { ...(start.inventory ?? {}), worn_blade: 1, patched_coat: 1, ward_token: 1 }, consumables: Object.keys(start.inventory ?? {}).slice(0, 2),
      learnedSpells: ['frost', 'lightning'], equippedSpells: ['frost', 'lightning'], talents: [], pendingTalent: false, cooldowns: {}, statuses: [] },
    refuge: { resources: resources(), recovery: resources(), wardHp: start.wardHp, maxWardHp: start.wardHp,
      buildings: Object.fromEntries(catalog.buildings.map((building) => [building.id, { id: building.id, level: building.id === 'barricade' ? 1 : 0, hp: building.id === 'barricade' ? start.barricadeHp : 0, maxHp: building.maxHp, upgrades: [] }])),
      villagers: (start.villagers ?? ['mara', 'tovin']).map(newVillager), research: [], securedSites: [], settlementLevel: 1 },
    attempt: null, combat: null, expedition: null, rewardChoices: [], claimedRewards: [], flags: [], unlockedLocations: [], recentEvents: [], log: ['The ward is failing. Rekindle it before nightfall.']
  };
  prepareAttempt(state, 'first');
  state.night = 1;
  return state;
}

function actionCost(state: CampaignState, action: CampaignAction): Partial<Resources> {
  switch (action.type) {
    case 'prepare': {
      if (action.kind === 'construct') return catalog.buildings.find((entry) => entry.id === action.targetId)?.cost ?? ZERO;
      if (action.kind === 'repair') return { timber: 1 };
      return ZERO;
    }
    case 'selectVillageOrder': return action.order ? { provisions: catalog.balance.villageOrders[action.order.kind].provisions } : ZERO;
    case 'chooseUpgrade': return catalog.upgrades.find((entry) => entry.id === action.upgradeId)?.cost ?? ZERO;
    case 'startResearch': return catalog.research.find((entry) => entry.id === action.researchId)?.cost ?? ZERO;
    case 'craft': return catalog.recipes.find((entry) => entry.id === action.recipeId)?.cost ?? ZERO;
    case 'expeditionChoice': {
      const location = catalog.locations.find((entry) => entry.id === state.expedition?.locationId);
      return location?.steps[state.expedition?.step ?? 0]?.choices.find((entry) => entry.id === action.choiceId)?.cost ?? ZERO;
    }
    case 'chooseEvent': return catalog.events.find((event) => event.id === state.pendingEventId)?.choices.find((entry) => entry.id === action.choiceId)?.cost ?? ZERO;
    default: return ZERO;
  }
}
function checkHeroAction(state: CampaignState, action: HeroAction): string | null {
  if (!state.combat) return 'There is no battle.';
  if (action.kind === 'attack' || (action.kind === 'spell' && action.spellId !== 'arcane_barrier')) {
    if (!state.combat.enemies.some((enemy) => enemy.instanceId === action.targetId && enemy.hp > 0)) return 'Choose a living target.';
  }
  if (action.kind === 'spell') {
    const spell = catalog.spells.find((entry) => entry.id === action.spellId);
    if (!spell || !state.hero.equippedSpells.includes(action.spellId)) return 'That spell is not equipped.';
    const discount = state.hero.talents.includes('efficient_channel') && !state.combat.firstSpellUsed ? 1 : 0;
    if (Math.max(0, spell.manaCost - discount) > state.hero.mana) return 'Not enough mana.';
    if ((state.hero.cooldowns[spell.id] ?? 0) > 0) return 'That spell is cooling down.';
  }
  if (action.kind === 'consumable') {
    const item = catalog.items.find((entry) => entry.id === action.itemId && entry.slot === 'consumable');
    if (!item || !state.hero.consumables.includes(action.itemId) || (state.hero.inventory[action.itemId] ?? 0) <= 0) return 'That consumable is unavailable.';
  }
  return null;
}
export function previewCampaignAction(state: CampaignState, action: CampaignAction): CampaignPreview {
  if (state.version !== VERSION) return invalid('Save version is not supported.');
  const cost = actionCost(state, action);
  switch (action.type) {
    case 'rekindle': return state.phase === 'opening' ? valid('Rekindle the refuge ward.', 1, {}, roleOutput(state)) : invalid('The ward is already burning.');
    case 'assign': {
      if (state.phase !== 'preparation' && state.phase !== 'opening') return invalid('Assignments are fixed during the assault.');
      if (!state.refuge.villagers.some((villager) => villager.id === action.villagerId)) return invalid('Unknown villager.');
      if (!['timber', 'provisions', 'ward', 'repair', 'craft', 'study', 'scout', 'recover', 'construction'].includes(action.role)) return invalid('Unknown work role.');
      return valid('Assign the villager. Production begins on the next committed turn.');
    }
    case 'prepare': {
      if (state.phase !== 'preparation' || !state.attempt || state.attempt.prepRemaining <= 0) return invalid('There is no preparation time left.');
      if (action.kind === 'construct') {
        const building = catalog.buildings.find((entry) => entry.id === action.targetId);
        if (!building) return invalid('Unknown structure.');
        if (state.refuge.buildings[building.id]?.level || state.refuge.buildings[building.id]?.construction) return invalid('That structure is already built or underway.');
        if (!hasCost(state, cost)) return invalid('Construction requires supplies gathered this night.');
      }
      if (action.kind === 'repair' && state.refuge.buildings.barricade.hp >= state.refuge.buildings.barricade.maxHp) return invalid('The barricade is sound.');
      if (!hasCost(state, cost, true)) return invalid('Not enough supplies.');
      return valid(`${action.kind[0].toUpperCase()}${action.kind.slice(1)} for one turn.`, 1, cost, roleOutput(state));
    }
    case 'beginWave': return state.phase === 'preparation' && !!state.attempt ? valid('Begin the assault now. Unused preparation time is forfeited.') : invalid('No assault is ready.');
    case 'selectHeroAction': {
      if (state.phase !== 'combat') return invalid('No battle is active.');
      const reason = checkHeroAction(state, action.action);
      return reason ? invalid(reason) : valid(`Ready: ${action.action.kind}.`);
    }
    case 'selectVillageOrder': {
      if (state.phase !== 'combat') return invalid('No battle is active.');
      if (state.combat?.source === 'expedition') return invalid('Villagers cannot aid an expedition from the refuge.');
      if (!action.order) return valid('No village order.');
      if (!hasCost(state, cost, true)) return invalid('Not enough provisions.');
      return valid(`Ready: ${action.order.kind}.`, 0, cost);
    }
    case 'endTurn': {
      if (state.phase !== 'combat' || !state.combat) return invalid('No battle is active.');
      if (action.expectedRevision !== undefined && action.expectedRevision !== state.revision) return invalid('This turn has already changed.');
      if (action.actionId && action.actionId === state.combat.lastResolvedActionId) return invalid('This turn was already resolved.');
      if (!state.combat.selectedHeroAction) return invalid('Choose a hero action.');
      const reason = checkHeroAction(state, state.combat.selectedHeroAction);
      if (reason) return invalid(reason);
      const order = state.combat.selectedVillageOrder;
      const orderCost = order ? { provisions: catalog.balance.villageOrders[order.kind].provisions } : ZERO;
      if (!hasCost(state, orderCost, true)) return invalid('Not enough provisions for that order.');
      return valid('Commit the combat round.', 1, orderCost, roleOutput(state));
    }
    case 'claimReward': return state.phase === 'rewards' && state.rewardChoices.some((reward) => reward.id === action.rewardId) && !state.claimedRewards.includes(`${state.night}:${action.rewardId}`) ? valid('Claim this reward.') : invalid('That reward cannot be claimed.');
    case 'chooseUpgrade': {
      const upgrade = catalog.upgrades.find((entry) => entry.id === action.upgradeId);
      if (state.phase !== 'refuge' || !upgrade) return invalid('That improvement is unavailable.');
      if (state.refuge.buildings[upgrade.building]?.level === 0 && upgrade.tier !== 1) return invalid('Build the structure first.');
      if (state.refuge.buildings[upgrade.building]?.construction) return invalid('Construction is still underway.');
      if (state.refuge.buildings[upgrade.building]?.upgrades.includes(upgrade.id)) return invalid('Already improved.');
      if (!upgrade.requires.every((id) => state.flags.includes(id) || state.refuge.buildings[upgrade.building]?.upgrades.includes(id))) return invalid('A prerequisite is missing.');
      if (!hasCost(state, cost)) return invalid('Not enough banked resources.');
      return valid(`Permanently improve ${upgrade.building}.`, 0, cost);
    }
    case 'startNight': {
      if (state.phase !== 'refuge' && state.phase !== 'defeat') return invalid('Return to the refuge first.');
      if (state.flags.includes('first_upgrade_due')) return invalid('Choose your first permanent improvement.');
      if (action.boss && !state.flags.includes('boss_unlocked')) return invalid('The grave captain has not been found.');
      return valid(action.boss ? 'Prepare for the grave captain.' : 'Begin another night.');
    }
    case 'equip': {
      const item = catalog.items.find((entry) => entry.id === action.itemId);
      return state.phase === 'refuge' && item?.slot === action.slot && (state.hero.inventory[action.itemId] ?? 0) > 0 ? valid(`Equip ${item.name}.`) : invalid('That equipment is unavailable.');
    }
    case 'setSpells': return state.phase === 'refuge' && action.spellIds.length <= 3 && action.spellIds.every((id) => state.hero.learnedSpells.includes(id)) ? valid('Set your spells.') : invalid('Choose up to three learned spells.');
    case 'setConsumables': return state.phase === 'refuge' && action.itemIds.length <= 2 && action.itemIds.every((id) => (state.hero.inventory[id] ?? 0) > 0) ? valid('Prepare consumables.') : invalid('Choose up to two owned consumables.');
    case 'startExpedition': {
      const location = catalog.locations.find((entry) => entry.id === action.locationId);
      return state.phase === 'refuge' && !!location && state.unlockedLocations.includes(location.id) && !state.flags.includes('first_upgrade_due') ? valid(`Explore ${location.name}.`, location.turns) : invalid('That location is not accessible.');
    }
    case 'expeditionChoice': {
      const location = catalog.locations.find((entry) => entry.id === state.expedition?.locationId);
      const choice = location?.steps[state.expedition?.step ?? 0]?.choices.find((entry) => entry.id === action.choiceId);
      if (state.phase !== 'expedition' || !choice) return invalid('That path is unavailable.');
      if (!hasCost(state, cost)) return invalid('Not enough resources.');
      return valid(choice.label, 1, cost);
    }
    case 'retreat': return state.phase === 'expedition' ? valid('Return with secured supplies.', 1) : invalid('No expedition is active.');
    case 'startResearch': {
      const entry = catalog.research.find((item) => item.id === action.researchId);
      if (state.phase !== 'refuge' || !entry || state.refuge.activeResearch || state.refuge.research.includes(entry.id)) return invalid('Research is unavailable.');
      if (!(entry.requires ?? []).every((id) => state.flags.includes(id) || state.refuge.research.includes(id))) return invalid('A prerequisite is missing.');
      return hasCost(state, cost) ? valid(`Begin ${entry.name}.`, 1, cost) : invalid('Not enough banked resources.');
    }
    case 'craft': {
      const entry = catalog.recipes.find((item) => item.id === action.recipeId);
      if (state.phase !== 'refuge' || !entry || !(entry.requires ?? []).every((id) => state.refuge.research.includes(id) || state.flags.includes(id))) return invalid('Recipe is unavailable.');
      return hasCost(state, cost) ? valid(`Craft ${entry.name}.`, 1, cost) : invalid('Not enough banked resources.');
    }
    case 'chooseTalent': return state.phase === 'refuge' && state.hero.pendingTalent && catalog.talents.some((entry) => entry.id === action.talentId) && !state.hero.talents.includes(action.talentId) ? valid('Learn this talent.') : invalid('Talent is unavailable.');
    case 'chooseEvent': {
      const choice = catalog.events.find((event) => event.id === state.pendingEventId)?.choices.find((entry) => entry.id === action.choiceId);
      return state.phase === 'refuge' && !!choice && hasCost(state, cost) ? valid(choice.label, 0, cost) : invalid('That choice is unavailable.');
    }
  }
}

function worldTurn(state: CampaignState, events: string[], production = true): void {
  const output = production && state.attempt ? roleOutput(state) : null;
  state.turn++;
  if (state.attempt?.prepRemaining && state.phase === 'preparation') state.attempt.prepRemaining--;
  if (output) {
    addStock(state, output);
    events.push(`Workers produced ${output.timber} timber, ${output.provisions} provisions, and ${output.essence} essence.`);
    const warders = state.refuge.villagers.filter((villager) => villager.role === 'ward' && !villager.occupied).length;
    state.refuge.wardHp = clamp(state.refuge.wardHp + warders, 0, state.refuge.maxWardHp);
  }
  for (const building of Object.values(state.refuge.buildings)) {
    if (!building.construction) continue;
    building.construction.remaining--;
    if (building.construction.remaining <= 0) { building.level = 1; building.hp = building.maxHp; delete building.construction; events.push(`${building.id} is complete.`); }
  }
  if (state.refuge.activeResearch) {
    state.refuge.activeResearch.remaining--;
    if (state.refuge.activeResearch.remaining <= 0) {
      const id = state.refuge.activeResearch.id;
      state.refuge.research.push(id);
      for (const flag of catalog.research.find((entry) => entry.id === id)?.unlocks ?? []) if (!state.flags.includes(flag)) state.flags.push(flag);
      delete state.refuge.activeResearch;
      events.push(`Research complete: ${id}.`);
    }
  }
  for (const villager of state.refuge.villagers) {
    if (villager.role === 'recover' && villager.injury > 0) villager.injury = Math.max(0, villager.injury - 1);
    if (villager.occupied) { villager.occupied.remaining--; if (villager.occupied.remaining <= 0) delete villager.occupied; }
    else if ((villager.role === 'timber' || villager.role === 'provisions' || villager.role === 'ward') && state.turn % 5 === 0) {
      villager.specialization[villager.role] = Math.min(2, (villager.specialization[villager.role] ?? 0) + 1);
    }
  }
  if (state.phase === 'preparation' && state.attempt?.prepRemaining === 0) {
    enterCombat(state, catalog, state.attempt.pendingWaveIds[state.attempt.wave - 1], state.attempt.kind === 'boss' ? 'boss' : 'night');
    events.push('The assault begins.');
  }
}

function levelHero(state: CampaignState, xp: number): void {
  state.hero.xp += xp;
  const threshold = state.hero.level * 30;
  if (state.hero.xp >= threshold) {
    state.hero.xp -= threshold;
    state.hero.level++;
    state.hero.maxHp += 4; state.hero.maxMana += 1;
    state.hero.attack += state.hero.level % 2;
    state.hero.spellPower += (state.hero.level + 1) % 2;
    state.hero.hp = state.hero.maxHp; state.hero.mana = state.hero.maxMana;
  }
  if (state.night >= 3 && !state.hero.talents.length) state.hero.pendingTalent = true;
}
function progressMilestones(state: CampaignState): void {
  for (const milestone of catalog.milestones) {
    if (state.flags.includes(milestone.flag)) continue;
    const requirements = milestone.requires;
    const goal = milestone.goal;
    if ((requirements.flags ?? []).every((flag) => state.flags.includes(flag)) &&
      state.refuge.securedSites.filter((id) => (requirements.sites ?? []).includes(id)).length >= (requirements.sites?.length ?? 0) &&
      state.refuge.settlementLevel - 1 >= (requirements.upgrades ?? 0) &&
      state.nightsWon >= (requirements.nights ?? 0) &&
      state.nightsWon >= (goal?.nightsWon ?? 0) &&
      state.refuge.villagers.length >= (goal?.villagersAtLeast ?? 0) &&
      state.refuge.securedSites.length >= (goal?.sitesSecuredAtLeast ?? 0) &&
      (!goal?.cryptClue || state.flags.includes('crypt_clue')) &&
      (!goal?.bossDefeated || state.flags.includes('boss_defeated')) &&
      (!goal?.flag || state.flags.includes(goal.flag))) {
      state.flags.push(milestone.flag);
      for (const unlock of milestone.unlocks ?? []) {
        if (catalog.locations.some((location) => location.id === unlock)) {
          if (!state.unlockedLocations.includes(unlock)) state.unlockedLocations.push(unlock);
        } else if (!state.flags.includes(unlock)) state.flags.push(unlock);
      }
      state.log.push(milestone.description);
    }
  }
  if (state.flags.includes('night_five') && state.flags.includes('crypt_clue') && !state.flags.includes('boss_unlocked')) state.flags.push('boss_unlocked');
  if (state.flags.includes('boss_defeated')) state.chapter = 2;
}
function rewardChoices(state: CampaignState): CampaignReward[] {
  const available = catalog.rewards.filter((reward) => !reward.itemId || (state.hero.inventory[reward.itemId] ?? 0) < 2);
  const chosen: CampaignReward[] = [];
  const useful = available.filter((reward) => reward.kind === 'resources' || reward.kind === 'consumable' || !!reward.resources);
  if (useful.length) chosen.push(clone(useful[weightedIndex(state, useful.map((reward) => reward.weight ?? 1))]));
  while (chosen.length < 3 && available.length > chosen.length) {
    const pool = available.filter((reward) => !chosen.some((entry) => entry.id === reward.id));
    const weights = pool.map((reward) => (reward.weight ?? 1) + (reward.kind === 'consumable' && state.hero.consumables.length === 0 ? 3 : 0) + (reward.kind === 'repair' && state.refuge.buildings.barricade.hp < 10 ? 3 : 0));
    chosen.push(clone(pool[weightedIndex(state, weights)]));
  }
  return chosen;
}
function recover(state: CampaignState, events: string[]): void {
  if (state.expedition) state.refuge.resources = addResources(state.refuge.resources, state.expedition.secured);
  state.phase = 'defeat'; state.combat = null; state.attempt = null; state.expedition = null;
  state.refuge.recovery = resources({ timber: 4, provisions: 4, essence: 2 });
  state.hero.hp = Math.max(1, Math.ceil(state.hero.maxHp / 2)); state.hero.mana = state.hero.maxMana;
  state.refuge.wardHp = Math.max(1, Math.ceil(state.refuge.maxWardHp / 2));
  for (const villager of state.refuge.villagers) if (draw(state, 5) === 0) villager.injury = Math.max(villager.injury, 2);
  events.push('The refuge survives the setback. A recovery kit is ready for the next defense.');
}
function finishExpedition(state: CampaignState, events: string[]): void {
  const expedition = state.expedition;
  if (!expedition) throw new Error('No expedition');
  const location = catalog.locations.find((entry) => entry.id === expedition.locationId)!;
  state.refuge.resources = addResources(state.refuge.resources, addResources(expedition.secured, expedition.unbanked));
  const wasSecured = state.refuge.securedSites.includes(location.id);
  if (location.secureFlag && state.flags.includes(location.secureFlag) && !wasSecured) {
    state.refuge.securedSites.push(location.id);
    state.refuge.resources = addResources(state.refuge.resources, location.rewards ?? ZERO);
  }
  state.expedition = null;
  state.phase = 'refuge';
  levelHero(state, 8);
  progressMilestones(state);
  for (const next of catalog.locations.filter((entry) => entry.unlock && state.flags.includes(entry.unlock))) if (!state.unlockedLocations.includes(next.id)) state.unlockedLocations.push(next.id);
  events.push(wasSecured ? `Returned from ${location.name}.` : `Explored ${location.name}.`);
}
function finishNight(state: CampaignState, events: string[]): void {
  const attempt = state.attempt;
  if (!attempt) throw new Error('No night');
  const objective = catalog.objectives.find((entry) => entry.id === attempt.objective);
  if (objective) {
    const condition = objective.condition ?? {};
    const achieved = (condition.wardHpPercentAtLeast === undefined || state.refuge.wardHp * 100 >= state.refuge.maxWardHp * Number(condition.wardHpPercentAtLeast)) &&
      (condition.buildingDamageAtMost === undefined || (state.refuge.buildings[String(condition.building)]?.maxHp ?? 0) - (state.refuge.buildings[String(condition.building)]?.hp ?? 0) <= Number(condition.buildingDamageAtMost)) &&
      (condition.eliteDefeatedBeforeRound === undefined || (attempt.eliteDefeatedRound ?? Infinity) < Number(condition.eliteDefeatedBeforeRound)) &&
      (condition.orderProvisionsAtMost === undefined || attempt.orderProvisionsSpent <= Number(condition.orderProvisionsAtMost)) &&
      (condition.retreatsAtMost === undefined || Number(condition.retreatsAtMost) >= 0);
    if (achieved) { state.refuge.resources = addResources(state.refuge.resources, objective.reward ?? ZERO); events.push(`Objective complete: ${objective.name}.`); }
  }
  state.refuge.resources = addResources(state.refuge.resources, attempt.resources);
  state.refuge.resources = addResources(state.refuge.resources, attempt.unbanked);
  state.refuge.recovery = resources();
  state.combat = null; state.attempt = null;
  state.nightsWon++;
  if (attempt.kind === 'first' && !state.flags.includes('first_night')) { state.flags.push('first_night', 'first_upgrade_due'); state.unlockedLocations.push('ruined_farm', 'fallen_watchpost', 'timber_camp'); }
  if (attempt.kind === 'boss') { state.flags.push('boss_defeated'); state.phase = 'chapter_complete'; progressMilestones(state); events.push('The grave captain falls. A route toward Oakhaven opens.'); return; }
  levelHero(state, 12 + state.night * 2);
  state.rewardChoices = rewardChoices(state);
  state.phase = 'rewards';
  events.push('Dawn arrives. The refuge holds. Choose a reward.');
  progressMilestones(state);
}
function chooseEvent(state: CampaignState): void {
  const pool = catalog.events.filter((event) => !state.recentEvents.slice(-2).includes(event.id));
  if (pool.length && draw(state, 3) === 0) {
    state.pendingEventId = pool[draw(state, pool.length)].id;
    state.recentEvents.push(state.pendingEventId);
    state.recentEvents = state.recentEvents.slice(-5);
  }
}

export function resolveCampaignAction(input: CampaignState, action: CampaignAction): CampaignTransition {
  const preview = previewCampaignAction(input, action);
  if (!preview.valid) throw new Error(preview.reason ?? 'Action is unavailable.');
  const state = clone(input);
  const events: string[] = [];
  switch (action.type) {
    case 'rekindle': state.refuge.wardHp = state.refuge.maxWardHp; worldTurn(state, events); state.phase = 'preparation'; events.push('The ward glows again. Prepare the refuge.'); break;
    case 'assign': { const villager = state.refuge.villagers.find((entry) => entry.id === action.villagerId)!; villager.role = action.role; events.push(`${villager.name} now tends ${action.role}.`); break; }
    case 'prepare': {
      if (action.kind === 'construct') {
        const definition = catalog.buildings.find((entry) => entry.id === action.targetId)!;
        spend(state, definition.cost);
        state.refuge.buildings[definition.id].construction = { remaining: definition.turns, paid: resources(definition.cost) };
        events.push(`Construction began: ${definition.name}.`);
      } else if (action.kind === 'repair') {
        spend(state, { timber: 1 }, true);
        const building = state.refuge.buildings.barricade;
        building.hp = clamp(building.hp + catalog.balance.actions.repairAmount, 0, building.maxHp);
        events.push('The barricade is repaired.');
      } else if (action.kind === 'rest') { state.hero.hp = clamp(state.hero.hp + catalog.balance.actions.restHeal, 0, state.hero.maxHp); state.hero.mana = clamp(state.hero.mana + 3, 0, state.hero.maxMana); events.push('The keeper rests.'); }
      else {
        const eventRoll = draw(state, 5);
        const gain = resources(catalog.balance.actions.scavenge);
        if (state.attempt?.modifier === 'rich_scavenging') gain.timber += 2;
        if (eventRoll === 0 && state.attempt!.unluckyScavenges === 0) { state.attempt!.unluckyScavenges++; events.push('The path is picked clean.'); }
        else { if (eventRoll === 4) gain.essence++; addStock(state, gain); state.attempt!.unluckyScavenges = 0; events.push('Supplies recovered.'); }
      }
      worldTurn(state, events); break;
    }
    case 'beginWave': {
      state.attempt!.prepRemaining = 0;
      enterCombat(state, catalog, state.attempt!.pendingWaveIds[state.attempt!.wave - 1], state.attempt!.kind === 'boss' ? 'boss' : 'night');
      events.push('The assault begins early.'); break;
    }
    case 'selectHeroAction': state.combat!.selectedHeroAction = action.action; break;
    case 'selectVillageOrder': state.combat!.selectedVillageOrder = action.order; break;
    case 'endTurn': {
      const combat = state.combat!;
      const heroAction = combat.selectedHeroAction!;
      const outcome = resolveHeroAction(state, catalog, heroAction, events);
      if (outcome === 'retreat') {
        worldTurn(state, events, false);
        if (combat.source === 'expedition') { state.refuge.resources = addResources(state.refuge.resources, state.expedition!.secured); state.expedition = null; state.combat = null; state.phase = 'refuge'; events.push('The party returns with secured supplies.'); }
        else recover(state, events);
        break;
      }
      const order = combat.selectedVillageOrder;
      if (order) {
        const spent = catalog.balance.villageOrders[order.kind].provisions;
        spend(state, { provisions: spent }, true);
        if (state.attempt) state.attempt.orderProvisionsSpent += spent;
      }
      resolveVillageOrder(state, catalog, order, events);
      if (combat.enemies.some((enemy) => enemy.hp > 0)) resolveEnemyActions(state, catalog, events);
      tickCombatEffects(state, catalog, events);
      if (state.attempt && combat.enemies.some((enemy) => enemy.elite && enemy.hp <= 0)) state.attempt.eliteDefeatedRound ??= combat.round;
      worldTurn(state, events);
      if (state.hero.hp <= 0 || state.refuge.wardHp <= 0) { recover(state, events); break; }
      combat.selectedHeroAction = null; combat.selectedVillageOrder = null; combat.lastResolvedActionId = action.actionId;
      if (combat.enemies.every((enemy) => enemy.hp <= 0)) {
        levelHero(state, combat.enemies.length * 4);
        if (combat.source === 'expedition') {
          state.phase = 'expedition'; state.combat = null; state.expedition!.step = state.expedition!.combatReturnStep ?? state.expedition!.step + 1;
          const location = catalog.locations.find((entry) => entry.id === state.expedition!.locationId)!;
          if (state.expedition!.step >= location.steps.length) finishExpedition(state, events);
          else events.push('The expedition path is clear.');
        }
        else if (state.attempt!.wave < 3) { state.attempt!.wave++; state.attempt!.prepRemaining = catalog.balance.interludeTurns; state.attempt!.preview = currentThreat(state); state.phase = 'preparation'; state.combat = null; events.push('A brief lull allows preparation.'); }
        else finishNight(state, events);
      }
      break;
    }
    case 'claimReward': {
      const reward = state.rewardChoices.find((entry) => entry.id === action.rewardId)!;
      if (reward.resources) state.refuge.resources = addResources(state.refuge.resources, reward.resources);
      if (reward.itemId) state.hero.inventory[reward.itemId] = (state.hero.inventory[reward.itemId] ?? 0) + (reward.quantity ?? 1);
      if (reward.wardHeal) state.refuge.wardHp = clamp(state.refuge.wardHp + reward.wardHeal, 0, state.refuge.maxWardHp);
      if (reward.barricadeHeal) { const wall = state.refuge.buildings.barricade; wall.hp = clamp(wall.hp + reward.barricadeHeal, 0, wall.maxHp); }
      if (reward.unlock && !state.flags.includes(reward.unlock)) state.flags.push(reward.unlock);
      if (reward.improvementId) state.flags.push(reward.improvementId);
      state.claimedRewards.push(`${state.night}:${reward.id}`);
      state.rewardChoices = []; state.phase = 'refuge'; chooseEvent(state);
      events.push(`${reward.name} claimed.`); break;
    }
    case 'chooseUpgrade': {
      const upgrade = catalog.upgrades.find((entry) => entry.id === action.upgradeId)!;
      spend(state, upgrade.cost);
      const building = state.refuge.buildings[upgrade.building];
      if (building.level === 0) { building.level = 1; building.hp = building.maxHp; }
      building.upgrades.push(upgrade.id); building.level++;
      const hpGain = typeof upgrade.effects.maxHp === 'number' ? upgrade.effects.maxHp : 0;
      if (hpGain) { building.maxHp += hpGain; building.hp += hpGain; }
      if (upgrade.building === 'ward' && hpGain) { state.refuge.maxWardHp += hpGain; state.refuge.wardHp += hpGain; }
      if (upgrade.unlockEffect && !state.flags.includes(upgrade.unlockEffect)) state.flags.push(upgrade.unlockEffect);
      state.refuge.settlementLevel++;
      state.flags = state.flags.filter((flag) => flag !== 'first_upgrade_due');
      progressMilestones(state);
      events.push(`${upgrade.id} improves the refuge.`); break;
    }
    case 'startNight': prepareAttempt(state, action.boss ? 'boss' : 'generated'); events.push('The refuge prepares for another night.'); break;
    case 'equip': state.hero.equipment[action.slot] = action.itemId; break;
    case 'setSpells': state.hero.equippedSpells = [...new Set(action.spellIds)]; break;
    case 'setConsumables': state.hero.consumables = [...action.itemIds]; break;
    case 'startExpedition': state.expedition = { locationId: action.locationId, step: 0, turns: 0, secured: resources(), unbanked: resources(), choicesMade: [] }; state.phase = 'expedition'; worldTurn(state, events, false); break;
    case 'expeditionChoice': {
      const expedition = state.expedition!;
      const location = catalog.locations.find((entry) => entry.id === expedition.locationId)!;
      const choice = location.steps[expedition.step].choices.find((entry) => entry.id === action.choiceId)!;
      spend(state, choice.cost ?? ZERO);
      if (choice.reward) expedition.unbanked = addResources(expedition.unbanked, choice.reward);
      if (choice.reward?.villager && !state.refuge.villagers.some((entry) => entry.id === choice.reward?.villager)) state.refuge.villagers.push(newVillager(choice.reward.villager));
      if (choice.reward?.item) state.hero.inventory[choice.reward.item] = (state.hero.inventory[choice.reward.item] ?? 0) + 1;
      if (choice.rewardItem) state.hero.inventory[choice.rewardItem] = (state.hero.inventory[choice.rewardItem] ?? 0) + 1;
      if (choice.flag && !state.flags.includes(choice.flag)) state.flags.push(choice.flag);
      if (choice.recruit && !state.refuge.villagers.some((entry) => entry.id === choice.recruit)) state.refuge.villagers.push(newVillager(choice.recruit));
      if (choice.secure) { expedition.secured = addResources(expedition.secured, expedition.unbanked); expedition.unbanked = resources(); }
      expedition.choicesMade.push(choice.id); expedition.turns++;
      worldTurn(state, events, false);
      if (choice.risk > draw(state, 10)) { state.hero.hp = Math.max(1, state.hero.hp - choice.risk); events.push('The expedition suffers a hazard.'); }
      if (choice.combat?.length) { expedition.combatReturnStep = expedition.step + 1; enterCombat(state, catalog, choice.combat, 'expedition'); }
      else expedition.step++;
      if (state.phase === 'expedition' && expedition.step >= location.steps.length) finishExpedition(state, events);
      break;
    }
    case 'retreat': state.refuge.resources = addResources(state.refuge.resources, state.expedition!.secured); state.expedition = null; state.phase = 'refuge'; worldTurn(state, events, false); events.push('The party returns with secured supplies.'); break;
    case 'startResearch': { const entry = catalog.research.find((item) => item.id === action.researchId)!; spend(state, entry.cost); state.refuge.activeResearch = { id: entry.id, remaining: entry.turns, paid: resources(entry.cost) }; worldTurn(state, events, false); break; }
    case 'craft': { const entry = catalog.recipes.find((item) => item.id === action.recipeId)!; spend(state, entry.cost); state.hero.inventory[entry.outputItemId] = (state.hero.inventory[entry.outputItemId] ?? 0) + entry.quantity; worldTurn(state, events, false); break; }
    case 'chooseTalent': state.hero.talents.push(action.talentId); state.hero.pendingTalent = false; break;
    case 'chooseEvent': {
      const choice = catalog.events.find((event) => event.id === state.pendingEventId)!.choices.find((entry) => entry.id === action.choiceId)!;
      spend(state, choice.cost ?? ZERO);
      if (choice.reward) state.refuge.resources = addResources(state.refuge.resources, choice.reward);
      if (choice.flag && !state.flags.includes(choice.flag)) state.flags.push(choice.flag);
      if (choice.recruit && !state.refuge.villagers.some((entry) => entry.id === choice.recruit)) state.refuge.villagers.push(newVillager(choice.recruit));
      delete state.pendingEventId; progressMilestones(state); break;
    }
  }
  state.revision++;
  state.log.push(...events);
  state.log = state.log.slice(-100);
  return { state, events };
}

export function validateCampaignSave(raw: unknown): CampaignState {
  if (!raw || typeof raw !== 'object') throw new Error('Campaign save is malformed.');
  const state = raw as CampaignState;
  if (state.version !== VERSION || state.contentVersion !== catalog.contentVersion) throw new Error('Campaign save version is unsupported.');
  if (!Number.isInteger(state.seed) || !Number.isInteger(state.rngState) || !Number.isInteger(state.revision) || !Number.isInteger(state.turn)) throw new Error('Campaign clock or random state is invalid.');
  if (!['opening', 'preparation', 'combat', 'rewards', 'refuge', 'expedition', 'defeat', 'chapter_complete'].includes(state.phase)) throw new Error('Campaign phase is invalid.');
  if (!state.hero || !state.refuge || !Array.isArray(state.refuge.villagers) || !state.refuge.buildings) throw new Error('Hero or refuge data is missing.');
  for (const value of [state.hero.hp, state.hero.mana, state.refuge.wardHp, ...Object.values(state.refuge.resources ?? {}), ...Object.values(state.refuge.recovery ?? {})]) if (!Number.isFinite(value) || value < 0) throw new Error('A campaign resource is invalid.');
  for (const id of Object.keys(state.refuge.buildings)) if (!catalog.buildings.some((entry) => entry.id === id)) throw new Error(`Unknown building in save: ${id}`);
  for (const id of Object.keys(state.hero.inventory ?? {})) if (!catalog.items.some((entry) => entry.id === id)) throw new Error(`Unknown item in save: ${id}`);
  for (const id of state.hero.learnedSpells ?? []) if (!catalog.spells.some((entry) => entry.id === id)) throw new Error(`Unknown spell in save: ${id}`);
  if (state.phase === 'combat' && (!state.combat || !state.combat.enemies.length)) throw new Error('Combat data is missing.');
  if ((state.phase === 'preparation' || state.phase === 'opening') && !state.attempt) throw new Error('Night data is missing.');
  if (state.phase === 'expedition' && !state.expedition) throw new Error('Expedition data is missing.');
  if (state.expedition && !catalog.locations.some((entry) => entry.id === state.expedition!.locationId)) throw new Error('Unknown expedition site.');
  return clone(state);
}
