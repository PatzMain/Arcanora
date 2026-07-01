# Discord Bot Deployment Template

> A step-by-step guide for deploying a Discord bot — with or without a database — using this codebase (Arcanora) as a real-world reference.

---

## Table of Contents

1. [Discord Application Setup](#1-discord-application-setup)
2. [Project Structure Overview](#2-project-structure-overview)
3. [Environment Variables](#3-environment-variables)
4. [Running Locally](#4-running-locally)
5. [Deploying Without a Database](#5-deploying-without-a-database)
6. [Deploying With a Database (PostgreSQL + Drizzle)](#6-deploying-with-a-database-postgresql--drizzle)
7. [Deploying to Railway](#7-deploying-to-railway)
8. [Slash Command Registration](#8-slash-command-registration)
9. [Keeping Commands Updated on Push](#9-keeping-commands-updated-on-push)
10. [Production Checklist](#10-production-checklist)

---

## 1. Discord Application Setup

### Create Your Bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application** → give it a name
3. Go to the **Bot** tab → click **Add Bot**
4. Under **Token**, click **Reset Token** and copy it → this is your `DISCORD_TOKEN`
5. Under **Application ID** on the **General Information** tab → copy it → this is your `DISCORD_CLIENT_ID`

### Set Bot Permissions

Under the **Bot** tab, enable the following **Privileged Gateway Intents** if your bot needs them:
- **Server Members Intent** — for reading guild member lists
- **Message Content Intent** — only if you handle message content (not needed for slash-only bots)

### Invite the Bot to Your Server

Construct an invite URL:

```
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot%20applications.commands
```

Replace `YOUR_CLIENT_ID` with your application's client ID. `permissions=8` grants Administrator — reduce this to the minimum permissions your bot actually needs.

> **Reference**: [`src/commands/player/invite.ts`](./src/commands/player/invite.ts) in this codebase auto-generates this invite URL at runtime.

---

## 2. Project Structure Overview

A well-structured Discord bot project looks like this:

```
my-bot/
├── src/
│   ├── index.ts               # Entry point — creates client, binds events, starts bot
│   ├── events/
│   │   ├── ready.ts           # Fired once on login — register slash commands here
│   │   ├── interactionCreate.ts # Routes all slash commands, buttons, selects, modals
│   │   └── error.ts           # Discord client error handler
│   ├── commands/              # One file per command (or grouped by category)
│   │   └── ping.ts            # Example: export { data, execute }
│   ├── database/              # (Optional) DB client, schema, migrations, queries
│   └── utils/                 # Shared helpers: logger, embeds, rate limiting, etc.
├── .env                       # Secrets — never commit this
├── .gitignore                 # Include node_modules/, dist/, .env
├── package.json
└── tsconfig.json
```

> **Reference**: This mirrors the exact structure of this codebase. See [`src/index.ts`](./src/index.ts), [`src/events/ready.ts`](./src/events/ready.ts), and [`src/events/interactionCreate.ts`](./src/events/interactionCreate.ts).

---

## 3. Environment Variables

Create a `.env` file in your project root. **Never commit this file.**

### Minimal Setup (No Database)

```env
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_application_client_id
NODE_ENV=production
LOG_LEVEL=info
```

### Full Setup (With Database)

```env
# Discord
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_application_client_id

# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname
DB_POOL_MIN=2
DB_POOL_MAX=10

# App
NODE_ENV=production
LOG_LEVEL=info
CACHE_TTL_SECONDS=300
```

Load them in code using the `dotenv` package:

```ts
import 'dotenv/config'; // Add this at the very top of src/index.ts
```

> **Reference**: [`src/index.ts`](./src/index.ts) — `dotenv/config` is imported on line 1. [`src/database/client.ts`](./src/database/client.ts) reads `DATABASE_URL` from `process.env`.

---

## 4. Running Locally

### Install Dependencies

```bash
npm install
```

### Development (Hot Reload)

Uses `tsx watch` to restart automatically on file changes:

```bash
npm run dev
```

### Production Build

Compile TypeScript to `dist/` using `tsup`:

```bash
npm run build
npm start
```

> **Reference**: [`package.json`](./package.json) scripts section. `tsup` is configured in the `build` script as `tsup src/index.ts --format esm --out-dir dist --target node20 --clean`.

---

## 5. Deploying Without a Database

If your bot doesn't need to persist any data (e.g., a simple utility or fun bot), you can skip the database entirely.

### What to Remove

- Delete `src/database/` entirely
- Remove `drizzle-orm`, `drizzle-kit`, `pg` from `package.json`
- Remove `DATABASE_URL` and pool config from your `.env`
- Remove `npm run migrate` from your start command in `railway.json`

### Simplified `railway.json`

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": { "builder": "NIXPACKS" },
  "deploy": {
    "startCommand": "node dist/index.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### Minimal `src/index.ts` (No Database)

```ts
import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import * as readyEvent from './events/ready.js';
import * as interactionCreateEvent from './events/interactionCreate.js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once('ready', () => readyEvent.execute(client));
client.on('interactionCreate', (interaction) => interactionCreateEvent.execute(interaction));

if (!process.env.DISCORD_TOKEN) {
  throw new Error('DISCORD_TOKEN is required.');
}

client.login(process.env.DISCORD_TOKEN);
```

> **Reference**: The full version with graceful shutdown, error handlers, and DB pool teardown is in [`src/index.ts`](./src/index.ts).

---

## 6. Deploying With a Database (PostgreSQL + Drizzle)

### Install Database Dependencies

```bash
npm install drizzle-orm pg
npm install -D drizzle-kit @types/pg
```

### Configure Drizzle

Create `drizzle.config.ts` in the project root:

```ts
import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

export default defineConfig({
  schema: './src/database/schema.ts',
  out: './src/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

> **Reference**: [`drizzle.config.ts`](./drizzle.config.ts)

### Create a Database Client

```ts
// src/database/client.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  min: parseInt(process.env.DB_POOL_MIN || '2'),
  max: parseInt(process.env.DB_POOL_MAX || '10'),
});

export const db = drizzle(pool, { schema });
export { pool };
```

> **Reference**: [`src/database/client.ts`](./src/database/client.ts)

### Define Your Schema

```ts
// src/database/schema.ts
import { pgTable, uuid, varchar, integer, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  discordId: varchar('discord_id', { length: 20 }).unique().notNull(),
  username: varchar('username', { length: 32 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

> **Reference**: [`src/database/schema.ts`](./src/database/schema.ts) defines 15+ tables including players, inventory, combat sessions, quests, guilds, and more.

### Generate and Run Migrations

```bash
# Generate migration SQL from your schema
npm run generate

# Apply migrations to your database
npm run migrate
```

Migration files are created in `src/database/migrations/` and are **safe to commit** — they are version-controlled SQL snapshots.

> **Reference**: [`src/database/migrations/`](./src/database/migrations/) contains 13 migration files.

### Railway: Run Migrations on Deploy

In `railway.json`, run migrations before starting the bot:

```json
{
  "deploy": {
    "startCommand": "npm run migrate && node dist/index.js"
  }
}
```

> **Reference**: [`railway.json`](./railway.json) line 9.

---

## 7. Deploying to Railway

[Railway](https://railway.app) is the recommended host for this bot. It supports push-to-deploy, managed PostgreSQL, and Nixpacks auto-detection.

### Step 1 — Push to GitHub

```bash
git init
git remote add origin https://github.com/your-username/your-repo.git
git add .
git commit -m "feat: initial bot setup"
git push -u origin main
```

### Step 2 — Create a Railway Project

1. Go to [railway.app](https://railway.app) and log in
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your repository → Railway auto-detects Node.js and builds via Nixpacks

### Step 3 — Add a PostgreSQL Database (If Needed)

1. In your Railway project, click **+ New** → **Database** → **Add PostgreSQL**
2. In your bot service's **Variables** tab, add:
   - `DATABASE_URL` → copy the **Connection URL** from the PostgreSQL service

### Step 4 — Set Environment Variables

In your Railway service **Variables** tab, add:

```
DISCORD_TOKEN        = your_bot_token
DISCORD_CLIENT_ID    = your_client_id
NODE_ENV             = production
LOG_LEVEL            = info
```

### Step 5 — Configure `railway.json`

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": { "builder": "NIXPACKS" },
  "deploy": {
    "numReplicas": 1,
    "sleepApplication": false,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10,
    "startCommand": "npm run migrate && node dist/index.js"
  }
}
```

> **Reference**: [`railway.json`](./railway.json)

### Step 6 — Configure Nixpacks

To avoid redundant `node_modules` installs on every rebuild, create `nixpacks.toml`:

```toml
[phases.install]
onlyIncludeFiles = ["package.json", "package-lock.json"]
```

> **Reference**: [`nixpacks.toml`](./nixpacks.toml)

### Step 7 — Deploy

Railway will automatically build and deploy every time you push to `main`. Watch the build logs in your Railway dashboard.

---

## 8. Slash Command Registration

Slash commands must be registered with Discord's API before they appear in servers.

### How This Codebase Does It

Commands are registered **once on bot startup** inside the `ready` event. They are registered **per guild** (not globally) for instant propagation:

```ts
// src/events/ready.ts
const body = commandsList.map((cmd) => cmd.data.toJSON());

for (const guild of client.guilds.cache.values()) {
  await rest.put(Routes.applicationGuildCommands(clientId, guild.id), { body });
}
```

> **Why per-guild, not global?** Global command registration (`Routes.applicationCommands`) has up to a **1-hour propagation delay** on Discord's end. Per-guild registration is **instant**. Every time the bot restarts (e.g., after a Railway deploy), all servers get the latest commands immediately.

> **Reference**: [`src/events/ready.ts`](./src/events/ready.ts)

### Adding a New Command

**1. Create the command file:**

```ts
// src/commands/ping.ts
import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Replies with Pong!');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.reply('Pong! 🏓');
}
```

**2. Register it in `ready.ts`:**

```ts
import * as pingCmd from '../commands/ping.js';

export const commandsList = [
  pingCmd,
  // ... other commands
];
```

The command is now automatically registered and routed on the next bot restart.

---

## 9. Keeping Commands Updated on Push

Every Railway deploy restarts the bot → the `ready` event fires → commands are re-registered in all guilds. **No extra tooling needed.**

For local development, restart the dev server (`npm run dev`) after adding or modifying commands.

---

## 10. Production Checklist

Before going live, verify the following:

- [ ] `.env` is in `.gitignore` — never commit secrets
- [ ] `DISCORD_TOKEN` and `DATABASE_URL` are set in Railway's Variables tab (not in source code)
- [ ] Migrations have been generated and committed
- [ ] `startCommand` in `railway.json` runs `npm run migrate` before starting
- [ ] `restartPolicyType` is set to `ON_FAILURE` in `railway.json`
- [ ] `sleepApplication` is `false` so the bot stays online
- [ ] Bot has the correct OAuth2 permissions and intents enabled in the Developer Portal
- [ ] `npm test` passes locally before pushing (`lint → tsc → vitest`)
- [ ] Logging level is `info` in production (not `debug` — too noisy)

---

## Quick Reference

| Task | Command |
|---|---|
| Install dependencies | `npm install` |
| Run in development | `npm run dev` |
| Build for production | `npm run build` |
| Start production build | `npm start` |
| Generate DB migrations | `npm run generate` |
| Apply DB migrations | `npm run migrate` |
| Run all tests | `npm test` |
| Lint source files | `npm run lint` |
