# Arcanora Web RPG Revival Checklist

- [x] **Phase 0: Workspace & Git Worktree Setup**
  - [x] Create isolated Git branch `feat/web-revival` for monorepo & frontend overhaul
  - [x] Verify clean baseline test pass (`npm test`)

- [x] **Phase 1: Turborepo Monorepo & Framework Modernization**
  - [x] Add `turbo.json` with pipeline tasks (`build`, `test`, `lint`, `dev`)
  - [x] Configure `workspaces: ["apps/*", "packages/*"]` in root `package.json`
  - [x] Modernize dependencies: Vite 6, React 19, TypeScript 5.7, TailwindCSS, Vitest 2+
  - [x] Set up root scripts: `"dev": "turbo run dev --filter=@arcanora/web"`, `"build": "turbo run build"`, etc.

- [x] **Phase 2: Decoupled Core Engine & Zero-Cloud Database**
  - [x] Scaffold `packages/database/` with Drizzle ORM, schema, migrations, and PGlite WASM adapter (IndexedDB)
  - [x] Scaffold `packages/core/` with decoupled universal game systems (combat, elements, tactics, dungeon, inventory, progression)
  - [x] Implement `packages/core/src/sandbox/devCheats.ts` (Instant Heal/Stamina, Grant Gold, Level Jump, Teleport)
  - [x] Add unit tests for PGlite persistence and core queries (`tests/pglite.test.ts`)

- [x] **Phase 3: Tactical Combat Engine & Elemental Synergies**
  - [x] Implement 6 elemental affinities and synergy triggers (Electrocute, Shatter, Hellfire)
  - [x] Implement enemy intent telegraphing and player Guard/Parry counters
  - [x] Integrate synergies and telegraphed actions into combat engine
  - [x] Add unit tests for combat synergies and tactics (`tests/combatSynergies.test.ts`)

- [x] **Phase 4: Web Client Setup & Custom Asset Library (No Emojis)**
  - [x] Scaffold `apps/web/` with Vite 6 + React 19 + TailwindCSS
  - [x] Configure typography: `Press Start 2P`, `Cinzel`, `Inter` via `@font-face`
  - [x] Build custom SVG game asset library: elements, weapons, armor, potions, vitals, class crests
  - [x] Build graphical dungeon tile renderer (stone floors, walls, animated chests, staircases, campfires)

- [x] **Phase 5: Interactive Web UI Screens & Animations**
  - [x] **Header HUD & Navigation**: Vital bars (HP/Mana/Stamina/Exp), currency indicators, screen tabs
  - [x] **Interactive Canvas World Map**: Base pixel map, animated gold pulse beacon, animated marching dashed paths, fog-of-war masks, click-to-travel
  - [x] **Animated Tactical Battle Arena**: Hero vs Monster card, enemy intent banner, floating damage numbers, screen shake on criticals, reactive Guard/Parry button
  - [x] **2D Grid Dungeon Crawler**: 6x6 graphical tile renderer, real-time line-of-sight illumination, smooth WASD / D-Pad movement, interactive room modals
  - [x] **Inventory & Paperdoll Equipment**: Visual equipment slots, item cards with rarity frames and tooltips
  - [x] **Developer Sandbox Toolbar**: Collapsible debug drawer with one-click cheats

- [x] **Phase 6: Verification, Production Build & Documentation**
  - [x] Run full build-then-test validation via Turborepo (`npm run build && npm test`)
  - [x] Verify static build for $0/mo deployment to GitHub Pages / Cloudflare Pages
  - [x] Update `context.md` and `CONTEXT_HANDOFF.md` with final architecture and usage instructions
  - [x] Commit all changes following git workflow conventions
