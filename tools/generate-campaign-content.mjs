import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = join(root, 'data/campaign/manifest.json');
const outputPath = join(root, 'packages/core/src/campaign/catalog.generated.ts');
const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
const errors = [];
const collections = ['enemies', 'spells', 'buildings', 'upgrades', 'roles', 'villagers', 'items', 'talents', 'locations', 'events', 'research', 'recipes', 'rewards', 'modifiers', 'objectives', 'milestones'];
const byCollection = Object.fromEntries(collections.map((key) => [key, new Map()]));
const allIds = new Map();
const resources = ['timber', 'provisions', 'essence'];
const resourceObject = (value = {}) => Object.fromEntries(resources.map((key) => [key, value[key] ?? 0]));
const resourceSubset = (value = {}) => Object.fromEntries(resources.filter((key) => value[key] !== undefined).map((key) => [key, value[key]]));
const numeric = (value = {}) => Object.fromEntries(Object.entries(value).filter(([, item]) => typeof item === 'number'));
const reference = (collection, id, where) => {
  if (!byCollection[collection].has(id)) errors.push(`${where}: missing ${collection} '${id}'`);
};
const knownFlags = new Set(['start']);

for (const collection of collections) {
  if (!Array.isArray(source[collection])) errors.push(`${collection} must be an array`);
  for (const entity of source[collection] ?? []) {
    if (typeof entity.id !== 'string' || !entity.id) { errors.push(`${collection}: missing id`); continue; }
    if (byCollection[collection].has(entity.id)) errors.push(`${collection}: duplicate id ${entity.id}`);
    if (allIds.has(entity.id)) errors.push(`${entity.id}: duplicate global id in ${allIds.get(entity.id)} and ${collection}`);
    byCollection[collection].set(entity.id, entity);
    allIds.set(entity.id, collection);
  }
}
for (const milestone of source.milestones) {
  knownFlags.add(milestone.id);
  for (const id of milestone.unlocks ?? []) knownFlags.add(id);
}
for (const id of source.balance.starting.villagers ?? []) reference('villagers', id, 'starting.villagers');
for (const id of Object.keys(source.balance.starting.inventory ?? {})) reference('items', id, 'starting.inventory');
for (const id of Object.values(source.balance.starting.equipment ?? {})) reference('items', id, 'starting.equipment');
for (const id of source.balance.starting.spells ?? []) reference('spells', id, 'starting.spells');
for (const location of source.locations) if (location.secureFlag) knownFlags.add(location.secureFlag);
for (const event of source.events) for (const choice of event.choices ?? []) if (choice.flag) knownFlags.add(choice.flag);
for (const location of source.locations) for (const step of location.steps ?? []) for (const choice of step.choices ?? []) if (choice.flag) knownFlags.add(choice.flag);
knownFlags.add('chapter_boss_defeated');
const checkUnlock = (entity, where) => {
  if (entity.unlock && !knownFlags.has(entity.unlock) && !byCollection.research.has(entity.unlock)) errors.push(`${where}: unreachable unlock '${entity.unlock}'`);
};
const checkCost = (value, where) => {
  for (const [key, amount] of Object.entries(value ?? {})) {
    if (!resources.includes(key) || !Number.isSafeInteger(amount) || amount < 0) errors.push(`${where}: invalid cost ${key}=${amount}`);
  }
};
const checkReward = (reward, where) => {
  if (!reward) return;
  if (reward.item) reference('items', reward.item, where);
  if (reward.villager) reference('villagers', reward.villager, where);
  for (const [key, amount] of Object.entries(reward)) if (resources.includes(key) && (!Number.isSafeInteger(amount) || amount < 0)) errors.push(`${where}: invalid reward ${key}`);
};
for (const entity of Object.values(byCollection).flatMap((map) => [...map.values()])) checkUnlock(entity, entity.id);
for (const enemy of source.enemies) {
  if (enemy.summons) reference('enemies', enemy.summons, enemy.id);
  for (const phase of enemy.phases ?? []) if (phase.summons) reference('enemies', phase.summons, enemy.id);
  for (const status of Object.keys(enemy.resistances ?? {})) if (!['chill', 'burn', 'barrier', 'curse', 'warded'].includes(status)) errors.push(`${enemy.id}: unsupported resistance ${status}`);
  for (const status of Object.keys(enemy.vulnerabilities ?? {})) if (!['chill', 'burn', 'barrier', 'curse', 'warded'].includes(status)) errors.push(`${enemy.id}: unsupported vulnerability ${status}`);
  if (enemy.hp <= 0 || enemy.attack < 0 || enemy.threat <= 0 || enemy.armor < 0) errors.push(`${enemy.id}: invalid combat values`);
}
for (const spell of source.spells) {
  if (spell.status && !['chill', 'burn', 'barrier', 'curse', 'warded'].includes(spell.status.id)) errors.push(`${spell.id}: unsupported status ${spell.status.id}`);
  if (spell.bonusAgainst && !['chill', 'burn', 'barrier', 'curse', 'warded'].includes(spell.bonusAgainst.status)) errors.push(`${spell.id}: unsupported status combo ${spell.bonusAgainst.status}`);
  if (spell.manaCost < 0 || spell.cooldown < 0 || spell.power < 0) errors.push(`${spell.id}: invalid spell values`);
}
for (const building of source.buildings) {
  checkCost(building.cost, building.id);
  for (const id of building.upgrades) reference('upgrades', id, building.id);
}
for (const upgrade of source.upgrades) {
  reference('buildings', upgrade.building, upgrade.id);
  checkCost(upgrade.cost, upgrade.id);
  for (const id of upgrade.requires) reference('upgrades', id, upgrade.id);
  for (const key of Object.keys(upgrade.effects)) if (key.endsWith('Unlock')) {
    const ref = upgrade.effects[key];
    if (typeof ref === 'string' && !allIds.has(ref)) errors.push(`${upgrade.id}: invalid effect reference '${ref}'`);
  }
}
for (const villager of source.villagers) {
  reference('roles', villager.role, villager.id);
  for (const trait of villager.traits) reference('roles', trait.role, `${villager.id}.${trait.id}`);
}
for (const location of source.locations) {
  const seenSteps = new Set();
  for (const step of location.steps) for (const choice of step.choices) {
    if (seenSteps.has(`${step.id}.${choice.id}`)) errors.push(`${location.id}: duplicate choice ${step.id}.${choice.id}`);
    seenSteps.add(`${step.id}.${choice.id}`);
    checkCost(choice.cost, `${location.id}.${choice.id}`);
    checkReward(choice.reward, `${location.id}.${choice.id}`);
    for (const id of choice.combat ?? []) reference('enemies', id, `${location.id}.${choice.id}`);
  }
}
for (const event of source.events) for (const choice of event.choices) {
  checkCost(choice.cost, `${event.id}.${choice.id}`);
  checkReward(choice.reward, `${event.id}.${choice.id}`);
  for (const id of choice.combat ?? []) reference('enemies', id, `${event.id}.${choice.id}`);
}
for (const event of source.events) if (new Set(event.choices.map((choice) => choice.id)).size !== event.choices.length) errors.push(`${event.id}: duplicate choice ID`);
for (const entry of source.research) {
  reference('buildings', entry.facility, entry.id);
  checkCost(entry.cost, entry.id);
  for (const id of entry.requires) if (!byCollection.upgrades.has(id) && !byCollection.research.has(id)) errors.push(`${entry.id}: unknown prerequisite ${id}`);
  for (const id of entry.unlocks) if (!allIds.has(id)) errors.push(`${entry.id}: unknown unlock ${id}`);
}
for (const recipe of source.recipes) { checkCost(recipe.cost, recipe.id); reference('items', recipe.output.item, recipe.id); }
for (const reward of source.rewards) checkReward(reward.grant, reward.id);
for (const reward of source.rewards) if (!Number.isSafeInteger(reward.weight) || reward.weight <= 0 || (reward.grant.item && (reward.grant.quantity ?? 1) < 1)) errors.push(`${reward.id}: invalid reward weight or quantity`);
for (const milestone of source.milestones) for (const id of milestone.requires) reference('milestones', id, milestone.id);
for (const [index, milestone] of source.milestones.entries()) {
  if (index > 0 && milestone.requires.length === 0) errors.push(`${milestone.id}: disconnected milestone`);
  if (milestone.requires.some((id) => source.milestones.findIndex((entry) => entry.id === id) >= index)) errors.push(`${milestone.id}: prerequisite is not earlier in chapter`);
}
for (const upgrade of source.upgrades) for (const id of upgrade.requires) if ((byCollection.upgrades.get(id)?.tier ?? 0) >= upgrade.tier) errors.push(`${upgrade.id}: prerequisite tier is not lower`);
for (const wave of source.balance.firstNightWaves) for (const id of wave) reference('enemies', id, 'firstNightWaves');
source.balance.firstNightWaves.forEach((wave, index) => {
  if (wave.length > 3) errors.push(`firstNightWaves[${index}]: more than three enemies`);
  const threat = wave.reduce((sum, id) => sum + (byCollection.enemies.get(id)?.threat ?? 0), 0);
  if (threat > source.balance.waveBudgets[index]) errors.push(`firstNightWaves[${index}]: threat ${threat} exceeds budget ${source.balance.waveBudgets[index]}`);
});
for (const collection of ['upgrades', 'research', 'milestones']) {
  const visited = new Set(); const active = new Set();
  function walk(id) {
    if (active.has(id)) { errors.push(`${collection}: prerequisite cycle at ${id}`); return; }
    if (visited.has(id)) return;
    active.add(id);
    for (const prior of byCollection[collection].get(id)?.requires ?? []) if (byCollection[collection].has(prior)) walk(prior);
    active.delete(id); visited.add(id);
  }
  for (const id of byCollection[collection].keys()) walk(id);
}
if (source.balance.starting.resources.timber < Math.min(...source.buildings.map((b) => b.cost.timber)) || source.balance.starting.resources.provisions < source.balance.villageOrders.reinforce.provisions) errors.push('starting stock cannot support an essential opening choice');
if (!source.rewards.some((reward) => reward.immediate && reward.unlock === undefined)) errors.push('no guaranteed immediately useful first-night reward');
if (errors.length) { for (const error of errors) process.stderr.write(`Campaign content: ${error}\n`); process.exitCode = 1; } else {
  const catalog = {
    contentVersion: `chapter1-v${source.version}`,
    balance: {
      starting: { hero: source.balance.starting.hero, resources: source.balance.starting.resources, wardHp: source.balance.starting.wardHp, barricadeHp: source.balance.starting.barricadeHp, villagers: source.balance.starting.villagers, inventory: source.balance.starting.inventory },
      preparationTurns: source.balance.preparationTurns,
      interludeTurns: source.balance.interludeTurns,
      waveBudgets: source.balance.waveBudgets,
      workerOutput: { timber: source.balance.workerOutput.timber, provisions: source.balance.workerOutput.provisions, essence: source.balance.workerOutput.essence },
      actions: { scavenge: resourceObject(source.balance.scavenge), restHeal: source.balance.restHeal, repairAmount: source.balance.repairAmount },
      villageOrders: source.balance.villageOrders
    },
    enemies: source.enemies.map(({ id, name, role, hp, attack, armor, threat, target, intentModes, unlock, weight, heavyCooldown, eliteEffect, summons, retaliation, resistances, vulnerabilities, phases, description }) => ({ id, name, role, hp, attack, armor, threat, target, intentModes, unlock, weight, heavyCooldown, eliteEffect, summons, retaliation, resistances, vulnerabilities, phases, description })),
    spells: source.spells.map(({ id, name, element, manaCost, cooldown, power, status, bonusAgainst, unlock, description }) => ({ id, name, element, manaCost, cooldown, power, status: status?.id, statusDuration: status?.duration, statusPower: status?.power, bonusAgainst, unlock, description })),
    buildings: source.buildings.map(({ id, name, cost, turns, maxHp, upgrades }) => ({ id, name, cost: resourceObject(cost), turns, maxHp, upgrades })),
    upgrades: source.upgrades.map(({ id, name, building, branch, tier, cost, requires, effects, description }) => ({ id, name, building, branch, tier, cost: resourceObject(cost), requires, effects: numeric(effects), unlockEffect: typeof effects.recipeUnlock === 'string' ? effects.recipeUnlock : undefined, description })),
    items: source.items.map(({ id, name, slot, rarity, bonus, effect, unlock }) => ({ id, name, slot, rarity, bonus, effect, unlock })),
    villagers: source.villagers.map(({ id, name, role, traits, efficiency, description, unlock }) => ({ id, name, role: role === 'essence' ? 'ward' : role === 'research' ? 'study' : role, traits: traits.map((trait) => trait.id), traitEffects: traits, efficiency, description, unlock })),
    locations: source.locations.map(({ id, name, risk, turns, unlock, threat, rewards, siteEffect, secureFlag, steps }) => ({ id, name, risk, turns, unlock, threat, rewards: resourceSubset(rewards), siteEffect: numeric(siteEffect), secureFlag, steps: steps.map(({ id: stepId, text, choices }) => ({ id: stepId, text, choices: choices.map(({ id: choiceId, label, risk: choiceRisk, cost, reward, combat, flag, secure }) => ({ id: choiceId, label, risk: choiceRisk, cost: resourceSubset(cost), reward: resourceSubset(reward), rewardItem: reward?.item, combat, flag, secure, recruit: reward?.villager })) })) })),
    rewards: source.rewards.map(({ id, name, kind, grant, weight, immediate, unlock }) => ({ id, name, description: name, kind, resources: resourceSubset(grant), itemId: grant.item, quantity: grant.quantity, wardHeal: grant.wardHeal, barricadeHeal: grant.barricadeHeal, improvementId: grant.improvementId, weight, immediate, unlock })),
    research: source.research.map(({ id, name, cost, turns, requires, unlocks }) => ({ id, name, cost: resourceObject(cost), turns, requires, unlocks })),
    recipes: source.recipes.map(({ id, name, cost, output, unlock }) => ({ id, name, cost: resourceObject(cost), outputItemId: output.item, quantity: output.quantity, requires: [unlock] })),
    talents: source.talents.map(({ id, name, description, direction, unlock, effect }) => ({ id, name, description, direction, unlock, effects: numeric(effect) })),
    events: source.events.map(({ id, name, unlock, weight, choices }) => ({ id, text: name, unlock, weight, choices: choices.map(({ id: choiceId, label, cost, reward, flag, risk, combat, effect }) => ({ id: choiceId, label, cost: resourceSubset(cost), reward: resourceSubset(reward), rewardItem: reward?.item, flag, recruit: reward?.villager, risk, combat, effect: numeric(effect) })) })),
    milestones: source.milestones.map(({ id, requires, goal, unlocks, story }) => ({ id, description: story, requires: { flags: requires, nights: goal.nightsWon }, goal, unlocks, flag: id })),
    modifiers: source.modifiers.map(({ id, name, unlock, weight, counter, effect }) => ({ id, name, unlock, weight, description: counter, effect: { ...effect } })),
    objectives: source.objectives.map(({ id, name, unlock, condition, reward }) => ({ id, name, unlock, description: name, kind: Object.keys(condition)[0], target: Object.values(condition).find((value) => typeof value === 'number'), condition, reward: resourceSubset(reward) })),
    encounters: [...source.balance.firstNightWaves.map((enemyIds, index) => ({ id: `first_wave_${index + 1}`, enemyIds, budget: source.balance.waveBudgets[index], unlock: 'start' })), { id: 'boss_encounter', enemyIds: ['chapter_boss', 'shambler'], budget: 9, unlock: 'boss_night' }]
  };
  const header = '/* Generated by tools/generate-campaign-content.mjs from data/campaign/manifest.json. Do not edit by hand. */\n';
  const code = `${header}import type { CampaignCatalog } from './types.js';\n\nexport const CAMPAIGN_CATALOG: CampaignCatalog = ${JSON.stringify(catalog, null, 2)};\n\nexport const CAMPAIGN_SOURCE = ${JSON.stringify(source, null, 2)} as const;\n`;
  if (process.argv.includes('--check')) {
    if (readFileSync(outputPath, 'utf8') !== code) { process.stderr.write('Campaign generated catalog is stale. Run npm run content:generate.\n'); process.exitCode = 1; }
  } else {
    writeFileSync(outputPath, code);
    process.stdout.write(`Validated and generated ${collections.reduce((sum, key) => sum + source[key].length, 0)} campaign entries.\n`);
  }
}
