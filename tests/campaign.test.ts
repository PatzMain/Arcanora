import { describe, expect, it } from 'vitest';
import {
  CAMPAIGN_CATALOG,
  createCampaign,
  previewCampaignAction,
  resolveCampaignAction,
  validateCampaignSave,
  type CampaignAction,
  type CampaignState,
} from '../packages/core/src/campaign/index.js';

const step = (state: CampaignState, action: CampaignAction) => resolveCampaignAction(state, action).state;
const expectInvalid = (state: CampaignState, action: CampaignAction) => {
  const before = structuredClone(state);
  expect(previewCampaignAction(state, action).valid).toBe(false);
  expect(() => resolveCampaignAction(state, action)).toThrow();
  expect(state).toEqual(before);
};
const start = (seed = 1) => step(createCampaign(seed), { type: 'rekindle' });
const firstTarget = (state: CampaignState) => state.combat!.enemies.find((enemy) => enemy.hp > 0)!.instanceId;

describe('Campaign transition contract', () => {
  it('creates a reproducible, valid opening and does not mutate the input', () => {
    const a = createCampaign(4381);
    const b = createCampaign(4381);
    expect(a).toEqual(b);
    expect(validateCampaignSave(JSON.parse(JSON.stringify(a)))).toEqual(a);
    const copy = structuredClone(a);
    const next = step(a, { type: 'rekindle' });
    expect(a).toEqual(copy);
    expect(next.turn).toBe(1);
    expect(next.phase).toBe('preparation');
    expect(next.rngState).toBe(a.rngState);
  });

  it('assigns workers without time or production, then produces on the committed turn', () => {
    let state = start();
    const before = structuredClone(state);
    state = step(state, { type: 'assign', villagerId: 'mara', role: 'ward' });
    expect(state.turn).toBe(before.turn);
    expect(state.attempt!.resources).toEqual(before.attempt!.resources);
    const preview = previewCampaignAction(state, { type: 'prepare', kind: 'rest' });
    expect(preview.timeCost).toBe(1);
    expect(preview.production.essence).toBeGreaterThan(0);
    const result = step(state, { type: 'prepare', kind: 'rest' });
    expect(result.attempt!.resources.essence).toBeGreaterThan(state.attempt!.resources.essence);
    expect(result.turn).toBe(state.turn + 1);
  });

  it('pays construction once and completes only on committed world turns', () => {
    let state = start();
    const cost = CAMPAIGN_CATALOG.buildings.find((building) => building.id === 'workshop')!.cost;
    const stock = state.attempt!.resources;
    state = step(state, { type: 'prepare', kind: 'construct', targetId: 'workshop' });
    expect(state.refuge.buildings.workshop.construction).toBeDefined();
    expect(state.attempt!.resources.timber).toBeGreaterThanOrEqual(stock.timber - cost.timber);
    expect(state.refuge.buildings.workshop.level).toBe(0);
    state = step(state, { type: 'prepare', kind: 'rest' });
    expect(state.refuge.buildings.workshop.level).toBe(1);
    expectInvalid(state, { type: 'prepare', kind: 'construct', targetId: 'workshop' });
  });

  it('rejects invalid targets, absent consumables, overspending, and repeated commits', () => {
    let state = step(start(), { type: 'beginWave' });
    expectInvalid(state, { type: 'selectHeroAction', action: { kind: 'attack', targetId: 'missing' } });
    expectInvalid(state, { type: 'selectHeroAction', action: { kind: 'consumable', itemId: 'mana_tonic' } });
    expectInvalid(state, { type: 'endTurn' });
    state = step(state, { type: 'selectHeroAction', action: { kind: 'guard' } });
    const revision = state.revision;
    const next = step(state, { type: 'endTurn', expectedRevision: revision, actionId: 'round-1' });
    expect(next.turn).toBe(state.turn + 1);
    expectInvalid(next, { type: 'endTurn', expectedRevision: revision, actionId: 'round-1' });
  });

  it('keeps round selection free and charges an order before production', () => {
    let state = step(start(), { type: 'beginWave' });
    const initial = structuredClone(state);
    state = step(state, { type: 'selectHeroAction', action: { kind: 'attack', targetId: firstTarget(state) } });
    state = step(state, { type: 'selectVillageOrder', order: { kind: 'support' } });
    expect(state.turn).toBe(initial.turn);
    expect(state.attempt!.resources).toEqual(initial.attempt!.resources);
    const preview = previewCampaignAction(state, { type: 'endTurn' });
    expect(preview.cost.provisions).toBe(CAMPAIGN_CATALOG.balance.villageOrders.support.provisions);
    state = step(state, { type: 'endTurn' });
    expect(state.turn).toBe(initial.turn + 1);
    expect(state.attempt!.resources.provisions).toBe(initial.attempt!.resources.provisions - preview.cost.provisions + preview.production.provisions);
  });

  it('validates save references and impossible shape instead of accepting corrupt progress', () => {
    const state = createCampaign(9);
    expect(() => validateCampaignSave({ ...state, version: 99 })).toThrow();
    expect(() => validateCampaignSave({ ...state, hero: { ...state.hero, hp: -1 } })).toThrow();
    expect(() => validateCampaignSave({ ...state, hero: { ...state.hero, inventory: { nonexistent: 1 } } })).toThrow();
    expect(() => validateCampaignSave({ ...state, phase: 'combat', combat: null })).toThrow();
    expect(() => validateCampaignSave({ ...state, rngState: NaN })).toThrow();
  });

  it('recovers after retreat without adding bankable supplies repeatedly', () => {
    let state = step(start(), { type: 'beginWave' });
    state = step(state, { type: 'selectHeroAction', action: { kind: 'retreat' } });
    state = step(state, { type: 'endTurn' });
    expect(state.phase).toBe('defeat');
    expect(state.attempt).toBeNull();
    const banked = structuredClone(state.refuge.resources);
    const kit = structuredClone(state.refuge.recovery);
    expect(kit.timber + kit.provisions + kit.essence).toBeGreaterThan(0);
    state = step(state, { type: 'startNight' });
    expect(state.refuge.resources).toEqual(banked);
    expect(state.refuge.recovery).toEqual(kit);
  });
});
