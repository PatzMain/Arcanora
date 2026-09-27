# Arcanora — Modular Context Brief

## 1. Project Snapshot
- **Core**: Turborepo Monorepo powering a standalone Visual Web RPG & Universal Game Engine.
- **Tech Stack**: Turborepo 2.x, Node.js 20+, TypeScript 5.7, Vite 6, React 19, TailwindCSS, Drizzle ORM, Embedded In-Browser WebAssembly PostgreSQL (`@electric-sql/pglite` + IndexedDB), HTML5 Canvas, Vitest 2+.
- **Visual Design**: 100% Custom SVG assets, custom typography (`Press Start 2P`, `Cinzel`, `Inter`), animated Canvas pixel world map, graphical 2D dungeon crawler tiles. **Strictly NO emojis in the primary UI**.
- **Data Architecture**: Data-first catalog in `data/` (JSON for classes, enemies, items, locations, quests, recipes, pets, achievements) loaded into memory registries.

## 2. Scalable Monorepo Layout
- `turbo.json`: Turborepo 2.x pipeline orchestration with task caching and parallelization.
- `apps/web/`: Primary Web Game Client (Vite 6 + React 19 + Tailwind + PGlite IndexedDB).
- `apps/bot/`: Decoupled Discord Bot (discord.js + Drizzle).
- `packages/core/`: Decoupled universal game engine (combat, elemental synergies, tactics, 2D dungeon crawler, world exploration, inventory, progression, developer cheats).
- `packages/database/`: Drizzle schema, DB client factory (`pglite` / `pg`), embedded migrator, and query layer.
- `assets/`: Custom fonts (`PressStart2P.ttf`), pixel world map (`world_map.png`), and custom vector SVG asset icons.
- `data/`: Entity JSON catalogs.

## 3. Key Rules & Constraints
- **Primary Dev Command**: `npm run dev` boots the interactive Web Game development server via Turborepo (`turbo run dev --filter=@arcanora/web`) with sub-second HMR and zero cloud dependencies.
- **Zero Cloud Dependence**: 100% offline local development and client-side browser execution via PGlite WASM + IndexedDB ($0/mo static deployment on GitHub Pages / Cloudflare Pages).
- **Strict Git Rules**: NEVER execute `git push`. Incremental `git add` & `git commit` on each logical step. Major changes run on isolated `git worktree`.
- **Low Token & High Signal**: Clean modular code; no `.env.local` generation; build-then-test verification before completion.
