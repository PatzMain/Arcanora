import type { CampaignCatalog, CampaignEnemy, CampaignState, EnemyIntention, HeroAction, VillageOrder } from './types.js';
import { clamp } from './math.js';
import { draw, weightedIndex } from './random.js';

const alive = (enemy: CampaignEnemy) => enemy.hp > 0;
export function createEnemy(state: CampaignState, catalog: CampaignCatalog, id: string, index: number): CampaignEnemy {
  const template = catalog.enemies.find((entry) => entry.id === id);
  if (!template) throw new Error(`Unknown enemy: ${id}`);
  const enemy: CampaignEnemy = {
    id, instanceId: `${state.night}:${state.attempt?.wave ?? 0}:${index}:${id}`,
    name: template.name, role: template.role, hp: template.hp, maxHp: template.hp,
    attack: template.attack, armor: template.armor, elite: template.role === 'elite' || id === 'chapter_boss',
    statuses: [], intention: { kind: 'attack', target: template.target, power: template.attack, label: 'Attacks' },
    lastHeavy: false, phase: id === 'chapter_boss' ? 1 : undefined
  };
  enemy.intention = rollIntent(state, catalog, enemy);
  return enemy;
}

export function rollIntent(state: CampaignState, catalog: CampaignCatalog, enemy: CampaignEnemy): EnemyIntention {
  const template = catalog.enemies.find((entry) => entry.id === enemy.id);
  if (!template) throw new Error(`Unknown enemy: ${enemy.id}`);
  const heavy = ['lunge', 'sunder', 'last_toll'];
  const bossPhase = enemy.id === 'chapter_boss' ? template.phases?.filter((phase) => phase.atHpPercent >= (enemy.hp / enemy.maxHp) * 100).sort((left, right) => left.atHpPercent - right.atHpPercent)[0] : undefined;
  const options = bossPhase ? [bossPhase.intent, 'strike'] : template.intentModes?.length ? template.intentModes : ['strike'];
  const allowed = options.filter((mode) => !enemy.lastHeavy || !heavy.includes(mode));
  const kind = allowed[draw(state, allowed.length)] ?? 'strike';
  enemy.lastHeavy = heavy.includes(kind);
  const target = bossPhase?.target ?? (kind === 'drain' || kind === 'ring_bell' ? 'ward' : kind === 'sunder' || kind === 'last_toll' ? 'barricade' : template.target);
  const power = heavy.includes(kind) ? Math.ceil(enemy.attack * 1.5) : ['guard_ally', 'bolster', 'rally', 'summon', 'retaliate', 'chill_aura'].includes(kind) ? 0 : enemy.attack;
  const labels: Record<string, string> = { strike: `Strikes ${target}`, lunge: `Lunges at ${target}`, sunder: 'Sunders the barricade', bolt: `Hurls a bolt at ${target}`, curse: `Curses ${target}`, rally: 'Rallies nearby undead', guard_ally: 'Shields an ally', bolster: 'Bolsters an ally', summon: 'Summons a shambler', retaliate: 'Raises barbed bones', chill_aura: 'Spreads rime', ring_bell: 'Rings the ward bell', last_toll: 'Prepares the last toll', drain: 'Drains the ward' };
  const label = labels[kind] ?? `Attacks ${target}`;
  return { kind, target, power, label };
}

export function generateWave(state: CampaignState, catalog: CampaignCatalog, wave: number): string[] {
  if (state.attempt?.kind === 'first') {
    return wave === 1 ? ['shambler', 'shambler'] : wave === 2 ? ['shambler', 'bonebreaker', 'grave_caster'] : ['bonebreaker', 'grave_caster', 'hollow_knight'];
  }
  if (state.attempt?.kind === 'boss') return wave === 1 ? ['shambler', 'grave_caster'] : wave === 2 ? ['bonebreaker', 'ward_leech'] : ['chapter_boss', 'shambler', 'grave_caster'];
  const budget = (catalog.balance.waveBudgets[wave - 1] ?? wave * 2) + Math.min(3, Math.floor(state.nightsWon / 3));
  const pool = catalog.enemies.filter((enemy) => enemy.id !== 'chapter_boss' && enemy.threat <= budget && (!enemy.unlock || state.flags.includes(enemy.unlock)));
  const ids: string[] = [];
  let remaining = budget;
  while (ids.length < 3) {
    const candidates = pool.filter((enemy) => enemy.threat <= remaining && (wave === 3 || enemy.role !== 'elite'));
    if (!candidates.length) break;
    const weights = candidates.map((enemy) => Math.max(1, 5 - ids.filter((id) => id === enemy.id).length * 3));
    const chosen = candidates[weightedIndex(state, weights)];
    ids.push(chosen.id);
    remaining -= chosen.threat;
  }
  return ids.length ? ids : ['shambler'];
}

export function enterCombat(state: CampaignState, catalog: CampaignCatalog, ids: string[], source: 'night' | 'expedition' | 'boss'): void {
  state.phase = 'combat';
  state.combat = { source, round: 1, enemies: ids.slice(0, 3).map((id, index) => createEnemy(state, catalog, id, index)), selectedHeroAction: null, selectedVillageOrder: null, guarded: false, firstSpellUsed: false, log: [] };
  state.log.push(`The ${source === 'boss' ? 'grave captain' : 'undead'} approach.`);
}

function applyDamage(enemy: CampaignEnemy, amount: number, log: string[], element = 'physical', catalog?: CampaignCatalog): void {
  const guarded = enemy.statuses.some((effect) => effect.kind === 'warded') ? 2 : 0;
  const template = catalog?.enemies.find((entry) => entry.id === enemy.id);
  const resistance = template?.resistances?.[element] ?? 0;
  const vulnerability = template?.vulnerabilities?.[element] ?? 0;
  const adjusted = Math.round(amount * (100 - resistance + vulnerability) / 100);
  const actual = Math.max(1, adjusted - enemy.armor - guarded);
  enemy.hp = Math.max(0, enemy.hp - actual);
  log.push(`${enemy.name} takes ${actual} damage.`);
}

export function resolveHeroAction(state: CampaignState, catalog: CampaignCatalog, action: HeroAction, log: string[]): 'retreat' | 'continue' {
  const combat = state.combat;
  if (!combat) throw new Error('No combat');
  const hero = state.hero;
  combat.guarded = false;
  if (action.kind === 'retreat') { log.push('The refuge falls back.'); return 'retreat'; }
  if (action.kind === 'guard') { combat.guarded = true; hero.mana = clamp(hero.mana + 1, 0, hero.maxMana); log.push('You guard and recover one mana.'); return 'continue'; }
  if (action.kind === 'consumable') {
    const item = catalog.items.find((entry) => entry.id === action.itemId);
    if (!item) throw new Error('Unknown consumable');
    hero.inventory[action.itemId]--;
    const strength = item.power ?? Number(item.effect?.match(/\d+/)?.[0] ?? 10);
    if (item.effect?.startsWith('mana')) hero.mana = clamp(hero.mana + strength, 0, hero.maxMana);
    else if (item.effect?.startsWith('ward_heal')) state.refuge.wardHp = clamp(state.refuge.wardHp + strength, 0, state.refuge.maxWardHp);
    else if (item.effect?.startsWith('barrier')) hero.statuses.push({ kind: 'barrier', turns: 2, strength });
    else if (item.effect?.startsWith('cleanse')) hero.statuses = hero.statuses.filter((effect) => effect.kind !== 'curse' && effect.kind !== 'burn');
    else if (item.effect?.startsWith('bomb') && action.targetId) {
      const target = combat.enemies.find((enemy) => enemy.instanceId === action.targetId && alive(enemy));
      if (target) applyDamage(target, strength, log, 'fire', catalog);
    } else if (item.effect?.startsWith('burn') && action.targetId) {
      const target = combat.enemies.find((enemy) => enemy.instanceId === action.targetId && alive(enemy));
      if (target) { target.hp = Math.max(0, target.hp - strength); if (target.hp > 0) target.statuses.push({ kind: 'burn', turns: 2, strength: 2 }); }
    } else hero.hp = clamp(hero.hp + strength, 0, hero.maxHp);
    log.push(`Used ${item.name}.`);
    return 'continue';
  }
  if (action.kind === 'spell' && action.spellId === 'arcane_barrier') {
    const spell = catalog.spells.find((entry) => entry.id === action.spellId)!;
    const discount = hero.talents.includes('efficient_channel') && !combat.firstSpellUsed ? 1 : 0;
    hero.mana -= Math.max(0, spell.manaCost - discount);
    hero.cooldowns[spell.id] = spell.cooldown + 1;
    combat.firstSpellUsed = true;
    hero.statuses.push({ kind: 'barrier', turns: spell.statusDuration ?? 2, strength: spell.power });
    log.push('An arcane barrier surrounds the keeper.');
    return 'continue';
  }
  const target = combat.enemies.find((enemy) => enemy.instanceId === action.targetId && alive(enemy));
  if (!target) throw new Error('Target is no longer present');
  if (action.kind === 'attack') {
    const chill = target.statuses.find((effect) => effect.kind === 'chill');
    const weapon = hero.equipment.weapon ? catalog.items.find((item) => item.id === hero.equipment.weapon) : undefined;
    const shatterBonus = weapon?.effect?.startsWith('shatter_bonus') ? Number(weapon.effect.match(/\d+/)?.[0] ?? 0) : 0;
    const bonus = chill ? 4 + chill.strength + shatterBonus + (hero.talents.includes('sure_shatter') ? 3 : 0) : 0;
    if (chill) target.statuses = target.statuses.filter((effect) => effect !== chill);
    const wardBonus = weapon?.effect?.startsWith('bonus_vs_ward_attackers') && catalog.enemies.find((enemy) => enemy.id === target.id)?.target === 'ward' ? Number(weapon.effect.match(/\d+/)?.[0] ?? 0) : 0;
    applyDamage(target, hero.attack + (weapon?.bonus?.attack ?? 0) + bonus + wardBonus, log, 'physical', catalog);
    if (chill) log.push('Chill shatters.');
    if (chill && hero.equipment.focus === 'spark_charm') hero.mana = clamp(hero.mana + 1, 0, hero.maxMana);
    const retaliation = catalog.enemies.find((entry) => entry.id === target.id)?.retaliation ?? 0;
    if (target.hp > 0 && retaliation && target.intention.kind === 'retaliate') { hero.hp = Math.max(0, hero.hp - retaliation); log.push(`${target.name} retaliates for ${retaliation}.`); }
  } else {
    const spell = catalog.spells.find((entry) => entry.id === action.spellId);
    if (!spell) throw new Error('Unknown spell');
    const discount = hero.talents.includes('efficient_channel') && !combat.firstSpellUsed ? 1 : 0;
    hero.mana -= Math.max(0, spell.manaCost - discount);
    hero.cooldowns[spell.id] = spell.cooldown + 1;
    combat.firstSpellUsed = true;
    const chilled = target.statuses.some((effect) => effect.kind === 'chill');
    const bonus = spell.bonusAgainst && target.statuses.some((effect) => effect.kind === spell.bonusAgainst?.status) ? spell.bonusAgainst.power + (hero.talents.includes('cold_conductor') ? 3 : 0) : spell.element === 'lightning' && chilled ? 5 : 0;
    const focus = hero.equipment.focus ? catalog.items.find((item) => item.id === hero.equipment.focus) : undefined;
    applyDamage(target, spell.power + Math.floor(hero.spellPower / 2) + bonus + (focus?.bonus?.spellPower ?? 0), log, spell.element, catalog);
    if (spell.status && target.hp > 0) target.statuses.push({ kind: spell.status, turns: (spell.statusDuration ?? (spell.status === 'chill' ? 2 : 3)) + (spell.status === 'chill' && hero.equipment.focus === 'shrine_prism' ? 1 : 0), strength: spell.statusPower ?? 2 });
    if (spell.id === 'chain_lightning' && chilled) {
      const second = combat.enemies.find((enemy) => enemy !== target && alive(enemy));
      if (second) { applyDamage(second, Math.ceil(spell.power / 2), log, 'lightning', catalog); log.push('Lightning chains to a second foe.'); }
    }
    if (hero.equipment.armor === 'rimed_cloak') hero.statuses.push({ kind: 'barrier', turns: 2, strength: 2 });
    if (bonus) log.push('Lightning surges through Chill.');
  }
  return 'continue';
}

export function resolveVillageOrder(state: CampaignState, catalog: CampaignCatalog, order: VillageOrder | null, log: string[]): void {
  if (!order) return;
  if (order.kind === 'reinforce') {
    const barricade = state.refuge.buildings.barricade;
    const bonus = barricade.upgrades.includes('barricade_signal') ? 4 : 0;
    barricade.hp = clamp(barricade.hp + catalog.balance.villageOrders.reinforce.repair + bonus, 0, barricade.maxHp);
    log.push('Villagers reinforce the barricade.');
  } else {
    state.hero.hp = clamp(state.hero.hp + catalog.balance.villageOrders.support.heal, 0, state.hero.maxHp);
    log.push('Villagers support the hero.');
  }
}

export function resolveEnemyActions(state: CampaignState, catalog: CampaignCatalog, log: string[]): void {
  const combat = state.combat;
  if (!combat) throw new Error('No combat');
  for (const enemy of combat.enemies.filter(alive)) {
    const intention = enemy.intention;
    if (intention.kind === 'guard_ally') {
      const ally = combat.enemies.find((other) => other !== enemy && alive(other));
      if (ally) ally.statuses.push({ kind: 'warded', turns: 2, strength: 2 });
      log.push(`${enemy.name} shields an ally.`); continue;
    }
    if (intention.kind === 'bolster' || intention.kind === 'rally') {
      const ally = combat.enemies.find((other) => other !== enemy && alive(other));
      if (ally) { ally.attack += 1; log.push(`${enemy.name} empowers ${ally.name}.`); }
      continue;
    }
    if (intention.kind === 'summon') {
      const template = catalog.enemies.find((entry) => entry.id === enemy.id);
      if (combat.enemies.filter(alive).length < 3 && template?.summons) { combat.enemies.push(createEnemy(state, catalog, template.summons, combat.enemies.length)); log.push(`${enemy.name} summons aid.`); }
      continue;
    }
    if (intention.kind === 'retaliate') { log.push(`${enemy.name} raises barbed bones.`); continue; }
    if (intention.kind === 'chill_aura') { state.hero.statuses.push({ kind: 'chill', turns: 2, strength: 1 }); log.push(`${enemy.name} chills the keeper.`); continue; }
    let damage = intention.power;
    if (enemy.statuses.some((effect) => effect.kind === 'chill')) damage = Math.max(1, damage - 2);
    if (intention.target === 'hero') {
      const armor = state.hero.equipment.armor ? catalog.items.find((item) => item.id === state.hero.equipment.armor) : undefined;
      damage = Math.max(1, damage - state.hero.resilience - (armor?.bonus?.resilience ?? 0));
      if (combat.guarded) damage = Math.ceil(damage / 2);
      if (state.hero.statuses.some((effect) => effect.kind === 'chill')) damage += 1;
      const barrier = state.hero.statuses.find((effect) => effect.kind === 'barrier');
      if (barrier) damage = Math.max(0, damage - barrier.strength);
      state.hero.hp = Math.max(0, state.hero.hp - damage);
      if (intention.kind === 'curse') state.hero.statuses.push({ kind: 'curse', turns: 2, strength: 1 });
    } else if (intention.target === 'barricade') {
      const building = state.refuge.buildings.barricade;
      if (intention.kind === 'sunder') {
        const reduction = state.refuge.buildings.barricade.upgrades.includes('barricade_reinforced') ? 2 : 0;
        damage = Math.max(1, damage + 2 - reduction);
      }
      const absorbed = Math.min(building.hp, damage);
      building.hp -= absorbed;
      state.refuge.wardHp = Math.max(0, state.refuge.wardHp - (damage - absorbed));
      if (building.upgrades.includes('barricade_spikes')) enemy.hp = Math.max(0, enemy.hp - 3);
    } else {
      if (state.refuge.buildings.ward.upgrades.includes('ward_bastion')) damage = Math.max(1, damage - 2);
      state.refuge.wardHp = Math.max(0, state.refuge.wardHp - damage);
    }
    log.push(`${enemy.name} ${intention.label.toLowerCase()} for ${damage}.`);
    if (state.hero.hp <= 0 || state.refuge.wardHp <= 0) break;
  }
}

export function tickCombatEffects(state: CampaignState, catalog: CampaignCatalog, log: string[]): void {
  const combat = state.combat;
  if (!combat) return;
  for (const enemy of combat.enemies.filter(alive)) {
    const burning = enemy.statuses.find((effect) => effect.kind === 'burn');
    if (burning) { enemy.hp = Math.max(0, enemy.hp - burning.strength); log.push(`${enemy.name} burns.`); }
    enemy.statuses = enemy.statuses.map((effect) => ({ ...effect, turns: effect.turns - 1 })).filter((effect) => effect.turns > 0);
    if (enemy.hp > 0) {
      if (enemy.id === 'chapter_boss') enemy.phase = enemy.hp <= enemy.maxHp / 3 ? 3 : enemy.hp <= enemy.maxHp * 2 / 3 ? 2 : 1;
      enemy.intention = rollIntent(state, catalog, enemy);
    }
  }
  state.hero.statuses = state.hero.statuses.map((effect) => ({ ...effect, turns: effect.turns - 1 })).filter((effect) => effect.turns > 0);
  for (const [id, remaining] of Object.entries(state.hero.cooldowns)) state.hero.cooldowns[id] = Math.max(0, remaining - 1);
  combat.round++;
}
