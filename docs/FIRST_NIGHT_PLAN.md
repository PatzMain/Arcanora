# The First Night and Chapter One: implementation and acceptance

This document tracks the full requested journey. A checked item means the behavior has been implemented and verified, not merely represented by content data. The source brief is the 925-line attached request, **Arcanora: The First Night**. The existing Discord game and demo save remain separate from the new local campaign.

## Ownership and sequence

1. Agree on the campaign data and TypeScript contract. **Core and content owners: done for the initial contract; expand it as mechanics are integrated.**
2. Implement the pure campaign engine, content, save handling, and browser experience in parallel with clear file ownership. **In progress.**
3. Have independent Sol reviewers inspect the engine, UI, content, persistence, and balance. Run at least 1,000 deterministic first-night seeds and additional chapter simulations. **Pending.**
4. Complete every applicable acceptance item below, fix failures, and run the root suite plus explicit web/core lint, type checks, and builds. **Pending.**
5. Commit passing work with the repository's conventional prefix and update `CONTEXT_HANDOFF.md`. **Pending.**

Content owner: `data/campaign/manifest.json`, `tools/generate-campaign-content.mjs`, `packages/core/src/campaign/catalog.generated.ts`, this plan, and `package.json` content scripts. Core owner: `packages/core/src/campaign/` engine and types. UI owner: `apps/web/` campaign experience and assets. The legacy catalog and Discord gameplay are preserved.

## Opening and presentation

- [ ] Title screen with Begin, Continue, settings, optional name, balanced level-one loadout, and Existing Adventure.
- [ ] Playable ward rekindling, two villager assignments, first defense, progressive teaching, and free choices thereafter.
- [ ] Refuge-first presentation with stone, bronze, amber, and teal identity; clear objectives and prominent actions.
- [ ] Preparation view shows stock, workers, construction, and time; combat view shows targets, intentions, hero actions, and village orders.
- [ ] Original amber-flame fractured-ward emblem, master asset, favicon, mobile/browser icons, metadata, and manifest.
- [ ] Developer controls absent from normal UI; player text avoids implementation language.
- [ ] Desktop and narrow-screen layouts, touch targets, keyboard-only access, browser zoom, readable contrast, and reduced motion are verified.

## First-night clock, economy, and combat

- [ ] Valid committed actions alone advance the shared clock; preview cost/production; invalid actions, menus, animation, reward choice, and offline time do not advance.
- [ ] Six preparation turns, three waves, two interlude turns each, and early wave start forfeits remaining preparation.
- [ ] Timber, provisions, and essence only; assignments free during preparation, applied on next committed turn, fixed during waves.
- [ ] Scavenge, rest, repair, and build; barricade/workshop/ward pay immediately and finish by committed turns.
- [ ] Three enemies maximum per wave; basic attacker, breaker, caster, and third-wave elite are distinct.
- [ ] One hero action and optional order per round; End Turn commits; attack, guard, frost, lightning, consumable, and retreat all validate.
- [ ] Chill, Lightning exploitation, physical Shatter, mana, cooldown, inventory consumption, timed statuses, and intended targets resolve consistently.
- [ ] Reinforce/support orders spend provisions available before production; documented hero → order → enemy → status → production order.
- [ ] Hero or ward defeat preserves permanent growth and banked stock, loses unbanked loot, and grants a non-stockpilable recovery kit.
- [ ] Three distinct night reward choices, one immediately useful; one affordable first permanent improvement, then repeatable generated nights.

## Determinism, content, and save

- [x] Campaign content has its own JSON source and reproducible browser catalog generation; existing catalog is untouched.
- [x] Generator validates duplicate IDs, references, costs, status combinations, prerequisite cycles, scripted wave budgets, and a viable opening stock/reward.
- [ ] Engine consumes the rich content fields for every player-facing mechanic rather than leaving unused metadata.
- [ ] Fresh attempt seeds and persisted RNG state reproduce encounters/events/outcomes after reload.
- [ ] Weighted encounters, threat budgets, repeated-event reduction, useful-drop pity, heavy attack spacing, available counters, and broad wave preview.
- [ ] Opening threat independent of wealth and upgrades; rewards relevant to current damage/inventory without fixed drops.
- [ ] Pure creation, action preview/resolution, save validation, and separate group combat preserve old duel API.
- [ ] A single authoritative campaign state saves every committed transition, unfinished combat/construction/cooldowns, and claimed rewards to a versioned separate slot.
- [ ] Malformed saves and storage failures are visible; content references and impossible states are rejected or explicitly migrated.

## Connected first chapter

- [x] JSON defines eight distinct sites, three buildings with twelve branch upgrades, four villagers, eight work roles, ten enemies including a phased boss, six spells, fifteen item templates, six talents, five events, five research projects, four recipes, nine reward templates, six modifiers, five objectives, and seven milestones.
- [ ] Night two introduces generated threats, building damage, equipment, and an optional goal; night three opens exploration and recruitment; night four introduces specialization and later elite behavior; night five is a major assault; the boss completes the chapter.
- [ ] Banked permanent stock differs from unbanked attempt/expedition loot; settlement level follows upgrades and unlocks meaningful choices.
- [ ] Damaged structures retain upgrades, reduce efficiency, can be repaired, and visibly improve across branches.
- [ ] Hero XP/level growth, weapon/armor/focus slots, limited consumables, free pre-night loadout, later fire/arcane spells, and clear talent choice.
- [ ] Villager traits, injuries/recovery, long jobs/cancellation, specialization, and finite worker turn output influence decisions.
- [ ] Generated nights vary enemies, events, rewards, weather/modifiers, and objectives with readable counters and no wealth scaling.
- [ ] Defensive, ward-draining, support, summoner, retaliatory, and elemental enemies have visible readable intentions and resistances.
- [ ] Bell Warden uses the group model with readable phases, allies, ward pressure, and a retry path after failure.
- [ ] Map expeditions show risk, cost, likely reward, threat; short decisions/combat, secure versus unsecured loot, and retreat semantics work.
- [ ] Farm, watchpost, timber camp, shrine, roadside camp, crypt, bridge, and Oakhaven outskirts unlock gradually; secured sites change refuge opportunities within the turn economy.
- [ ] Research consumes banked stock/time and unlocks concrete recipes/spells/options; crafting creates usable finite items.
- [ ] Milestones depend on objectives, not only night count; story appears through scene, survivors, and locations without exposition blocks.
- [ ] Optional goals never gate chapter progress; no required resource relies on rare gear/events; losses never create a deadlock.

## Required verification

- [ ] Unit tests: turn cost/production, assignments, construction, insufficient stock, invalid/dead target, status expiry, cooldowns, hero/ward defeat, retreat, and recovery.
- [ ] Unit tests: duplicate input/reward prevention; reload during preparation, combat, construction, expedition, reward, recovery, and milestone transitions.
- [ ] Unit tests: economy exploits from resting, reassignment, retries, expedition retreat, cancellation, and save reload.
- [ ] First-night deterministic simulation of at least 1,000 seeds: valid encounters, required resources, no deadlock, reproducibility, at least 90% success for a reasonable strategy, tactical improvement over attack-only.
- [ ] Multi-night chapter simulations across aggressive, defensive, production, magic, exploration-heavy, and conservative priorities; track progression resources, structures, hero/villagers/items, failures, retreats, boss attempts, dominant and unused options.
- [ ] Two or more viable boss preparation strategies and meaningful value from settlement improvement without trivializing early enemies.
- [ ] Independent Sol review of complete brief, including visual/accessibility pass and icon legibility.
- [ ] `npm run content:check`, `npm test`, explicit web/core lint, type checks, and builds pass.
