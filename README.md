# Arcanora

> A fully-featured Discord MMORPG bot built with TypeScript, discord.js v14, and PostgreSQL.

Players interact entirely through Discord slash commands to explore a world, fight enemies, craft gear, complete quests, manage guilds, and progress through a class-based RPG system — all within a private adventure thread.

---

## Features

- ⚔️ **Turn-based combat** with skills, presets, status effects, and elemental weaknesses
- 🗺️ **World map** with fog-of-war, pixel-art canvas rendering, and node-based travel
- 🏰 **Grid dungeon crawling** with procedurally generated floors and boss encounters
- 📜 **Quest system** with story quests, XP progression, and lore narratives
- 🎒 **Inventory, crafting, and equipment** with rarities and enhancement levels
- 🛒 **Economy** with shops, gold, gems, auction fees, and anti-inflation mechanics
- 🐾 **Pets** and **Guilds** with leaderboards and co-op boss fights
- 🏡 **Housing and farming** systems
- 🧙 **Codex and Bestiary** with auto-discovery tracking
- 🔒 **Private adventure threads** — all gameplay is gated to a player's own thread via `/play`
- 🛡️ **Admin tools** for spawning bosses, giving items, managing feedback, and custom emoji assets

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 20 (ESM) |
| Language | TypeScript 5.7 (strict mode) |
| Discord API | discord.js v14 |
| Database | PostgreSQL via Drizzle ORM |
| Logging | Pino |
| Bundler | tsup (ESM output) |
| Testing | Vitest + ESLint + tsc |
| Hosting | Railway (Nixpacks) |

---

## Project Structure

```
Arcanora/
├── src/
│   ├── index.ts                  # Entry point — initializes client and events
│   ├── events/
│   │   ├── ready.ts              # On login: registers slash commands per guild
│   │   ├── interactionCreate.ts  # Routes all slash commands, buttons, modals
│   │   └── error.ts              # Discord client error logging
│   ├── commands/                 # All slash command definitions and handlers
│   │   ├── player/               # /player, /map, /tutorial, /play, /stop, etc.
│   │   ├── combat/               # /combat, /boss, /dungeon, /gather, /fish
│   │   ├── inventory/            # /inventory
│   │   ├── economy/              # /economy (shop, market)
│   │   ├── quests/               # /quest
│   │   ├── crafting/             # /craft
│   │   ├── guilds/               # /guild
│   │   ├── pets/                 # /pet
│   │   └── admin/                # /admin
│   ├── systems/                  # Core game logic (combat, progression, crafting, etc.)
│   ├── database/
│   │   ├── client.ts             # Drizzle + pg pool setup
│   │   ├── schema.ts             # All table definitions
│   │   ├── migrations/           # SQL migration files (drizzle-kit)
│   │   └── queries/              # Per-domain query helpers
│   └── utils/                    # Shared utilities (embeds, logger, catalog, registry, etc.)
├── data/                         # Static JSON game data (items, enemies, quests, etc.)
├── tests/                        # Vitest unit and integration tests
├── tools/                        # Developer tools (map-editor.html)
├── railway.json                  # Railway deployment config
├── nixpacks.toml                 # Nixpacks build config
├── drizzle.config.ts             # Drizzle ORM config
├── package.json
└── tsconfig.json
```

---

## Getting Started

### Prerequisites

- Node.js ≥ 20
- A Discord application with a bot token ([Discord Developer Portal](https://discord.com/developers/applications))
- A PostgreSQL database (local or hosted)

### 1. Clone the repository

```bash
git clone https://github.com/PatzMain/Arcanora.git
cd Arcanora
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy `.env.example` to `.env` (or create it manually):

```env
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_application_client_id
DATABASE_URL=postgresql://user:password@host:5432/dbname
NODE_ENV=development
LOG_LEVEL=info
DB_POOL_MIN=2
DB_POOL_MAX=10
CACHE_TTL_SECONDS=300
```

### 4. Run database migrations

```bash
npm run migrate
```

### 5. Start the bot

```bash
# Development (hot-reload)
npm run dev

# Production
npm run build
npm start
```

---

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start in watch mode (hot-reload via tsx) |
| `npm run build` | Compile TypeScript to `dist/` via tsup |
| `npm start` | Run compiled production build |
| `npm run migrate` | Apply pending database migrations |
| `npm run generate` | Generate new migration files from schema changes |
| `npm run lint` | Run ESLint on `src/` |
| `npm test` | Full pipeline: lint → tsc → vitest |

---

## Adding New Commands

1. Create a new file in the appropriate `src/commands/<category>/` folder
2. Export `data` (a `SlashCommandBuilder`) and `execute` function
3. Import and add the command to `commandsList` in `src/events/ready.ts`

Commands are re-registered per guild on every bot startup — no manual Discord API calls needed.

---

## Deployment

Arcanora is designed to deploy on [Railway](https://railway.app) out of the box.

See [`TEMPLATE.md`](./TEMPLATE.md) for a full step-by-step deployment guide.

---

## License

MIT
