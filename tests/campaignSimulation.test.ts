import { describe, expect, it } from 'vitest';
import { CAMPAIGN_CATALOG, createCampaign, previewCampaignAction, resolveCampaignAction, validateCampaignSave, type CampaignAction, type CampaignState } from '../packages/core/src/campaign/index.js';

type Strategy = 'tactical' | 'attack' | 'defense' | 'production' | 'magic' | 'exploration' | 'conservative' | 'aggressive';
type Run = { state: CampaignState; transitions: number; spells: number; orders: number; retreats: number; errors: string[] };
const act = (state: CampaignState, action: CampaignAction) => resolveCampaignAction(state, action).state;
const tryAct = (state: CampaignState, action: CampaignAction) => previewCampaignAction(state, action).valid ? act(state, action) : state;
const stock = (state: CampaignState) => state.attempt?.resources ?? state.refuge.resources;

function selectCombatAction(state: CampaignState, strategy: Strategy): CampaignAction {
  const enemies = state.combat!.enemies.filter((enemy) => enemy.hp > 0);
  const target = [...enemies].sort((a, b) => {
    const pressure = (enemy: typeof a) => enemy.intention.target === 'ward' ? 3 : enemy.intention.target === 'barricade' ? 2 : 1;
    return pressure(b) - pressure(a) || a.hp - b.hp;
  })[0];
  if (strategy === 'attack' || strategy === 'aggressive') return { type: 'selectHeroAction', action: { kind: 'attack', targetId: target.instanceId } };
  const chill = target.statuses.some((effect) => effect.kind === 'chill');
  if (chill && state.hero.mana >= 3 && (state.hero.cooldowns.lightning ?? 0) === 0) return { type: 'selectHeroAction', action: { kind: 'spell', spellId: 'lightning', targetId: target.instanceId } };
  if (!chill && state.hero.mana >= 2 && (state.hero.cooldowns.frost ?? 0) === 0) return { type: 'selectHeroAction', action: { kind: 'spell', spellId: 'frost', targetId: target.instanceId } };
  if (state.hero.hp <= state.hero.maxHp - 15 && (state.hero.inventory.healing_draught ?? 0) > 0) return { type: 'selectHeroAction', action: { kind: 'consumable', itemId: 'healing_draught' } };
  if (state.hero.mana <= 1 && state.hero.hp > 16) return { type: 'selectHeroAction', action: { kind: 'guard' } };
  return { type: 'selectHeroAction', action: { kind: 'attack', targetId: target.instanceId } };
}

function prepare(state: CampaignState, strategy: Strategy): CampaignState {
  if (state.phase === 'opening') return act(state, { type: 'rekindle' });
  if (state.phase !== 'preparation') return state;
  if (strategy !== 'attack' && strategy !== 'aggressive' && state.refuge.buildings.barricade.hp <= state.refuge.buildings.barricade.maxHp - 8 && stock(state).timber > 0) return tryAct(state, { type: 'prepare', kind: 'repair' });
  if (strategy === 'defense' && state.refuge.buildings.ward.level === 0 && previewCampaignAction(state, { type: 'prepare', kind: 'construct', targetId: 'ward' }).valid) return act(state, { type: 'prepare', kind: 'construct', targetId: 'ward' });
  if (strategy === 'production' && state.refuge.buildings.workshop.level === 0 && previewCampaignAction(state, { type: 'prepare', kind: 'construct', targetId: 'workshop' }).valid) return act(state, { type: 'prepare', kind: 'construct', targetId: 'workshop' });
  if (state.hero.hp < state.hero.maxHp - 8 || (strategy !== 'attack' && state.hero.mana < 7)) return act(state, { type: 'prepare', kind: 'rest' });
  return act(state, { type: 'prepare', kind: 'scavenge' });
}

export function playNight(initial: CampaignState, strategy: Strategy, maxTransitions = 400): Run {
  let state = initial;
  let spells = 0; let orders = 0; let retreats = 0;
  const errors: string[] = [];
  for (let transitions = 0; transitions < maxTransitions; transitions++) {
    if (state.phase === 'defeat' || state.phase === 'rewards' || state.phase === 'chapter_complete') return { state, transitions, spells, orders, retreats, errors };
    const previous = state;
    try {
      if (state.phase === 'opening' || state.phase === 'preparation') state = prepare(state, strategy);
      else if (state.phase === 'combat') {
        const action = selectCombatAction(state, strategy);
        state = act(state, action);
        if (action.type === 'selectHeroAction' && action.action.kind === 'spell') spells++;
        if (strategy !== 'attack' && strategy !== 'aggressive' && stock(state).provisions >= 2) {
          const wall = state.refuge.buildings.barricade;
          const order = wall.hp <= wall.maxHp - 8 && state.combat!.enemies.some((enemy) => enemy.intention.target === 'barricade') ? 'reinforce'
            : state.hero.hp <= state.hero.maxHp - 8 ? 'support' : null;
          if (order) { state = tryAct(state, { type: 'selectVillageOrder', order: { kind: order } }); orders++; }
        }
        state = act(state, { type: 'endTurn', expectedRevision: state.revision, actionId: `sim-${transitions}` });
      } else { errors.push(`unexpected phase ${state.phase}`); break; }
      if (state === previous) { errors.push(`no progress at ${state.phase}`); break; }
      validateCampaignSave(JSON.parse(JSON.stringify(state)));
    } catch (error) { errors.push(`night ${state.night} phase ${state.phase}: ${String(error)}`); break; }
  }
  return { state, transitions: maxTransitions, spells, orders, retreats, errors: errors.length ? errors : ['transition limit'] };
}

function bankReward(state: CampaignState): CampaignState {
  if (state.phase !== 'rewards') return state;
  const reward = state.rewardChoices.find((choice) => choice.resources?.timber || choice.resources?.provisions || choice.resources?.essence) ?? state.rewardChoices[0];
  return act(state, { type: 'claimReward', rewardId: reward.id });
}

function affordableUpgrade(state: CampaignState, strategy: Strategy): string | undefined {
  const branch = strategy === 'defense' || strategy === 'conservative' ? 'barricade' : strategy === 'magic' ? 'ward' : 'workshop';
  return CAMPAIGN_CATALOG.upgrades.find((upgrade) => upgrade.building === branch && previewCampaignAction(state, { type: 'chooseUpgrade', upgradeId: upgrade.id }).valid)?.id
    ?? CAMPAIGN_CATALOG.upgrades.find((upgrade) => previewCampaignAction(state, { type: 'chooseUpgrade', upgradeId: upgrade.id }).valid)?.id;
}

type BossSnapshot = { night: number; hp: number; mana: number; ward: number; barricade: number; resources: number; upgrades: string[]; equipment: CampaignState['hero']['equipment'] };
function progressChapter(seed: number, strategy: Strategy): { state: CampaignState; attempts: number; failures: number; bossAttempts: number; errors: string[]; firstBoss?: BossSnapshot; lastBossDeath?: { round: number; hp: number; ward: number } } {
  let state = createCampaign(seed);
  let failures = 0; let bossAttempts = 0;
  let firstBoss: BossSnapshot | undefined; let lastBossDeath: { round: number; hp: number; ward: number } | undefined;
  const errors: string[] = [];
  for (let attempts = 0; attempts < 18; attempts++) {
    const wasBoss = state.attempt?.kind === 'boss';
    if (wasBoss && !firstBoss) firstBoss = { night: state.night, hp: state.hero.hp, mana: state.hero.mana, ward: state.refuge.wardHp, barricade: state.refuge.buildings.barricade.hp, resources: Object.values(state.refuge.resources).reduce((sum, amount) => sum + amount, 0), upgrades: Object.values(state.refuge.buildings).flatMap((building) => building.upgrades), equipment: state.hero.equipment };
    const run = playNight(state, strategy);
    state = run.state;
    errors.push(...run.errors);
    if (wasBoss && state.phase === 'defeat') lastBossDeath = { round: run.transitions, hp: state.hero.hp, ward: state.refuge.wardHp };
    if (errors.length) return { state, attempts: attempts + 1, failures, bossAttempts, errors, firstBoss, lastBossDeath };
    if (state.phase === 'chapter_complete') return { state, attempts: attempts + 1, failures, bossAttempts, errors, firstBoss, lastBossDeath };
    if (state.phase === 'defeat') failures++;
    state = bankReward(state);
    if (state.phase === 'refuge' && state.pendingEventId) {
      const event = CAMPAIGN_CATALOG.events.find((entry) => entry.id === state.pendingEventId)!;
      const choice = event.choices.find((entry) => previewCampaignAction(state, { type: 'chooseEvent', choiceId: entry.id }).valid);
      if (choice) state = act(state, { type: 'chooseEvent', choiceId: choice.id });
    }
    if (state.phase === 'refuge') {
      const upgrade = affordableUpgrade(state, strategy);
      if (upgrade) state = act(state, { type: 'chooseUpgrade', upgradeId: upgrade });
      if (strategy === 'exploration' || state.flags.includes('night_two')) {
        const preferred = state.unlockedLocations.find((id) => id === 'roadside_camp' && !state.refuge.securedSites.includes(id))
          ?? state.unlockedLocations.find((id) => id === 'crypt' && !state.flags.includes('crypt_clue'))
          ?? state.unlockedLocations.find((id) => !state.refuge.securedSites.includes(id));
        if (preferred && previewCampaignAction(state, { type: 'startExpedition', locationId: preferred }).valid) {
          state = act(state, { type: 'startExpedition', locationId: preferred });
          for (let choices = 0; choices < 4 && state.phase === 'expedition'; choices++) {
            const location = CAMPAIGN_CATALOG.locations.find((entry) => entry.id === state.expedition!.locationId)!;
            const step = location.steps[state.expedition!.step];
            const choice = step?.choices.find((entry) => (entry.recruit || entry.flag) && previewCampaignAction(state, { type: 'expeditionChoice', choiceId: entry.id }).valid)
              ?? step?.choices.find((entry) => previewCampaignAction(state, { type: 'expeditionChoice', choiceId: entry.id }).valid);
            if (!choice) break;
            state = act(state, { type: 'expeditionChoice', choiceId: choice.id });
            if (state.phase === 'combat') {
              // Expeditions use the same group combat. The current night driver ends only at night rewards.
              for (let round = 0; round < 30 && state.phase === 'combat'; round++) {
                state = act(state, selectCombatAction(state, strategy));
                state = act(state, { type: 'endTurn', expectedRevision: state.revision, actionId: `exp-${attempts}-${choices}-${round}` });
              }
            }
          }
          if (state.phase === 'expedition') state = act(state, { type: 'retreat' });
        }
      }
    }
    if (state.phase !== 'refuge' && state.phase !== 'defeat') { errors.push(`cannot continue from ${state.phase}`); return { state, attempts: attempts + 1, failures, bossAttempts, errors, firstBoss, lastBossDeath }; }
    const boss = state.flags.includes('boss_unlocked');
    if (boss) bossAttempts++;
    state = act(state, { type: 'startNight', boss });
  }
  return { state, attempts: 18, failures, bossAttempts, errors: ['chapter attempt limit'], firstBoss, lastBossDeath };
}

describe('Seeded campaign simulations', () => {
  it('tests at least 1,000 opening seeds against attack-only play', () => {
    let tacticalWins = 0; let attackWins = 0; let tacticalSpells = 0; let tacticalOrders = 0;
    const failures: string[] = [];
    for (let seed = 1; seed <= 1000; seed++) {
      const tactical = playNight(createCampaign(seed), 'tactical');
      const attack = playNight(createCampaign(seed), 'attack');
      tacticalWins += tactical.state.phase === 'rewards' ? 1 : 0;
      attackWins += attack.state.phase === 'rewards' ? 1 : 0;
      tacticalSpells += tactical.spells; tacticalOrders += tactical.orders;
      if (tactical.errors.length || attack.errors.length) failures.push(`seed ${seed}: ${[...tactical.errors, ...attack.errors].join('; ')}`);
    }
    console.info(JSON.stringify({ simulation: 'first-night', seeds: 1000, tacticalWins, attackWins, tacticalSpells, tacticalOrders, failures: failures.slice(0, 5) }));
    expect(failures).toEqual([]);
    expect(tacticalWins).toBeGreaterThanOrEqual(900);
    expect(tacticalWins).toBeGreaterThan(attackWins);
  }, 120_000);

  it('checks multiple chapter priorities through the first boss', () => {
    const strategies: Strategy[] = ['defense', 'production', 'magic', 'exploration', 'conservative', 'aggressive'];
    const report = strategies.map((strategy) => {
      const runs = Array.from({ length: 20 }, (_, index) => progressChapter(20_000 + index, strategy));
      return { strategy, completed: runs.filter((run) => run.state.phase === 'chapter_complete').length, failures: runs.reduce((sum, run) => sum + run.failures, 0), bossAttempts: runs.reduce((sum, run) => sum + run.bossAttempts, 0), attempts: runs.map((run) => run.attempts), firstErrors: runs.flatMap((run) => run.errors).slice(0, 3), resourceMax: Math.max(...runs.map((run) => run.state.refuge.resources.timber + run.state.refuge.resources.provisions + run.state.refuge.resources.essence)), maxHeroLevel: Math.max(...runs.map((run) => run.state.hero.level)), maxVillagers: Math.max(...runs.map((run) => run.state.refuge.villagers.length)), maxItems: Math.max(...runs.map((run) => Object.values(run.state.hero.inventory).reduce((sum, count) => sum + count, 0))), maxUpgrades: Math.max(...runs.map((run) => Object.values(run.state.refuge.buildings).reduce((sum, building) => sum + building.upgrades.length, 0))), firstBoss: runs[0].firstBoss, lastBossDeath: runs[0].lastBossDeath };
    });
    console.info(JSON.stringify({ simulation: 'chapter-one', seedsPerStrategy: 20, report }));
    expect(report.some((row) => row.completed > 0)).toBe(true);
    expect(report.every((row) => row.resourceMax > 500)).toBe(true);
  }, 120_000);
});
