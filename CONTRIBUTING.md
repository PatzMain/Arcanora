# Contributing to Arcanora

Thank you for your interest in contributing! Arcanora is a Discord MMORPG bot built on TypeScript, discord.js v14, and PostgreSQL. Contributions of all kinds are welcome — bug fixes, new game content, commands, systems, tests, and documentation.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Setup](#development-setup)
3. [Project Architecture](#project-architecture)
4. [Types of Contributions](#types-of-contributions)
5. [Coding Standards](#coding-standards)
6. [Commit Conventions](#commit-conventions)
7. [Pull Request Process](#pull-request-process)
8. [Running Tests](#running-tests)

---

## Getting Started

1. **Fork** this repository
2. **Clone** your fork locally
3. **Create a branch** for your change: `git checkout -b feat/your-feature-name`
4. **Make your changes**, following the guidelines below
5. **Test** your changes: `npm test`
6. **Push** and open a **Pull Request**

---

## Development Setup

### Prerequisites

- Node.js ≥ 20
- A PostgreSQL database (local or cloud)
- A Discord bot application with a test server

### Steps

```bash
# Install dependencies
npm install

# Copy and fill in environment variables
cp .env.example .env

# Run DB migrations
npm run migrate

# Start in development mode (hot-reload)
npm run dev
```

See [`TEMPLATE.md`](./TEMPLATE.md) for a complete setup walkthrough.

---

## Project Architecture

| Path | Purpose |
|---|---|
| `src/index.ts` | Entry point — Discord client, event bindings, shutdown handler |
| `src/events/ready.ts` | Startup — command registration (per-guild, instant propagation) |
| `src/events/interactionCreate.ts` | Routes all slash commands, buttons, select menus, and modals |
| `src/commands/` | Slash command definitions and handlers, organized by category |
| `src/systems/` | Core game logic — combat, quests, crafting, pets, etc. |
| `src/database/` | Drizzle ORM client, schema, migrations, query helpers |
| `src/utils/` | Shared utilities — embeds, logger, catalog, registry, rate limit |
| `data/` | Static JSON game data (items, enemies, quests, locations, classes) |
| `tests/` | Vitest unit and integration tests |

### Key Conventions

- **Add a command**: Create file in `src/commands/<category>/`, then add to `commandsList` in `src/events/ready.ts`
- **Add game content**: Add a JSON file to `data/<type>/` — the catalog auto-loads it at startup
- **Add a DB table**: Update `src/database/schema.ts`, then run `npm run generate` and commit the migration
- **Custom IDs**: Format as `prefix_action_userId_param` with `_` delimiters; verify index offsets in the handler match exactly
- **Embeds**: Use the color constants from `src/utils/embeds/base.ts` — context-aware colors (COMBAT, SHOP, QUEST, etc.)

---

## Types of Contributions

### 🐛 Bug Fixes
- Open an issue first for non-trivial bugs so we can align on the fix
- Include the steps to reproduce in the PR description

### ⚔️ New Game Content (Items, Enemies, Quests, Locations)
- Add JSON files to the appropriate `data/` subdirectory
- Follow the existing schema — check a nearby file of the same type for reference
- Stat values must be multiples of 10 (base stats)
- Enemy encounter weights must sum to exactly 100 per location

### 🔧 New Commands
- Export `data` (a `SlashCommandBuilder`) and `execute` from your command file
- Add to `commandsList` in `src/events/ready.ts`
- Handle errors with `try/catch` and respond with `errorEmbed()`

### 🗄️ Database Schema Changes
- Edit `src/database/schema.ts`
- Run `npm run generate` to create a migration
- Commit both the schema change and the migration file together

### 📝 Documentation
- Keep `CONTEXT_HANDOFF.md` updated when you change features, systems, or structure
- Update `README.md` if the project setup or feature list changes

---

## Coding Standards

- **TypeScript strict mode** — no `any` without justification, no implicit `any`
- **ESM imports** — always include `.js` file extensions in import paths (e.g., `'../utils/logger.js'`)
- **Error handling** — all command `execute()` functions must have a top-level `try/catch`
- **Logging** — use the shared `logger` from `src/utils/logger.ts` (Pino), not `console.log`
- **No hardcoded IDs** — game values belong in `data/` JSON files, not in source code
- **Linting** — `npm run lint` must pass with zero errors before submitting a PR

---

## Commit Conventions

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>: <short description>
```

| Prefix | When to use |
|---|---|
| `feat:` | New feature or game mechanic |
| `fix:` | Bug fix |
| `refactor:` | Code restructuring with no behavior change |
| `docs:` | Documentation changes |
| `chore:` | Dependency updates, build config, tooling |
| `test:` | Adding or updating tests |

**Examples:**
```
feat: add /codex bestiary command with pagination
fix: resolve combat interaction routing for dungeon boss nodes
docs: update README with new /play command usage
```

---

## Pull Request Process

1. Ensure `npm test` passes fully (lint → tsc → vitest)
2. Write a clear PR description:
   - **What** was changed and **why**
   - Any relevant issue numbers (`Closes #123`)
   - Screenshots or logs if it's a UI or behavioral change
3. Keep PRs focused — one feature or fix per PR
4. Be responsive to review feedback

---

## Running Tests

```bash
# Full test pipeline (lint + type check + unit tests)
npm test

# Just the unit tests
npx vitest run

# Watch mode for TDD
npx vitest
```

Tests live in `tests/`. When adding new systems or commands, add a corresponding test file.

---

## Questions?

Open a [GitHub Discussion](https://github.com/PatzMain/Arcanora/discussions) or join the Discord server for real-time help.
