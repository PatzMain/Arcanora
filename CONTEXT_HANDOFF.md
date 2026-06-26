# Arcanora — Context Handoff

> **Purpose**: This file provides full project context so the next AI assistant can work on this codebase without needing to explore every file. **You MUST update this file whenever you add, remove, or significantly change any file, feature, or data.**

> **Git**: This file is listed in `.gitignore` and should never be committed.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack & Tooling](#tech-stack--tooling)
3. [Directory Structure](#directory-structure)
4. [Entry Point & Boot Sequence](#entry-point--boot-sequence)
5. [Database Layer](#database-layer)
6. [Command System](#command-system)
7. [Registry & Modularity System](#registry--modularity-system)
8. [Game Systems](#game-systems)
9. [Economy System](#economy-system)
10. [Utility Modules](#utility-modules)
11. [Events](#events)
12. [Static Game Data (JSON)](#static-game-data-json)
13. [Tests](#tests)
14. [Deployment](#deployment)
15. [Known Conventions & Rules](#known-conventions--rules)
16. [Recent Changes Log](#recent-changes-log)

---

## Project Overview

**Arcanora** is a Discord MMORPG bot. Players interact entirely through Discord slash commands to explore zones, fight enemies, craft items, complete quests, manage guilds, and progress through a class-based RPG system. The bot uses a PostgreSQL database via Drizzle ORM and is deployed on Railway.

**Key gameplay loop**: Onboard via `/tutorial` → Choose class → Explore world via `/map` → Enter node-based dungeon runs → Fight enemies → Loot items → Craft gear → Level up via EXP (earned from quests & combat) → Earn achievements → Join guilds → Fight bosses.

> **Architecture Philosophy — Modular & Scalable by Design**:
> Arcanora is built on a **registry-driven, data-first architecture**. Game content (enemies, items, quests, locations, recipes, pets, achievements, classes) lives in `data/` JSON files loaded into registries at startup. Behavior overrides (item use, skills, achievements, shops, dungeon nodes) plug in via Registry singletons. The database schema is Drizzle ORM-driven — new tables/columns are added via migrations. Slash commands are **statically imported** in `src/events/ready.ts` and registered globally on boot. New content should be added as JSON + optional registry hooks, not by editing engine internals.

---

## Tech Stack & Tooling

| Component      | Technology                         |
|----------------|------------------------------------|
| Runtime        | Node.js ≥ 20 (ESM)                |
| Language       | TypeScript 5.7 (strict mode)      |
| Discord API    | discord.js v14.16                  |
| Database       | PostgreSQL via Drizzle ORM 0.36    |
| Migrations     | drizzle-kit 0.30                   |
| Validation     | Zod 3.24 (dependency; not yet used in `src/`) |
| Logging        | Pino 8.21                         |
| Caching        | node-cache 5.1 (wrapper exists; not imported elsewhere) |
| Scheduling     | node-cron 3.0 (dependency; not yet used in `src/`) |
| Bundler        | tsup 8.3 (ESM output)             |
| Testing        | Vitest 1.6                        |
| Linting        | ESLint 8.57 + `@typescript-eslint` |
| Dev server     | tsx (watch mode)                   |
| Hosting        | Railway (Nixpacks build)           |

### NPM Scripts

| Script     | Command                              | Purpose                    |
|------------|---------------------------------------|----------------------------|
| `dev`      | `tsx watch src/index.ts`              | Hot-reload development     |
| `build`    | `tsup src/index.ts --format esm --out-dir dist` | Production bundle  |
| `start`    | `node dist/index.js`                  | Run production build       |
| `migrate`  | `drizzle-kit migrate`                 | Run DB migrations          |
| `generate` | `drizzle-kit generate`                | Generate migration files   |
| `lint`     | `eslint src --ext .ts`                | Lint source files          |
| `test`     | `npm run lint && tsc --noEmit && npm run build && vitest run` | Full validation pipeline |

### Environment Variables (`.env`)

| Variable            | Purpose                           |
|---------------------|-----------------------------------|
| `DISCORD_TOKEN`     | Bot authentication token (required) |
| `DISCORD_CLIENT_ID` | Application client ID (fallback for command registration) |
| `DATABASE_URL`      | PostgreSQL connection string (required) |
| `NODE_ENV`          | Environment (production/dev)      |
| `LOG_LEVEL`         | Pino log level                    |
| `DB_POOL_MIN`       | Min DB pool connections (default 2) |
| `DB_POOL_MAX`       | Max DB pool connections (default 10) |
| `CACHE_TTL_SECONDS` | Cache TTL for `utils/cache.ts` (default 300) |

---

## Directory Structure

```
Discord Bot/
├── .eslintrc.json            # ESLint config
├── .gitignore                # Git exclusions (includes this file)
├── CONTEXT_HANDOFF.md        # THIS FILE — AI context handoff
├── drizzle.config.ts         # Drizzle ORM configuration
├── nixpacks.toml             # Nixpacks deployment configuration
├── package.json              # Dependencies and scripts
├── railway.json              # Railway deployment config
├── tsconfig.json             # TypeScript compiler config
│
├── data/                     # Static game data (one JSON file per entity)
│   ├── achievements/         # e.g. ach_kills_10.json
│   ├── classes/              # e.g. warrior.json (5 classes; novice is default, no file)
│   ├── enemies/              # e.g. wild_boar.json
│   ├── items/                # e.g. weapon_wooden_sword.json
│   ├── locations/            # e.g. verdant_meadows.json (zones + dungeons)
│   ├── pets/                 # e.g. pet_forest_pixie.json
│   ├── quests/               # e.g. story_01_begin.json
│   └── recipes/              # e.g. recipe_rejuvenation.json
│
├── src/
│   ├── index.ts              # Entry point — client init, event binding, shutdown
│   │
│   ├── commands/             # Slash command handlers (one .ts file per command)
│   │   ├── admin/            # /admin
│   │   ├── combat/           # /combat, /boss
│   │   ├── crafting/         # /craft
│   │   ├── economy/          # /economy (balance, shop, buy)
│   │   ├── guilds/           # /guild
│   │   ├── inventory/        # /inventory
│   │   ├── pets/             # /pet
│   │   ├── player/           # /player, /tutorial, /help, /invite, /map, /reset, /feedback, /rest
│   │   └── quests/           # /quest (includes daily rewards)
│   │
│   ├── database/
│   │   ├── client.ts         # pg Pool + Drizzle instance
│   │   ├── schema.ts         # All table definitions + relations
│   │   ├── migrations/       # Generated migration SQL (0000–0007)
│   │   └── queries/
│   │       ├── player.ts     # Player CRUD, stamina, leaderboard, EXP
│   │       ├── inventory.ts  # Inventory & equipment
│   │       ├── guild.ts      # Guild CRUD
│   │       ├── quest.ts      # Quest progress
│   │       ├── exploration.ts # Dungeon run sessions
│   │       └── worldQueries.ts # World map discovery tracking
│   │
│   ├── economy/
│   │   ├── antiInflation.ts  # Enhancement/repair/durability fee helpers
│   │   ├── currency.ts       # Gold/gem award, deduct, transfer, balance
│   │   ├── shop.ts           # NPC shop buy/sell logic
│   │   └── shopRegistry.ts   # Shop listing overrides registry
│   │
│   ├── events/
│   │   ├── error.ts          # Global error handler
│   │   ├── interactionCreate.ts  # Command router + component handlers
│   │   └── ready.ts          # Bot ready + slash command registration
│   │
│   ├── systems/
│   │   ├── achievements.ts   # Achievement evaluators (achievementEvaluatorRegistry)
│   │   ├── bosses.ts         # World boss HP scaling & reward formulas
│   │   ├── classes.ts        # Class modifier application (data from JSON)
│   │   ├── crafting.ts       # Crafting logic & quality rolls
│   │   ├── pets.ts           # Pet stat scaling from catalog
│   │   ├── combat/
│   │   │   ├── engine.ts     # Damage, dodge, flee, turn resolution
│   │   │   ├── enemy.ts      # Enemy loading & scaling
│   │   │   ├── handler.ts    # Combat button interactions & session flow
│   │   │   ├── skills.ts     # Skill definitions + skillBehaviorRegistry
│   │   │   └── presets.ts    # Preset combo turn execution helpers
│   │   ├── exploration/
│   │   │   ├── zones.ts      # Zone loading & random encounters
│   │   │   ├── worldExplorer.ts # World map travel, explore, and hunt actions
│   │   │   ├── dungeonGenerator.ts # Procedural DAG dungeon maps
│   │   │   ├── dungeonInteractions.ts # dungeonNodeRegistry + node handlers
│   │   │   └── loot.ts       # Treasure loot generation
│   │   ├── items/
│   │   │   └── itemBehavior.ts # itemBehaviorRegistry
│   │   └── progression/
│   │       ├── leveling.ts   # XP tables, stat growth, level-up checks
│   │       ├── questSystem.ts # Story quest chain & reward validation
│   │       ├── stats.ts      # computeStats pipeline
│   │       └── prestige.ts   # Prestige eligibility & bonuses
│   │
│   └── utils/
│       ├── cache.ts          # NodeCache wrapper (exported but unused elsewhere)
│       ├── catalog.ts        # JSON loading + registries + backward-compat Proxies
│       ├── cooldown.ts       # DB-backed per-action cooldowns
│       ├── embeds.ts         # Discord embed builders (all game UIs)
│       ├── emojis.ts         # Custom emoji asset manager & cache
│       ├── logger.ts         # Pino logger instance
│       ├── navigation.ts     # Pagination, button rows, select menus
│       ├── random.ts         # Weighted random, roll, shuffle helpers
│       ├── rateLimit.ts      # Per-user in-memory rate limiting
│       └── registry.ts       # Generic Registry class
│
└── tests/                    # Vitest test files (72 tests total)
    ├── combat.test.ts
    ├── dungeon.test.ts
    ├── economy.test.ts
    ├── leveling.test.ts
    ├── presets.test.ts
    ├── progression.test.ts
    ├── registry.test.ts
    ├── stats.test.ts
    ├── utils.test.ts
    └── worldMap.test.ts
```

---

## Entry Point & Boot Sequence

**File**: `src/index.ts`

1. Loads `dotenv/config` for environment variables
2. Validates `DISCORD_TOKEN` and `DATABASE_URL` before login
3. Creates Discord `Client` with `Guilds` and `GuildMessages` intents
4. Binds events: `ready` → registers slash commands & loads custom emojis; `interactionCreate` → routes commands/components
5. Sets up global error handlers (`errorEvent`, `unhandledRejection`, `uncaughtException`)
6. Graceful shutdown on `SIGINT`/`SIGTERM` — destroys client, closes DB pool
7. Calls `client.login(DISCORD_TOKEN)`

---

## Database Layer

### Client (`src/database/client.ts`)

- Creates a `pg.Pool` using `DATABASE_URL` with configurable min/max (`DB_POOL_MIN`, `DB_POOL_MAX`)
- Exports `pool` (raw pg Pool) and `db` (Drizzle instance with schema relations)

### Schema (`src/database/schema.ts`)

| Table (Export) | Table Name | Primary Key | Key Columns / Purpose |
|---|---|---|---|
| `players` | `players` | `id` (uuid) | discordId, username, level, exp, gold, gems, prestige, playerClass, hpCurrent, manaCurrent, currentZoneId, totalKills, totalQuestsCompleted, **presets** (JSONB), stamina, staminaMax, lastStaminaRegen, createdAt, lastSeen |
| `playerStats` | `player_stats` | `playerId` (FK) | hpMax, manaMax, attack, defense, critChance, critDmg, speed, luck |
| `inventory` | `inventory` | `id` (uuid) | playerId, itemId, quantity, durability, enhancement (also pet level), equipped, acquiredAt |
| `playerEquipment` | `player_equipment` | `playerId` (FK) | weapon, helmet, chest, gloves, boots, accessory, pet (FK → inventory.id) |
| `cooldowns` | `cooldowns` | Composite | playerId + action, expiresAt |
| `combatSessions` | `combat_sessions` | `id` (uuid) | playerId (unique), enemyId, zoneId, state (JSONB), messageId, channelId, **expiresAt** |
| `playerQuests` | `player_quests` | `id` (uuid) | playerId, questId, progress (JSONB), startedAt, completedAt |
| `guilds` | `guilds` | `id` (uuid) | name, level, exp, treasury, leaderId, createdAt |
| `guildMembers` | `guild_members` | Composite | guildId + playerId, rank, joinedAt |
| `transactions` | `transactions` | `id` (uuid) | playerId, type, amount, currency, description, createdAt |
| `worldBosses` | `world_bosses` | `id` (uuid) | bossId, hpCurrent, hpMax, spawnedAt, defeatedAt, channelId, messageId |
| `bossParticipants` | `boss_participants` | Composite | bossInstanceId + playerId, damageDealt |
| `playerAchievements` | `player_achievements` | `id` (uuid) | playerId + achievementId (unique), unlockedAt |
| `dailyLogins` | `daily_logins` | `playerId` (FK) | streak, lastClaim |
| `playerSkills` | `player_skills` | `id` (uuid) | playerId, skillId, level |
| `explorationSessions` | `exploration_sessions` | `id` (uuid) | playerId (FK), channelId, zoneId, currentNodeId, previousNodeId, party (JSONB), mapState (JSONB), createdAt, updatedAt |
| `playerWorldDiscoveries` | `player_world_discoveries` | `id` (uuid) | playerId + locationId (unique), discoveredAt |
| `customAssets` | `custom_assets` | `id` (varchar) | type, emoji, createdAt, updatedAt (custom emoji overrides) |
| `feedbacks` | `feedbacks` | `id` (uuid) | playerId (FK), username, category, content, status, createdAt (feedback system) |

**Important schema details**:
- `players.currentZoneId` defaults to `'verdant_meadows'`
- `players.presets` stores 3 named preset combos (default: P1=`['attack']`, P2/P3 empty)
- `players.stamina` regens passively: **+1 stamina every 5 minutes** (via `getAndUpdatePlayerStamina`)
- Cascade deletes configured on `players.id` relationships
- Combat sessions expire after **10 minutes** (`expiresAt`)
- `exploration_sessions.playerId` is **not** unique — enforce one active run in application logic

### Queries (`src/database/queries/`)

| Module | Key Exports |
|---|---|
| `player.ts` | `findOrCreatePlayer`, `getPlayerByDiscordId`, `updatePlayerLevel`, `updateLastSeen`, `getLeaderboard`, `incrementKills`, `incrementQuestsCompleted`, `getPlayerWithClampedStats`, `getAndUpdatePlayerStamina`, `deductPlayerStamina`, `replenishPlayerStamina`, `awardPlayerExp` |
| `inventory.ts` | `addItem`, `removeItem`, `getPlayerInventory`, `getEquippedItems`, `equipItem`, `unequipItem`, `updateDurability`, `updateEnhancement` |
| `guild.ts` | `createGuild`, `getGuildByName`, `getPlayerGuild`, `addMember`, `removeMember`, `getGuildMembers`, `updateTreasury`, `getGuildLeaderboard` |
| `quest.ts` | `startQuest`, `getActiveQuests`, `updateQuestProgress`, `completeQuest`, `getCompletedQuests` |
| `exploration.ts` | `createExplorationSession`, `getExplorationSessionByPlayerId`, `updateExplorationSession`, `deleteExplorationSession` |
| `worldQueries.ts` | `discoverLocation`, `getPlayerDiscoveredLocations`, `isLocationDiscovered` |

**Not in `queries/` — lives elsewhere**:
- **Currency** (`src/economy/currency.ts`): `awardGold`, `deductGold`, `awardGems`, `deductGems`, `getBalance`, `transferGold`
- **Combat sessions**: CRUD done inline in `src/commands/combat/combat.ts`, `src/systems/combat/handler.ts`, `src/systems/exploration/dungeonInteractions.ts`, and `src/systems/exploration/worldExplorer.ts` via direct Drizzle calls on `combatSessions`
- **Pets**: No dedicated query module — pet data from `petsCatalog`, pet level stored in `inventory.enhancement`, logic in `src/commands/pets/pet.ts` and `src/systems/pets.ts`
- **Daily login**: Handled inline in `src/commands/quests/quest.ts` using `dailyLogins` table
- **Custom Assets & Emojis** (`src/utils/emojis.ts`): Centrally handles in-memory preloading of emoji overrides on startup and manages entries inside the `custom_assets` table.

---

## Command System

Commands are organized by category folder. Each command file exports:
- `data`: `SlashCommandBuilder` definition
- `execute(interaction)`: Handler function

### Command Registration (`src/events/ready.ts`)

- Commands are **statically imported** into `commandsList` (17 commands)
- On `ready`, custom asset emojis are preloaded into memory (`initEmojis`)
- Stale **guild-level** commands are cleared from every guild on startup
- Global slash commands registered via REST using `client.user.id` (falls back to `DISCORD_CLIENT_ID`)
- **To add a new command**: create the file under `src/commands/` **and** add a static import + entry in `commandsList` in `ready.ts`

### Command Router (`src/events/interactionCreate.ts`)

- Looks up slash commands from `commandsList` by name
- Enforces **rate limits** globally: 5 actions / 10 seconds per user (`rateLimit.ts`)
- **Profile guard**: All commands except `/tutorial`, `/invite`, `/help`, and modal routing require an existing player profile (`getPlayerWithClampedStats`)
- **Action cooldowns** (e.g. rest) are enforced per-command, not in the router (`cooldown.ts` used in `/rest`)
- Routes component interactions by `customId` prefix:

| `customId` Prefix | Handler | File | Description |
|---|---|---|---|
| `combat_` | `handleCombatInteraction` | `systems/combat/handler.ts` | Combat actions, presets, flee, hunt |
| `shop_` | `handleShopInteraction` | `commands/economy/economy.ts` | Shop browse/buy/sell |
| `tutorial_` | `handleTutorialInteraction` | `commands/player/tutorial.ts` | Class selection (select menu) |
| `nav_` | `handleNavInteraction` | `utils/navigation.ts` | Generic pagination |
| `bag_` | `handleBagInteraction` | `commands/inventory/inventory.ts` | Inventory pages |
| `equip_select_` | `handleEquipInteraction` | `commands/inventory/inventory.ts` | Equip from select menu |
| `sell_select_` | `handleSellInteraction` | `commands/inventory/inventory.ts` | Sell from select menu |
| `quests_` | `handleQuestsInteraction` | `commands/quests/quest.ts` | Quest display/navigation |
| `quests_board_select_` | `handleQuestsBoardSelect` | `commands/quests/quest.ts` | Accept quest from board |
| `prestige_` | `handlePrestigeInteraction` | `commands/player/player.ts` | Prestige confirm/cancel |
| `guild_` | `handleGuildInteraction` | `commands/guilds/guild.ts` | Guild actions |
| `leaderboard_` | `handleLeaderboardInteraction` | `commands/guilds/guild.ts` | Leaderboard navigation |
| `map_travel_` | `handleMapTravelInteraction` | `commands/player/map.ts` | Zone travel confirmation & resting |
| `map_world_` | `handleWorldMapInteraction` | `commands/player/map.ts` | World map travel, scouting, inspecting |
| `map_enter_dungeon_` / `dungeon_` | `handleDungeonInteraction` | `commands/player/map.ts` | Dungeon run navigation |
| `player_preset_` | `handlePresetInteraction` | `commands/player/player.ts` | Preset config (buttons + modals) |
| `admin_` | `handleAdminInteraction` | `commands/admin/admin.ts` | Admin list page navigation |
| `feedback_submit_` | `handleFeedbackModal` | `commands/player/feedback.ts` | Saves player feedback modal submission |

### Command Reference

| Command | Subcommands / Parameters | Description |
|---|---|---|
| `/admin` | `give-item`, `spawn-boss`, `spawn-global-boss`, `asset-set`, `asset-remove`, `asset-list`, `feedback-list`, `feedback-resolve` | Admin operations: items, boss raids, custom assets, and player feedback |
| `/boss` | `info`, `fight` | World boss raid combat |
| `/combat` | `explore`, `fight` | Zone exploration encounters or resume combat |
| `/craft` | `recipe` (optional) | Crafting menu or craft specific recipe |
| `/economy` | `balance`, `shop`, `buy` | View currency, browse shop, buy items |
| `/feedback` | (none) | Submit suggestions, bug reports, or general feedback via modal |
| `/guild` | `info`, `create`, `join`, `leave`, `kick`, `leaderboard` | Guild management |
| `/inventory` | `bag`, `equip`, `sell` | View bag, equip gear, sell to shop |
| `/pet` | `info`, `level`, `release` | Pet stats, training, release |
| `/help` | (none) | Command & system help |
| `/invite` | (none) | Bot invite link |
| `/map` | (none) | World map: travel, scout (Explore), fight (Hunt), inspect location, and dungeon crawls |
| `/player` | `profile`, `stats`, `preset`, `prestige` | Character card, attributes, presets, prestige |
| `/quest` | `active`, `board`, `accept`, `daily` | Quest tracking, board, accept, daily login reward |
| `/reset` | (none) | Delete character (with confirmation) |
| `/rest` | (none) | Rest at a nearby inn or settlement (Cozy Tavern / Verdant Outpost) to fully restore HP, Mana, and Stamina |
| `/tutorial` | (none) | Onboarding, class selection, starter gear |

---

## Registry & Modularity System

Arcanora uses a generic **Registry** class (`src/utils/registry.ts`) for dynamic assets, overrides, and behavior hooks.

### Static Catalogs (`src/utils/catalog.ts`)

At module load, JSON files from `data/<category>/` are scanned and registered by `id`:

- `itemsRegistry`, `enemiesRegistry`, `zonesRegistry` (from `data/locations/`), `recipesRegistry`, `questsRegistry`, `petsRegistry`, `achievementsRegistry`, `classesRegistry`

Backward-compatible Array Proxies: `itemsCatalog`, `enemiesCatalog`, `zonesCatalog`, etc.

### Custom Behavior Hooks

1. **Items** (`itemBehaviorRegistry` in `systems/items/itemBehavior.ts`): Custom `onUse(context)` hooks; falls back to standard stat boosts.
2. **Skills** (`skillsRegistry` + `skillBehaviorRegistry` in `systems/combat/skills.ts`): Built-in skills registered at load; custom `execute()` overrides via `skillBehaviorRegistry`.
3. **Achievements** (`achievementEvaluatorRegistry` in `systems/achievements.ts`): Default evaluators for `kills`, `level`, `gold`, `quests`, `prestige`, `guild`. Register additional types for JSON condition types like `gold_earned`, `items_crafted`, etc.
4. **Shops** (`shopRegistry` in `economy/shopRegistry.ts`): Override buy/sell prices, level reqs, availability conditions.
5. **Dungeon Nodes** (`dungeonNodeRegistry` in `systems/exploration/dungeonInteractions.ts`): Handlers for `campsite`, `treasure`, `merchant`, `event`, `room`, `elite`, `boss`. (Note: puzzle/riddle handler has been removed).

### Scalability Cheatsheet

| What you want to add | How to do it |
|---|---|
| New enemy | JSON in `data/enemies/` |
| New item | JSON in `data/items/` |
| New quest | JSON in `data/quests/` |
| New location/zone | JSON in `data/locations/` |
| New recipe | JSON in `data/recipes/` |
| New class | JSON in `data/classes/` |
| New item behavior | Register in `itemBehaviorRegistry` |
| New skill | Register in `skillsRegistry` / `skillBehaviorRegistry` |
| New achievement trigger | Register evaluator in `achievementEvaluatorRegistry` (match JSON `condition.type`) |
| New shop override | Register in `shopRegistry` |
| New dungeon node type | Register in `dungeonNodeRegistry` |
| New slash command | Add file + import in `ready.ts` |

---

## Game Systems

### Classes (`src/systems/classes.ts`)

- Loaded from `data/classes/*.json` (warrior, mage, rogue, ranger, healer)
- **`novice`** is the default class with no JSON file and no modifiers
- Class selection unlocks at **level 5** (`CLASS_UNLOCK_LEVEL`); reroll costs **50 gems**
- Modifiers are percent-based: `stat * (1 + modifier)` applied to all 8 stat keys
- Example — **warrior**: +20% HP, +15% ATK, +10% DEF, −10% Mana, −5% Speed

### Combat Engine (`src/systems/combat/engine.ts`)

- **Damage**: `max(1, attack - defense/2) * variance(0.85–1.15)`; crit multiplies by `critDmg / 100`
- **Dodge**: `5 + (defenderSpeed - attackerSpeed) * 0.5`, clamped 0–30%
- **Flee**: `30 + playerSpeed * 0.5`%, capped at 90%
- Sessions stored in `combat_sessions` with 10-minute `expiresAt`
- Preset combos execute **one action per combat round** (modulo wrapping) via `presets.ts`
- Combat state tracks combat source (e.g. `hunt`).

### Enemy System (`src/systems/combat/enemy.ts`)

- Loaded from `data/enemies/` via `enemiesCatalog`
- `scaleEnemyStats`: +5% HP/ATK/DEF per level above enemy base level; speed rounded to nearest 10 (not scaled)
- AI: heals when enemy HP < 30%; prioritizes damage when player HP < 30%

### Stat Computation (`src/systems/progression/stats.ts`)

`computeStats(level, prestige, className, equippedItems, petStats, activeBuffs)`:
1. Base stats from `getStatGrowth(level)` — multiples of 10
2. Class percent modifiers
3. Flat equipment bonuses
4. Pet passive bonuses
5. Prestige multiplier (+5% per prestige level via `prestige.ts`)
6. Active buffs (flat + percent)
7. Round all final stats to nearest multiple of 10

### Leveling (`leveling.ts` + `questSystem.ts` + `queries/player.ts`)

- **`MAX_LEVEL = 20`**
- **Experience-Based Progression**: Players earn EXP from completing quests and defeating enemies in combat.
- **Level-Up Processing**: When a player receives EXP, `awardPlayerExp` updates the player's total EXP, checks the `XP_TABLE` (defined as `100 * 1.5^(N-2)` for level N), and processes level-ups.
- **Full Restoration**: On leveling up, the player's HP and Mana are fully restored.
- **Story Quests**: Completing a story quest awards a significant amount of EXP (scaling to the amount needed for the next level) and auto-starts the next quest in `STORY_QUEST_ORDER` (19 quests: `story_01_begin` → `story_19_nameless_defeat`).
- Base stat growth (multiples of 10):
  - `hpMax: 60 + 20 * level` (Lv1: 80, Lv20: 460)
  - `manaMax: 30 + 10 * level` (Lv1: 40, Lv20: 230)
  - `attack / defense / speed / luck: 10 * level` (Lv1: 10, Lv20: 200)
- Skill points: 1 every 2 levels starting at level 2

### Exploration & Dungeons

**Zones** (`systems/exploration/zones.ts`):
- Loaded from `data/locations/` via `zonesCatalog`
- Weighted encounters: normal_mob, rare_mob, boss, treasure, empty

**World Map** (`systems/exploration/worldExplorer.ts` + `worldQueries.ts`):
- Fog-of-war discovery tracked in `player_world_discoveries`
- Travel updates `players.currentZoneId`
- **Travel Stamina Cost**: Traveling between adjacent discovered locations costs **1 stamina** (reduced from 10).
- **Exploring**: `/map` Explore button costs **2 stamina**. It never triggers combat. Instead, it rolls for path discovery, resource gathering, chest/gold, or empty scouting.
- **Hunting**: `/map` Hunt button costs **5 stamina**. It always triggers a combat encounter with a random enemy from the zone's enemy list. (Note: riddle/puzzle events have been removed from exploration outcomes).

**Dungeon Runs** (`dungeonGenerator.ts` + `dungeonInteractions.ts` + `map.ts`):
- Procedural DAG maps; layer count by zone: verdant_meadows=5, shadow_forest=6, crystal_caverns=7, volcanic_wastes=8, abyssal_depths=9
- Node movement costs **10 stamina**; fog-of-war visibility in `mapState`
- Node handlers registered in `dungeonNodeRegistry` (puzzle nodes have been removed)
- Defeat revives player at Cozy Tavern; flee backtracks; victory clears node

**Resting & Cozy Tavern / Outposts**:
- Cozy Tavern and Verdant Outpost have `hasRestBed: true` in their configuration.
- Players can use the `/rest` command or rest buttons when in these locations to fully restore HP, Mana, and Stamina.
- Rest command has a **2-minute cooldown** tracked in the database.

### Crafting (`src/systems/crafting.ts`)

- Recipes from `data/recipes/` via `recipesCatalog`
- Failure: materials lost, 20% pity EXP
- Success quality: Normal (~70%), Quality (~25%), Perfect (~5%); luck shifts toward higher tiers
- Perfect quality: **1.5× yield** (rounded up), not double

### Pets (`src/systems/pets.ts`)

- Definitions from `data/pets/`; level stored in `inventory.enhancement`
- Stats: `base * (1 + (level - 1) * 0.1)` (+10% per level)
- Training cost: `200 * currentLevel` gold

### Achievements (`src/systems/achievements.ts`)

**JSON condition types** (in `data/achievements/`): `kills`, `level`, `gold_earned`, `quests_completed`, `prestige`, `guild_joined`, `items_crafted`, `bosses_defeated`

**Registered evaluators** (must match JSON `condition.type` to work): `kills`, `level`, `gold`, `quests`, `prestige`, `guild`

> **Known gap**: JSON types `gold_earned`, `quests_completed`, `guild_joined`, `items_crafted`, `bosses_defeated` need evaluators registered (or JSON types renamed) — currently only `kills`, `level`, and `prestige` work out of the box.

### Bosses (`src/systems/bosses.ts`)

- **Local boss HP**: `baseHp * (1 + serverMemberCount * 0.1)`, min 10,000
- **Global boss HP**: `baseHp * 16` (simulates 150 participants), min 80,000; 1.5× attack damage
- Rewards proportional to damage; top contributor gets 2× multiplier

---

## Economy System

### Currency (`src/economy/currency.ts`)

- Gold/gems stored as `bigint` in schema, accessed as JS `number`
- All operations run in DB transactions with atomic SQL increments
- Every award/deduct logged to `transactions` table

### NPC Shop (`src/economy/shop.ts`)

- Buy price from item JSON `buyPrice` (overridable via `shopRegistry`)
- Sell price from item JSON `sellPrice` field (overridable via `shopRegistry`) — **not** a fixed 40% of buy price
- Sell via `/inventory sell`; buy via `/economy buy` or shop UI buttons

### Anti-Inflation (`src/economy/antiInflation.ts`)

Helper functions (not all wired to commands yet):
- Enhancement cost: `baseCost * (currentEnhancement + 1) ^ 1.5`
- Enhancement success: 95% at +0 down to 5% at +9 (max +10)
- Durability loss: `max(1, floor(combatRounds / 3))`
- Auction listing fee: 5% of sale price
- Guild dues formula: `100 * guildLevel` gold per member per week

---

## Utility Modules

### Embeds (`src/utils/embeds.ts`)
Rich embed factories with HP/mana/progress bars and rarity color templates. Features customized, themed visual bars (HP: 🟥, Mana: 🟦, Stamina: 🟪, Exp: 🟨, Pet: 🟩) and clean title headers.

### Navigation (`src/utils/navigation.ts`)
Pagination buttons, user verification (only command invoker can interact), dynamic command imports for routing. Offers quick action triggers like "Explore Again" and "Hunt Again".

### Catalog (`src/utils/catalog.ts`)
Loads all JSON from `data/` subdirectories at startup; single source of truth for static game data.

### Cooldown (`src/utils/cooldown.ts`)
DB-backed per-player action cooldowns (`checkCooldown`, `setCooldown`).

### Rate Limit (`src/utils/rateLimit.ts`)
In-memory 5 actions / 10 seconds per Discord user ID.

### Custom Assets & Emojis (`src/utils/emojis.ts`)
Facilitates caching database-configured custom emojis for game elements. Provides helper methods (`getItemEmoji`, `getClassEmoji`, `getPetEmoji`, `getAchievementEmoji`, `getCurrencyEmoji`) that automatically fall back to standard emojis if no custom asset is defined.

### Registry (`src/utils/registry.ts`)
Generic Registry class for behavior hook overrides.

---

## Events

| File | Trigger | Purpose |
|---|---|---|
| `events/ready.ts` | `client.once('ready')` | Log in, preload custom emojis, clear stale guild commands, register global slash commands |
| `events/interactionCreate.ts` | `interactionCreate` | Route slash commands, buttons, select menus, modal submissions |
| `events/error.ts` | `client.on('error')` | Log Discord client errors |

---

## Static Game Data (JSON)

Each entity is a standalone JSON file with an `"id"` field. Loaded by `catalog.ts` at startup.

### Locations (`data/locations/`)

| ID | Display Name | Levels | Cooldown | Notes |
|---|---|---|---|---|
| `cozy_tavern` | Cozy Tavern | 1–100 | 0s | Rest/recovery hub (`hasRestBed: true`) |
| `verdant_meadows` | Verdant Outpost | 1–3 | 60s | Starting zone; dungeon depth 5 (`hasRestBed: true`) |
| `shadow_forest` | Whispering Canopy | 3–6 | 90s | Dungeon depth 6 |
| `goblin_sanctuary` | Fallen Watchtower | 3–6 | 120s | `isDungeon: true` |
| `crystal_caverns` | Glittering Depths | 6–10 | 120s | Dungeon depth 7 |
| `ancient_mine` | Forgotten Mines | 9–11 | 150s | `isDungeon: true` |
| `volcanic_wastes` | Volcanic Wastes | 10–15 | 150s | Dungeon depth 8 |
| `lava_keep` | Lava Keep | 10–15 | 180s | `isDungeon: true` |
| `abyssal_depths` | Abyssal Depths | 15–20 | 180s | Endgame; dungeon depth 9 |
| `sunken_temple` | Sunken Temple | 15–20 | 180s | `isDungeon: true` |

---

## Tests

10 test files, **72 tests** total. Run via `npm test` (lint → tsc → vitest).

| File | What It Tests |
|---|---|
| `combat.test.ts` | Damage, crit, dodge, flee formulas |
| `dungeon.test.ts` | Dungeon generator & node logic |
| `economy.test.ts` | Gold operations, fees |
| `leveling.test.ts` | XP table, level-up thresholds, XP check formulas |
| `presets.test.ts` | Preset combo turn execution |
| `progression.test.ts` | Story quest level-up flow |
| `registry.test.ts` | Registry class & behavior hooks |
| `stats.test.ts` | Stat growth, computeStats, enemy scaling |
| `utils.test.ts` | Random helpers, cooldown logic, custom progress bar emojis |
| `worldMap.test.ts` | World map discovery & travel |

---

## Deployment

- **Platform**: Railway (Nixpacks)
- **Start command**: `npm run migrate && node dist/index.js`
- **Replicas**: 1
- **Database**: PostgreSQL via `DATABASE_URL`
- **Build Cache**: `nixpacks.toml` caches dependency installs unless dependencies change.

---

## Known Conventions & Rules

1. **Modular First**: Command handlers delegate to system modules; system modules call query helpers or Drizzle directly.
2. **Registry Pattern**: New behaviors go through registries — don't hard-code item/enemy ID branches in engine code.
3. **Data-Driven Design**: Game values live in `data/` JSON; code reads from catalog registries.
4. **Stats are multiples of 10**: Base, enemy, and computed player stats round to nearest 10.
5. **ESM Imports**: Include `.js` extensions in import paths.
6. **Caps**: HP/mana clamped to max after equipment swaps or level-ups.
7. **Quest progress**: JSONB object keyed by requirement targets.
8. **New commands**: Add file **and** update `commandsList` in `ready.ts`.
9. **Achievement types**: JSON `condition.type` must match a registered evaluator key.
10. **Custom Asset Emojis**: Custom assets are loaded at boot. The visual output systems automatically check for these overrides using helper functions (`getItemEmoji`, etc.).

---

## Recent Changes Log

### 2026-06-24
- Split monolithic JSON into per-entity files under `data/` subdirectories
- Implemented generic `Registry` class and refactored `catalog.ts` with Proxy arrays
- Added registry hooks: items, skills, achievements, shops
- Restructured 19-quest linear story line (`story_01_begin` → `story_19_nameless_defeat`)
- Added `abyssal_kraken` enemy; enriched location descriptions

### 2026-06-25
- **Command Registration & OAuth2**: Prioritize `client.user.id`; clear stale guild commands on startup
- **Quest-Based Progression**: Level-ups only via story quests in `questSystem.ts`; crafting EXP doesn't level up
- **Global World Boss**: `/admin spawn-global-boss` with 16× HP scaling and 1.5× damage
- **Map Overhaul**: World map fog-of-war, travel select menus, Cozy Tavern rest, dungeon crawling UI
- **Preset Combos**: 3 named presets with turn-by-turn execution in combat and boss fights
- **Modular Stats & Classes**: `STAT_KEYS` pipeline; classes loaded from `data/classes/`
- **Dungeon System**: Stamina, `exploration_sessions`, procedural DAG generator, `dungeonNodeRegistry`
- **Test Pipeline**: `npm test` runs lint + tsc + build + vitest; 69 tests passing
- **CONTEXT_HANDOFF.md Audit**: Full rewrite to align with actual codebase (query layer, schema, command registration, locations, tests, known gaps)

### 2026-06-26
- **Experience-Based Leveling**: Refactored progression so player levels up via standard EXP (from combat and quest completion) rather than strictly hardcoded story quest completions. Fully heals player on level up.
- **Separate Explore and Hunt**: Split map exploration into a stamina-free (or low cost, 2 stamina) scout option (scouts resources, chests, discovery; never combat) and a hunt option (5 stamina, always spawns combat).
- **Travel Stamina Tuning**: Reduced node-to-node world map travel stamina cost from 10 to 1.
- **Rest System**: Added `/rest` command and map rest buttons for Cozy Tavern and Verdant Outpost to restore all HP/Mana/Stamina, subject to a 2-minute database-enforced cooldown.
- **Feedback System**: Added `/feedback` slash command that launches a Discord modal to capture player bugs and suggestions, saved to a new `feedbacks` table.
- **Custom Emoji Assets System**: Created `custom_assets` table and `emojis.ts` centralized caching system to allow administrators to map custom emojis to game entities (items, classes, achievements, etc.) via `/admin asset-set` / `/admin asset-remove` / `/admin asset-list`.
- **Riddle System Removal**: Completely removed the legacy riddle/puzzle system from both exploration outcomes and dungeon run nodes.
- **Embed Redesign & Aesthetic Upgrades**: Redesigned all main embed outputs (player profile, inventory, shop, combat victory, bosses, help, and guilds) to look cleaner, replacing double-hyphen dividers with polished headers, modern bars, and custom db-configured emoji overrides.
- **Vitest Suite Updates**: Updated and expanded test coverage (72 tests total passing).
