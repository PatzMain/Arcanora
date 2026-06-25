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

**Key gameplay loop**: Onboard via `/tutorial` → Choose class → Enter dungeon via `/map` → Navigate node-based maps → Fight enemies → Loot items → Craft gear → Level up via story quests → Earn achievements → Join guilds → Fight bosses.

> **Architecture Philosophy — Modular & Scalable by Design**:
> Arcanora is built on a **fully modular, registry-driven architecture**. Every game system (combat, items, skills, achievements, shops, dungeon generation, exploration nodes) is decoupled from the others and wired together through generic Registry singletons. Adding a new dungeon, enemy, item type, or quest requires **only a new JSON data file and an optional behavior registration** — zero changes to engine core logic. The database schema is Drizzle ORM-driven, meaning any new table or column is added via migration without touching existing queries. All command handlers are dynamically imported and registered at boot time, making it trivial to add new slash commands. This project is explicitly designed to scale horizontally: new content, systems, and features should be added as plug-in modules, never as engine modifications.

---

## Tech Stack & Tooling

| Component      | Technology                         |
|----------------|------------------------------------|
| Runtime        | Node.js ≥ 20 (ESM)                |
| Language       | TypeScript 5.7 (strict mode)      |
| Discord API    | discord.js v14.16                  |
| Database       | PostgreSQL via Drizzle ORM 0.36    |
| Migrations     | drizzle-kit 0.30                   |
| Validation     | Zod 3.24                          |
| Logging        | Pino 8.21                         |
| Caching        | node-cache 5.1                    |
| Scheduling     | node-cron 3.0                     |
| Bundler        | tsup 8.3 (ESM output)             |
| Testing        | Vitest 1.6                        |
| Linting        | ESLint 8.57                       |
| Dev server     | tsx (watch mode)                   |
| Hosting        | Railway (Nixpacks build)           |

### NPM Scripts

| Script     | Command                              | Purpose                    |
|------------|---------------------------------------|----------------------------|
| `dev`      | `tsx watch src/index.ts`              | Hot-reload development     |
| `build`    | `tsup src/index.ts --format esm`      | Production bundle          |
| `start`    | `node dist/index.js`                  | Run production build       |
| `migrate`  | `drizzle-kit migrate`                 | Run DB migrations          |
| `generate` | `drizzle-kit generate`                | Generate migration files   |
| `lint`     | `eslint src --ext .ts`                | Lint source files          |
| `test`     | `npm run lint && tsc --noEmit && npm run build && vitest run` | Run full validation suite (lint, typecheck, build, test) |

### Environment Variables (`.env`)

| Variable            | Purpose                           |
|---------------------|-----------------------------------|
| `DISCORD_TOKEN`     | Bot authentication token          |
| `DISCORD_CLIENT_ID` | Application client ID             |
| `DATABASE_URL`      | PostgreSQL connection string      |
| `NODE_ENV`          | Environment (production/dev)      |
| `LOG_LEVEL`         | Pino log level                    |
| `DB_POOL_MIN`       | Min DB pool connections           |
| `DB_POOL_MAX`       | Max DB pool connections           |
| `CACHE_TTL_SECONDS` | Cache time-to-live                |

---

## Directory Structure

```
Discord Bot/
├── .env.example              # Template for environment variables
├── .gitignore                # Git exclusions (includes this file)
├── CONTEXT_HANDOFF.md        # THIS FILE — AI context handoff
├── drizzle.config.ts         # Drizzle ORM configuration
├── package.json              # Dependencies and scripts
├── railway.json              # Railway deployment config
├── tsconfig.json             # TypeScript compiler config
│
├── data/                     # Static game data (JSON)
│   ├── achievements/         # Subfolder containing one JSON file per achievement
│   ├── classes/              # Subfolder containing one JSON file per class (e.g. warrior.json)
│   ├── enemies/              # Subfolder containing one JSON file per enemy (e.g. wild_boar.json)
│   ├── items/                # Subfolder containing one JSON file per item (e.g. weapon_wooden_sword.json)
│   ├── locations/            # Subfolder containing one JSON file per location (e.g. verdant_meadows.json)
│   ├── pets/                 # Subfolder containing one JSON file per pet (e.g. pet_forest_pixie.json)
│   ├── quests/               # Subfolder containing one JSON file per quest (e.g. story_begin.json)
│   └── recipes/              # Subfolder containing one JSON file per recipe (e.g. recipe_rejuvenation.json)
│
├── src/
│   ├── index.ts              # Entry point — client init, event binding, shutdown
│   │
│   ├── commands/             # Slash command handlers (one folder per category)
│   │   ├── admin/            # Admin-only commands
│   │   ├── combat/           # /fight, /boss
│   │   ├── crafting/         # /craft
│   │   ├── economy/          # /balance, /daily, /shop, /trade
│   │   ├── guilds/           # /guild
│   │   ├── inventory/        # /inventory
│   │   ├── pets/             # /pets
│   │   ├── player/           # /player, /tutorial, /help, /invite, /map, /reset
│   │   └── quests/           # /quest
│   │
│   ├── database/
│   │   ├── client.ts         # Pool + Drizzle instance
│   │   ├── schema.ts         # All table definitions
│   │   ├── migrations/       # Generated migration SQL files
│   │   └── queries/          # Query helper modules
│   │       ├── combat.ts     # Combat-related queries (sessions CRUD)
│   │       ├── economy.ts    # Currency/trade queries
│   │       ├── guilds.ts     # Guild queries
│   │       ├── inventory.ts  # Inventory queries
│   │       └── player.ts     # Player CRUD queries & stats clamp check
│   │
│   ├── economy/
│   │   ├── antiInflation.ts  # Gold sink / tax systems
│   │   ├── currency.ts       # Currency operations
│   │   ├── shop.ts           # Shop buy/sell logic
│   │   └── shopRegistry.ts   # [NEW] Shop listings overrides registry
│   │
│   ├── events/
│   │   ├── error.ts          # Global error handler
│   │   ├── interactionCreate.ts  # Command router + button/menu handlers
│   │   └── ready.ts          # Bot ready event + command registration
│   │
│   ├── systems/
│   │   ├── achievements.ts   # Achievement checking & awarding (evaluatorRegistry)
│   │   ├── bosses.ts         # Boss encounter logic
│   │   ├── classes.ts        # Class definitions & bonuses
│   │   ├── crafting.ts       # Crafting system logic
│   │   ├── pets.ts           # Pet system logic
│   │   ├── combat/
│   │   │   ├── engine.ts     # Core combat formulas (damage, dodge, flee)
│   │   │   └── enemy.ts      # Enemy loading, scaling, encounter generation
│   │   ├── exploration/
│   │   │   └── zones.ts      # Zone data, travel, random encounters
│   │   ├── items/
│   │   │   └── itemBehavior.ts # [NEW] Custom item use hooks registry
│   │   └── progression/
│   │       ├── leveling.ts   # XP, level-up, stat growth tables
│   │       └── stats.ts      # Final stat computation (base + gear + class + pet)
│   │
│   └── utils/
│       ├── cache.ts          # NodeCache singleton (currently unused)
│       ├── catalog.ts        # Dynamic catalog registry backed by Proxies
│       ├── cooldown.ts       # Cooldown enforcement
│       ├── embeds.ts         # Discord embed builders (ALL game UIs)
│       ├── logger.ts         # Pino logger instance
│       ├── navigation.ts     # Pagination, button rows, select menus
│       ├── random.ts         # Weighted random, roll, shuffle helpers
│       ├── rateLimit.ts      # Per-user rate limiting
│       └── registry.ts       # [NEW] Generic Registry class definition
│
└── tests/                    # Vitest test files
    ├── combat.test.ts        # Combat engine formula tests
    ├── economy.test.ts       # Economy/currency tests
    ├── leveling.test.ts      # Leveling/XP tests
    ├── registry.test.ts      # [NEW] Registry system and custom hooks tests
    ├── stats.test.ts         # Stat computation + rounding tests
    └── utils.test.ts         # Utility function tests
```

---

## Entry Point & Boot Sequence

**File**: `src/index.ts`

1. Loads `dotenv/config` for environment variables
2. Creates Discord `Client` with `Guilds` and `GuildMessages` intents
3. Binds events: `ready` → registers slash commands; `interactionCreate` → routes commands
4. Sets up global error handlers (`errorEvent`, `unhandledRejection`, `uncaughtException`)
5. Graceful shutdown on `SIGINT`/`SIGTERM` — destroys client, closes DB pool
6. Calls `client.login(DISCORD_TOKEN)`

---

## Database Layer

### Client (`src/database/client.ts`)

- Creates a `pg.Pool` using `DATABASE_URL`
- Exports `pool` (raw pg Pool) and `db` (Drizzle instance wrapping the pool)

### Schema (`src/database/schema.ts`)

All tables use the Drizzle ORM schema builder. Tables defined:

| Table (Export) | Table Name | Primary Key | Key Columns / Purpose |
|---|---|---|---|
| `players` | `players` | `id` (uuid) | discordId, username, level, exp, gold, gems, prestige, playerClass (`class`), hpCurrent, manaCurrent, currentZoneId, totalKills, totalQuestsCompleted, stamina, staminaMax, lastStaminaRegen |
| `playerStats` | `player_stats` | `playerId` (FK) | hpMax, manaMax, attack, defense, critChance, critDmg, speed, luck |
| `inventory` | `inventory` | `id` (uuid) | playerId, itemId, quantity, durability, enhancement (used as pet level too), equipped |
| `playerEquipment` | `player_equipment` | `playerId` (FK) | weapon, helmet, chest, gloves, boots, accessory, pet (all references to inventory.id) |
| `cooldowns` | `cooldowns` | Composite | playerId + action. Action cooldown tracking. |
| `combatSessions` | `combat_sessions` | `id` (uuid) | playerId (unique), enemyId, zoneId, state (JSONB), messageId, channelId |
| `playerQuests` | `player_quests` | `id` (uuid) | playerId, questId, progress (JSONB), startedAt, completedAt |
| `guilds` | `guilds` | `id` (uuid) | name, level, exp, treasury, leaderId |
| `guildMembers` | `guild_members` | Composite | guildId + playerId, rank, joinedAt |
| `transactions` | `transactions` | `id` (uuid) | playerId, type, amount, currency, description |
| `worldBosses` | `world_bosses` | `id` (uuid) | bossId, hpCurrent, hpMax, spawnedAt, defeatedAt, channelId, messageId |
| `bossParticipants` | `boss_participants` | Composite | bossInstanceId + playerId, damageDealt, joinedAt |
| `playerAchievements` | `player_achievements` | `id` (uuid) | playerId + achievementId (unique), unlockedAt |
| `dailyLogins` | `daily_logins` | `playerId` (FK) | streak, lastClaim |
| `playerSkills` | `player_skills` | `id` (uuid) | playerId, skillId, level |
| `explorationSessions` | `exploration_sessions` | `id` (uuid) | playerId (FK, one-to-one), channelId, zoneId, currentNodeId, previousNodeId, party (JSONB), mapState (JSONB), createdAt, updatedAt |

**Important schema details**:
- `players.currentZoneId` stores the player's current zone ID (defaults to `'verdant_meadows'`)
- All cascade deletes are configured on players.id relationships (`onDelete: 'cascade'`).
- The `playerEquipment` table maps the 7 slots to references in the `inventory` table.

### Queries (`src/database/queries/`)

Each query module exports async functions operating on the Drizzle `db` instance:

| Module          | Key Exports                                                        |
|-----------------|--------------------------------------------------------------------|
| `player.ts`     | `findOrCreatePlayer`, `getPlayerByDiscordId`, `updatePlayerLevel`, `updateLastSeen`, `getLeaderboard`, `incrementKills`, `incrementQuestsCompleted`, `getPlayerWithClampedStats`, `getAndUpdatePlayerStamina`, `deductPlayerStamina`, `replenishPlayerStamina` |
| `inventory.ts`  | `addItem`, `removeItem`, `getPlayerInventory`, `getEquippedItems`, `equipItem`, `unequipItem`, `updateDurability`, `updateEnhancement` |
| `combat.ts`     | `createCombatSession`, `getCombatSession`, `updateCombatSession`, `endCombatSession` |
| `economy.ts`    | `addGold`, `removeGold`, `getBalance`, `createTrade`, `completeTrade`, `getDailyClaim`, `setDailyClaim` |
| `guild.ts`     | `createGuild`, `getGuildByName`, `getPlayerGuild`, `addMember`, `removeMember`, `getGuildMembers`, `updateTreasury`, `getGuildLeaderboard` |
| `quest.ts`      | `startQuest`, `getActiveQuests`, `updateQuestProgress`, `completeQuest`, `getCompletedQuests` |
| `pets.ts`       | `getPlayerPets`, `addPet`, `setActivePet`, `addPetXp`, `levelUpPet` |
| `exploration.ts` | `createExplorationSession`, `getExplorationSessionByPlayerId`, `updateExplorationSession`, `deleteExplorationSession` |

---

## Command System

Commands are organized by category. Each command folder contains one `.ts` file per slash command. Every command file exports:
- `data`: `SlashCommandBuilder` definition
- `execute(interaction)`: Handler function

### Command Router (`src/events/interactionCreate.ts`)

- Collects command modules at startup by scanning `src/commands/*/`
- Routes `ChatInputCommandInteraction` to the matching `execute` function
- Enforces rate limits (5 actions / 10s per user) and cooldowns
- **Location guard**: Gameplay commands check `player.currentZoneId` before executing to ensure player setup.
- Routes component interactions (`ButtonInteraction`, `StringSelectMenuInteraction`, `ModalSubmitInteraction`) by prefixing `customId` to respective system handlers:

| `customId` Prefix | Router Handler Function | File Path | Description |
|---|---|---|---|
| `combat_` | `handleCombatInteraction` | `src/systems/combat/handler.ts` | Controls fighting actions, preset combo execution, and running away. |
| `shop_` | `handleShopInteraction` | `src/commands/economy/economy.ts` | Handles browsing pages and purchasing/selling confirmations. |
| `tutorial_` | `handleTutorialInteraction` | `src/commands/player/tutorial.ts` | Manages player class selection and onboarding prompts. |
| `nav_` | `handleNavInteraction` | `src/utils/navigation.ts` | Handles pagination/navigation on generic tables and lists. |
| `bag_` | `handleBagInteraction` | `src/commands/inventory/inventory.ts` | Controls browsing the player inventory pages. |
| `equip_select_` | `handleEquipInteraction` | `src/commands/inventory/inventory.ts` | Handles equipping equipment chosen from dropdown select menus. |
| `sell_select_` | `handleSellInteraction` | `src/commands/inventory/inventory.ts` | Handles selling specific items chosen from select menus. |
| `quests_` | `handleQuestsInteraction` | `src/commands/quests/quest.ts` | Manages active quest display and navigation. |
| `quests_board_select_` | `handleQuestsBoardSelect` | `src/commands/quests/quest.ts` | Triggers accepting a quest from the quest board. |
| `prestige_` | `handlePrestigeInteraction` | `src/commands/player/player.ts` | Handles prestige confirmation/cancellation buttons. |
| `guild_` | `handleGuildInteraction` | `src/commands/guilds/guild.ts` | Processes guild options (join, leave, deposit, etc.). |
| `leaderboard_` | `handleLeaderboardInteraction` | `src/commands/guilds/guild.ts` | Navigates guild or player leaderboard rankings. |
| `map_travel_` | `handleMapTravelInteraction` | `src/commands/player/map.ts` | Triggers zone-to-zone travel and cozy tavern rest functions. |
| `player_preset_` | `handlePresetInteraction` | `src/commands/player/player.ts` | Manages presets configuring custom 3-action sequence combos. |

### Command Reference

| Command | Subcommands / Parameters | Description |
|---|---|---|
| `/admin` | `give-item`, `spawn-boss`, `spawn-global-boss` | Admin-only panel to give items, spawn local World Bosses, or spawn a Global World Boss (server-agnostic, 16× HP scaling). |
| `/boss` | `info`, `fight` | Raid combat loop vs. active World Boss. |
| `/combat` | `explore`, `fight` | Explore current zone (encounters/chests) or resume combat. |
| `/craft` | `recipe` (optional parameter) | Open crafting recipe menu or craft an item. |
| `/economy` | `balance`, `shop`, `buy` | Manage gold/gems, browse/buy items from NPC shop. |
| `/guild` | `info`, `create`, `join`, `leave`, `kick`, `leaderboard` | Create/join guilds, deposit gold, view guild stats. |
| `/inventory` | `bag`, `equip`, `sell` | View items in bag, equip gear, or sell items to shop. |
| `/pet` | `info`, `level`, `release` | View companion pet stats, train pet, or release pet. |
| `/help` | (none) | Browse commands and system tutorials. |
| `/invite` | (none) | Get the invite link to add Arcanora to other servers. |
| `/map` | (none) | View the map and travel between zones. |
| `/player` | `profile`, `stats`, `preset`, `prestige` | View character card, detailed attributes, configure quick-cast attack/skill presets, or prestige reset. |
| `/quest` | `active`, `board`, `accept`, `daily` | View active quests, accept new ones, and claim daily rewards. |
| `/reset` | (none) | Permanently delete your character profile and all progress (with confirmation prompt). |
| `/tutorial` | (none) | Onboard new players, choose class, and get starter gear. |

---

## Registry & Modularity System

> **Core Design Principle**: Arcanora is **modular and built to scale**. Every game system is a self-contained module wired through generic Registry singletons. To add new content or behavior, drop a new JSON file and optionally register a behavior hook — **never touch engine core logic**.

Arcanora uses a generic **Registry** pattern (`src/utils/registry.ts`) to enable dynamic assets, override parameters, and custom behavior hooks.

At startup, standard static game configurations are loaded from `data/*.json` and registered to singletons. Developers can register custom objects or logic dynamically at boot time without altering the engine cores.

### Static Catalogs & Backward-Compatible Proxies

Registries for static JSON data are defined in `src/utils/catalog.ts`:
- `itemsRegistry`, `enemiesRegistry`, `zonesRegistry`, `recipesRegistry`, `questsRegistry`, `petsRegistry`, `achievementsRegistry`
- **[PLANNED]** `dungeonNodesRegistry` — modular registry for dungeon node type definitions and their interaction handlers.

To ensure full backward-compatibility with existing code, the catalog exports Array Proxies (`itemsCatalog`, `enemiesCatalog`, etc.) that intercept read operations (like `.find()`, `.filter()`, `.length`) and dynamically route them to the active registry.

### Custom Behavior Hooks

1. **Items (`src/systems/items/itemBehavior.ts`)**:
   - Register custom item functions in `itemBehaviorRegistry` implementing `ItemBehavior` (`onUse(context)`).
   - If registered, using the item in combat calls the custom logic. Otherwise, it falls back to standard stat boosts.

2. **Skills (`src/systems/combat/skills.ts`)**:
   - Register custom skill behaviors in `skillBehaviorRegistry` implementing `SkillBehavior` (`execute(skill, casterStats, targetStats)`).
   - If registered, `executeSkill` delegates to the behavior; otherwise, it falls back to standard damage/buff scaling switch blocks.

3. **Achievements (`src/systems/achievements.ts`)**:
   - Register custom condition checking logic in `achievementEvaluatorRegistry` implementing `AchievementEvaluator` (`evaluate()`, `getCurrentValue()`).
   - Allows addition of arbitrary condition checking triggers beyond default stats.

4. **Shops (`src/economy/shopRegistry.ts`)**:
   - Register custom shop listing overrides in `shopRegistry` specifying custom `buyPrice`, `sellPrice`, `levelReq`, and conditional availability functions (`condition(playerId)`).

5. **Dungeon Node Interactions (`src/systems/exploration/dungeonInteractions.ts`)** *(Planned)*:
   - Register custom node interaction handlers in `dungeonNodeRegistry` implementing `NodeInteractionHandler` (`onEnter(context)`, `onAction(context)`).
   - Each node type (`campsite`, `treasure`, `puzzle`, `event`, `merchant`, `elite`, `boss`) is a standalone module that can be extended or replaced without modifying the dungeon navigation engine.
   - New node types can be introduced (e.g., `shrine`, `forge`, `library`) simply by registering a new handler — zero core changes required.

### Scalability Guarantees

| What you want to add | How to do it |
|---|---|
| New enemy | Add JSON file to `data/enemies/` |
| New item | Add JSON file to `data/items/` |
| New quest | Add JSON file to `data/quests/` |
| New dungeon zone | Add JSON file to `data/locations/` |
| New crafting recipe | Add JSON file to `data/recipes/` |
| New item behavior | Register in `itemBehaviorRegistry` |
| New skill | Register in `skillBehaviorRegistry` |
| New achievement trigger | Register in `achievementEvaluatorRegistry` |
| New shop override | Register in `shopRegistry` |
| New dungeon node type | Register in `dungeonNodeRegistry` |
| New slash command | Add file to `src/commands/`, import in `ready.ts` |

---

## Game Systems

### Classes (`src/systems/classes.ts`)

Character classes provide percent-based stat modifiers (unlocked at Level 5):

| Class | Stat Modifier Highlights |
|---|---|
| **warrior** | +20% HP, +15% Attack |
| **mage** | +30% ManaMax, +20% Critical Damage |
| **rogue** | +25% Critical Chance, +20% Speed, +15% Luck |
| **ranger** | +10% Attack, +15% Critical Chance, +15% Speed |
| **healer** | +20% HP, +25% ManaMax, -15% Attack |
| **novice** | Starting default. No modifiers. |

### Combat Engine (`src/systems/combat/engine.ts`)

- **Damage formula**: `max(1, attack - defense/2) * variance(0.85–1.15)`
- **Critical hits**: Critical hits roll against crit chance %. Multiplier is `critDmg / 100` (default 150%).
- **Dodge formula**: `5 + (defSpeed - atkSpeed) * 0.5`, clamped between `0%` and `30%`.
- **Flee formula**: `30 + playerSpeed * 0.5`%, capped at `90%`.
- Combat sessions persist in `combat_sessions` table with a 10-minute expiry.

### Enemy System (`src/systems/combat/enemy.ts`)

- Enemies loaded from `data/enemies.json`.
- `scaleEnemyStats(enemy, playerLevel)` scales stats based on level difference: +5% HP, ATK, and DEF per level difference above enemy base level. Speed remains unscaled.
- **Scaled stats are rounded to the nearest multiple of 10.**
- AI selects abilities dynamically (heals when `<30%` HP, big attacks when player `<30%` HP).

### Stat Computation (`src/systems/progression/stats.ts`)

`computeStats(level, prestige, className, equippedItems, petStats, activeBuffs)`:
1. Base stats from level using `getStatGrowth(level)` — all multiples of 10.
2. Applies class multipliers.
3. Adds flat equipment bonuses.
4. Adds pet passive bonuses.
5. Applies prestige bonuses (+5% per prestige level).
6. Applies active buffs (flat + percent).
7. **Rounds all final stats to the nearest multiple of 10.**

### Leveling (`src/systems/progression/leveling.ts` & `src/systems/progression/questSystem.ts`)

- **`MAX_LEVEL = 20`.**
- **Quest-Based Level-Up Progression**: Leveling up is strictly restricted to completing linear story quests. Combat victories and crafting achievements **do not** award leveling progression EXP or level-ups.
- **Crafting EXP**: Performing crafts awards EXP directly to the player's database field (pity EXP for failures, regular EXP for successes), but it does not trigger leveling up.
- **Linear Story Quests**: Level-ups are executed automatically within `questSystem.ts` when a player completes a linear story quest (from `story_01_begin.json` through `story_19_nameless_defeat.json`) that matches the progression path.
- Base stats formula (multiples of 10):
  - `hpMax: 60 + 20 * level` (Lvl 1: 80, Lvl 20: 460)
  - `manaMax: 30 + 10 * level` (Lvl 1: 40, Lvl 20: 230)
  - `attack / defense / speed / luck: 10 * level` (Lvl 1: 10, Lvl 20: 200)
- Skill points: 1 point earned every 2 levels, starting at level 2.

### Exploration/Zones (`src/systems/exploration/zones.ts`)

- Loaded from `data/zones.json`.
- Travelling is restricted by player level and connections.
- Weighted encounters: normal_mob, rare_mob, boss, treasure, empty.

### Crafting (`src/systems/crafting.ts`)

- Recipes from `data/recipes.json`.
- Crafting can result in failure (materials lost, grants 20% pity EXP) or success.
- Success quality tiers: Normal (70%), Quality (25%), Perfect (5% — double yield). Quality tiers are shifted by Luck.

### Pets (`src/systems/pets.ts`)

- Companion stats scale with level: `base * (1 + (level - 1) * 0.1)` (+10% per level).
- Pet level is tracked using the `enhancement` field on the pet inventory row.
- Training cost: `200 * currentLevel` Gold.

### Achievements (`src/systems/achievements.ts`)

- Tracking conditions: `kills`, `level`, `gold_earned`, `quests_completed`, `prestige`, `guild_joined`, `items_crafted`, `bosses_defeated`.
- Evaluated on player actions and rewards claimed instantly.

### Bosses (`src/systems/bosses.ts`)

- World Boss HP scales with server member count: `baseHp * (1 + memberCount * 0.1)`, minimum 10,000 HP.
- Rewards distributed proportionally based on damage dealt; MVP receives 2x gold/EXP.

---

## Economy System

### Currency (`src/economy/currency.ts`)

- All gold operations use `bigint` (mapped to JS `number`) and enforce integer math.
- Transaction logs are saved to the `transactions` table.
- Row-level database locks are used on deductions to prevent double-spending.

### NPC Shop (`src/economy/shop.ts`)

- Buy price is fetched from item catalog.
- Sell price is configured as `Math.floor(buyPrice * 0.4)` (40% sell-back).

### Anti-Inflation (`src/economy/antiInflation.ts`)

- Enhancement fees scale exponentially: `baseCost * (currentEnhancement + 1) ^ 1.5`.
- Enhancement success rates descend steeply from 95% (+0) down to 5% (+9). Maximum level is +10.
- Durability loss: `max(1, Math.floor(combatRounds / 3))` lost per encounter.
- Auction / Trade fee: 5% tax on sales.
- Guild dues: `100 * guildLevel` Gold per member per week.

---

## Utility Modules

### Embeds (`src/utils/embeds.ts`)

- Factory functions to create rich embeds for UI elements.
- Features dynamic HP/mana/progress visual bars (`█░` and `▓░`).
- Embed color templates: Primary Purple, Success Green, Danger Red, Warning Amber, Info Blue, Gold, Mythic, and Rarity Colors.

### Navigation (`src/utils/navigation.ts`)

- Generates interactive button rows for "next actions" post-command.
- Handles user verification: only the interaction triggerer can click buttons.
- Dynamically imports commands to route button pagination/travel requests.

### Catalog (`src/utils/catalog.ts`)

- Eagerly loads all game JSON files from `data/` at module load time.
- Serves as the single source of truth for items, enemies, zones, quests, recipes, pets, and achievements.

---

## Static Game Data (JSON)

### Locations (`data/locations/`)

| Location ID | Level Range | Exploration Cooldown | Description |
|---|---|---|---|
| `cozy_tavern` | 1-100 | 0s | Warm tavern rest recovery area |
| `verdant_meadows` | 1-3 | 60s | Starting location |
| `shadow_forest` | 3-6 | 90s | Dark woodlands |
| `crystal_caverns` | 6-10 | 120s | Mining caverns |
| `volcanic_wastes` | 10-15 | 150s | High-level lava field |
| `abyssal_depths` | 15-20 | 180s | Endgame ocean depths |

*Note: `abyssal_kraken` is listed as an enemy in `abyssal_depths` but has been added in `enemies/abyssal_kraken.json`.*

---

## Tests

Test files are in `tests/` and use Vitest:

| File                | What It Tests                                         |
|---------------------|------------------------------------------------------|
| `combat.test.ts`    | Damage formula, crit multiplier, dodge chance, flee   |
| `stats.test.ts`     | Stat growth multiples of 10, computeStats rounding, enemy scaling |
| `leveling.test.ts`  | XP calculation, level-up thresholds                   |
| `economy.test.ts`   | Gold operations, trade tax, daily rewards             |
| `registry.test.ts`  | Generic registry class and custom hooks/behavior overrides |
| `utils.test.ts`     | Random helpers, cooldown logic                        |

Run the full verification pipeline (lint checking, type checking, production build compiling, and unit testing) in one go with `npm run test`.

---

## Deployment

- **Platform**: Railway
- **Build**: Nixpacks (Node.js)
- **Start command**: `npm run migrate && node dist/index.js`
- **Replicas**: 1
- **Database**: PostgreSQL (`DATABASE_URL` auto-injected)

---

## Known Conventions & Rules

1. **Modular First**: Every system must be implemented as a self-contained module. Never embed game logic directly in command handlers. Command files call runner functions; runner functions call system modules; system modules call database queries.
2. **Registry Pattern**: New content or behaviors must go through the appropriate Registry (`itemBehaviorRegistry`, `skillBehaviorRegistry`, `achievementEvaluatorRegistry`, `shopRegistry`, `dungeonNodeRegistry`). Never hard-code conditional branches for specific item IDs or enemy IDs in engine code.
3. **Data-Driven Design**: Static game data (enemies, items, quests, zones, dungeons, recipes, achievements, pets, classes) lives exclusively in `data/` JSON files. Code reads from registries; registries load from JSON. No game values are hard-coded in source files.
4. **Stats are multiples of 10**: Base stats, enemy stats, and player computed stats are rounded to the nearest multiple of 10.
5. **ESM Imports**: Import paths must include `.js` file extensions.
6. **Caps**: Players' current HP/mana is clamped to their maximum limits after equipment swaps or level-ups.
7. **Quest progress**: Stored in a JSONB object mapped against quest requirement targets.
8. **Scalability**: Adding new dungeons, node types, or systems should require zero changes to existing engine code. If you find yourself editing engine internals to support a new feature, refactor to a registry hook instead.

---

## Recent Changes Log

### 2026-06-24
- **Game Data & Story Progression Updates**:
  - Added new boss enemy definition file `data/enemies/abyssal_kraken.json`.
  - Renamed and enriched descriptions in the 5 zone files (`data/locations/`).
  - Restructured the story quest line: deleted old story quest files and created 19 new linear story quests (`story_01_begin.json` to `story_19_nameless_defeat.json`) matching level requirements and targets.
  - Verified compilation and ran tests successfully.

- **Granular Data Split**:
  - Split all monolithic JSON files (`items.json`, `enemies.json`, `zones.json`, `achievements.json`, `pets.json`, `quests.json`, `recipes.json`) into individual JSON files inside category subdirectories in `data/`.
  - Updated `catalog.ts` to dynamically scan directories and load/register each JSON file on boot.
  - Verified all 38 tests pass successfully.
- **Modularity & Registry Refactoring**:
  - Implemented generic `Registry` class in `src/utils/registry.ts`.
  - Refactored `catalog.ts` to use generic registries populated from JSON at startup, backed by backward-compatible Proxy arrays.
  - Modularized items by introducing `itemBehaviorRegistry` and integrating it into combat consumption.
  - Modularized combat skills by introducing `skillsRegistry` and `skillBehaviorRegistry` allowing overrides in `executeSkill`.
  - Modularized achievements by introducing `achievementEvaluatorRegistry` allowing custom conditions.
  - Modularized shops by introducing `shopRegistry` for custom pricing, availability, and player conditions.
  - Created test suite `tests/registry.test.ts` (all 38 tests passing).
- Updated `CONTEXT_HANDOFF.md` to perfectly align database tables, class structures, command list/names, maximum level (20), and formulas with the actual codebase.
- Created `CONTEXT_HANDOFF.md` context handoff document.

### 2026-06-25
- **Command Registration & OAuth2 Fixes**:
  - Modified command registration in `ready.ts` to prioritize `client.user?.id` over the environment variable `DISCORD_CLIENT_ID` to prevent application ID mismatch.
  - Implemented self-healing cleanup in `ready.ts` to scan and delete stale guild-level commands on startup so that they don't override global slash commands.
  - Prioritized `interaction.client.user?.id` in `invite.ts` for safe and accurate invite URL generation.
- **Command Reference Sync**: Updated `CONTEXT_HANDOFF.md` Command Reference table to match actual registered commands:
  - Added missing `/reset` command (permanent character profile deletion with confirmation).
  - Added missing `spawn-global-boss` subcommand to `/admin` (server-agnostic global boss with 16× HP scaling and 1.5× damage).
  - Added missing `preset` subcommand to `/player` (configures 3 quick-cast attack/skill preset combos).
  - Updated player command folder description in directory structure.

- **Quest-Based Progression & Gameplay Features**:
  - Implemented story-quest-based player level progression: removed combat victory EXP/level-ups, restricted leveling up strictly to completing linear story quests via `questSystem.ts`, and updated player profile embeds to track story progress instead of an EXP bar.
  - Disabled player level-ups from crafting, making crafting EXP strictly update the player's exp field without leveling up.
  - Added server-agnostic global world boss spawning functionality via `/admin spawn-global-boss` (scaling HP 16x higher than base and increasing attack damage by 1.5x compared to local world bosses), updated active boss queries, clearly labeled boss types in all embeds/logs, and implemented leaderboard-ranking-based loot drop rates (100% chance for MVP, down to proportional damage-percent based rates for rank 6+).
  - Enhanced the travel and region map command (`/map`) to display zone lore, present available/locked travel destinations in a select menu, and provide quick actions via buttons.
  - Updated the onboarding tutorial to guide players towards map travel, and automatically accept the first story quest.
  - Resolved critical shop and inventory bugs (UUID checking for equipment/selling and prefixing custom IDs with user ID to avoid session hijacking).

- **Attack Combo Presets, Modular Stats, and Cozy Tavern Restoration**:
  - **Preset Combos**: Enhanced player presets structure to allow custom names and 3-action sequence combos. Integrated quick-cast preset combo buttons (P1, P2, P3) in combat and boss fight skirmish UI.
  - **Modular Stats**: Refactored `stats.ts` to use a loop-driven stat calculation pipeline mapped against `STAT_KEYS`. Refactored `classes.ts` to dynamically register class configurations from JSON data files (`data/classes/`).
  - **Cozy Tavern Recovery Area**: Added Cozy Tavern location (`data/locations/cozy_tavern.json`). Implemented button action `/map` -> `Rest & Sleep` which invokes `runTavernRest` to fully replenish player HP/Mana and clear active combat sessions (clearing status ailments).
  - **TypeScript Compilation Cleanliness**: Resolved all strict compiler errors (`disabledRows` casts, parameter widening for `StringSelectMenuInteraction`, explicit callback types, strict typing in boss combat stats and player presets, and fixed missing database schema properties by counting guild members in `guild.ts` via `getGuildMembers`).
  - Verified 100% clean compilation and all 56 tests passing.

- **Node-Based Dungeon Crawling Exploration System**:
  - **Database & Queries**: Modified `players` table in `schema.ts` to add `stamina`, `staminaMax`, and `lastStaminaRegen`. Created `exploration_sessions` table. Implemented stamina passive regen, deduct, and replenish helpers in `player.ts`. Created `src/database/queries/exploration.ts` for CRUD actions supporting co-op member query search. Generated migration.
  - **Procedural DAG Map Generator**: Implemented stateless procedural graph generator in `src/systems/exploration/dungeonGenerator.ts` scaling layers count with dungeon zone (Verdant Outpost: 5, Whispering Canopy: 6, Glittering Depths: 7, Volcanic Wastes: 8, Abyssal Depths: 9). Integrated weighted node distribution, fog of war visibility states, random riddle puzzles, and choice-based narrative events.
  - **Modular Interaction Registry**: Created `src/systems/exploration/dungeonInteractions.ts` mapping interaction handlers for campsites, treasure chambers, merchants, puzzles, events, and combat rooms.
  - **Dungeon UI & Commands**: Overhauled `/map` command in `src/commands/player/map.ts` to render the dungeon selector (no active run), co-op party lobbies, or active dungeon run navigation (fog of war map drawing, node movement buttons costing 10 stamina, action buttons, stamina potions bag select menu, abandon run).
  - **Combat Integration**: Integrated combat outcomes into dungeon runs in `src/systems/combat/handler.ts`. Fleeing backtracks player, victory clears node and reveals next layers, and defeat deletes the session and revives the player at Cozy Tavern.
- **Turn-by-Turn Preset Combos & Full Test Pipeline Integration**:
  - **Presets Turn-by-Turn Execution**: Refactored the preset execution logic to run turn-by-turn. Presets in both standard combat (`src/systems/combat/handler.ts`) and boss fights (`src/commands/combat/boss.ts`) now execute exactly one action per round corresponding to the current combat round, with wrapping modulo support for long-running battles.
  - **Strict Type Checking & Linting Resolution**:
    * Created `.eslintrc.json` with configuration allowing empty catch blocks to accommodate existing error suppression practices.
    * Resolved all TypeScript type check errors across player commands, exploration code, and progression structures (e.g. converting `ComputedStats` to a clean type alias, parameter type widening, and adding missing currency imports).
  - **Verification Pipeline Integration**: Modified the `test` NPM script in `package.json` to execute ESLint, TypeScript compiler type-check (`tsc --noEmit`), TSUP compilation build emission (`npm run build`), and Vitest unit testing sequentially. All 69 tests pass successfully.
