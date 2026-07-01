# Changelog

All notable changes to Arcanora are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

> Changes that are merged but not yet tagged as a release.

---

## [1.5.0] — 2026-07-01

### Added
- **Per-guild slash command registration** — commands now propagate instantly to all servers on bot restart, replacing the previous global registration which had up to a 1-hour delay
- **`README.md`** — professional project overview with features, tech stack, project structure, and getting started guide
- **`TEMPLATE.md`** — full deployment guide covering Discord app setup, env vars, local dev, PostgreSQL + Drizzle setup, Railway deployment, and a production checklist

### Fixed
- Some servers seeing stale slash commands after a deployment due to Discord's global command propagation delay

---

## [1.4.0] — 2026-07-01

### Added
- **`/play` command** — creates a private Discord thread per player; all gameplay is gated to this thread
- **`/stop` command** — deletes the player's active adventure thread and clears `activeThreadId` in the database
- **Global thread gate** — all gameplay commands (except `/play`, `/tutorial`, `/invite`, `/help`, `/admin`, `/stop`) require the player to be inside their registered thread
- **`activeThreadId` column** in the `players` table (`varchar(20)`, nullable) — tracks each player's active adventure thread

### Fixed
- Players being able to create duplicate adventure threads across different channels or servers

---

## [1.3.0] — 2026-06-30

### Added
- **Grid-based dungeon crawler** — procedurally generated 2D tile grid (`6×6`), arrow movement buttons, multi-floor scaling, and a final boss encounter
- **Pixel-art world map** — canvas-rendered map with location markers, path connections, fog-of-war, and player position ring using `@napi-rs/canvas`
- **Codex and Bestiary** (`/codex`) — auto-discovery tracking for enemies, items, and locations with pagination and detail views
- **Profile tabs** — `/player profile` split into Identity, Equipment, and Stats tabs with interactive navigation
- **Combat redesign** — side-by-side player vs enemy status grid, elemental weakness hints, status effect badges
- **Quest lore injection** — `narrative` blocks in quest JSON render NPC dialog on quest accept
- **Preset autoplay** — named combat presets execute turn-by-turn with a live progress footer
- **Co-op leaderboards** — real-time damage tracking displayed as a leaderboard on enemy defeat
- **E2E playthrough integration test** (`tests/playthrough.test.ts`) — zero-dependency in-memory Drizzle mock

### Fixed
- Dungeon routing mismatches for `room`, `elite`, and `boss` node types
- Preset slot index bug causing activation failures
- Map guard blocking `/map` while in active combat

---

## [1.2.0] — 2026-06-26

### Added
- **Experience-based leveling** — players level up via XP from combat and quest completion, with full heal on level-up
- **Separate explore and hunt** — `/map` explore scouts resources without combat (2 stamina); hunt always spawns combat (5 stamina)
- **`/rest` command** — restores all HP/Mana/Stamina at a rest location, with a 2-minute database-enforced cooldown
- **`/feedback` command** — Discord modal to capture player bugs and suggestions, saved to `feedbacks` table
- **Custom emoji asset system** — `custom_assets` table and `emojis.ts` cache; admins can map custom emojis via `/admin asset-set`
- **Embed redesign** — player profile, inventory, shop, combat, bosses, help, and guild embeds overhauled

### Removed
- Legacy riddle/puzzle system from exploration and dungeon nodes

### Changed
- World map travel stamina cost reduced from 10 → 1 per node

---

## [1.1.0] — 2026-06-25

### Added
- **Global World Boss** — `/admin spawn-global-boss` with 16× HP scaling and 1.5× damage
- **Preset combos** — 3 named presets with turn-by-turn execution in combat and boss fights
- **Dungeon system** — stamina-based exploration, `exploration_sessions` tracking, and procedural DAG generator
- **Modular stats and classes** — `STAT_KEYS` pipeline; classes loaded from `data/classes/`
- **Test pipeline** — `npm test` runs lint + tsc + vitest (69 tests)

### Fixed
- Command registration now prioritizes `client.user.id` over env fallback
- Stale guild-level commands cleared on startup to prevent conflicts with global commands

---

## [1.0.0] — 2026-06-24

### Added
- Initial release of Arcanora Discord MMORPG Bot
- Core game loop: `/tutorial` → choose class → explore via `/map` → fight enemies → loot → craft → level up → join guilds → fight bosses
- Commands: `/player`, `/combat`, `/boss`, `/inventory`, `/economy`, `/quest`, `/craft`, `/guild`, `/pet`, `/admin`, `/map`, `/reset`, `/help`, `/invite`
- PostgreSQL database via Drizzle ORM with full schema (players, stats, inventory, equipment, quests, guilds, bosses, cooldowns)
- Static game data in `data/` (items, enemies, quests, locations, classes, recipes, pets, achievements)
- Generic `Registry` class and `catalog.ts` with Proxy arrays for data-driven design
- 19-quest linear story line
- Rate limiting (5 actions / 10s per user)
- Vitest test suite

---

[Unreleased]: https://github.com/PatzMain/Arcanora/compare/v1.5.0...HEAD
[1.5.0]: https://github.com/PatzMain/Arcanora/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/PatzMain/Arcanora/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/PatzMain/Arcanora/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/PatzMain/Arcanora/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/PatzMain/Arcanora/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/PatzMain/Arcanora/releases/tag/v1.0.0
