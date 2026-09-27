# Arcanora Web RPG Revival Checklist

- [ ] **Phase 0: Workspace & Git Worktree Setup**
  - [ ] Create isolated Git worktree `worktree-web-revival` for monorepo & frontend overhaul
  - [ ] Verify clean baseline test pass (`npm test`)

- [ ] **Phase 1: Turborepo Monorepo & Framework Modernization**
  - [ ] Add `turbo.json` with pipeline tasks (`build`, `test`, `lint`, `dev`)
  - [ ] Configure `workspaces: ["apps/*", "packages/*"]` in root `package.json`
  - [ ] Modernize dependencies: Vite 6, React 19, TypeScript 5.7, TailwindCSS, Vitest 2+
  - [ ] Set up root scripts: `"dev": "turbo run dev --filter=@arcanora/web"`, `"build": "turbo run build"`, etc.

- [ ] **Phase 2: Decoupled Core Engine & Zero-Cloud Database**
  - [ ] Scaffold `packages/database/` with Drizzle ORM, schema, migrations, and PGlite WASM adapter (IndexedDB)
  - [ ] Scaffold `packages/core/` with decoupled universal game systems (combat, elements, tactics, dungeon, inventory, progression)
  - [ ] Implement `packages/core/src/sandbox/devCheats.ts` (Instant Heal/Stamina, Grant Gold, Level Jump, Teleport)
  - [ ] Add unit tests for PGlite persistence and core queries (`tests/pglite.test.ts`)

- [ ] **Phase 3: Tactical Combat Engine & Elemental Synergies**
  - [ ] Implement 6 elemental affinities and synergy triggers (Electrocute, Shatter, Hellfire)
  - [ ] Implement enemy intent telegraphing and player Guard/Parry counters
  - [ ] Integrate synergies and telegraphed actions into combat engine
  - [ ] Add unit tests for combat synergies and tactics (`tests/combatSynergies.test.ts`)

- [ ] **Phase 4: Web Client Setup & Custom Asset Library (No Emojis)**
  - [ ] Scaffold `apps/web/` with Vite 6 + React 19 + TailwindCSS
  - [ ] Configure typography: `Press Start 2P`, `Cinzel`, `Inter` via `@font-face`
  - [ ] Build custom SVG game asset library: elements, weapons, armor, potions, vitals, class crests
  - [ ] Build graphical dungeon tile renderer (stone floors, walls, animated chests, staircases, campfires)

- [ ] **Phase 5: Interactive Web UI Screens & Animations**
  - [ ] **Header HUD & Navigation**: Vital bars (HP/Mana/Stamina/Exp), currency indicators, screen tabs
  - [ ] **Interactive Canvas World Map**: Base pixel map, animated gold pulse beacon, animated marching dashed paths, fog-of-war masks, click-to-travel
  - [ ] **Animated Tactical Battle Arena**: Hero vs Monster card, enemy intent banner, floating damage numbers, screen shake on criticals, reactive Guard/Parry button
  - [ ] **2D Grid Dungeon Crawler**: 6x6 graphical tile renderer, real-time line-of-sight illumination, smooth WASD / D-Pad movement, interactive room modals
  - [ ] **Inventory & Paperdoll Equipment**: Visual equipment slots, item cards with rarity frames and tooltips
  - [ ] **Developer Sandbox Toolbar**: Collapsible debug drawer with one-click cheats

- [ ] **Phase 6: Verification, Production Build & Documentation**
  - [ ] Run full build-then-test validation via Turborepo (`npm run build && npm test`)
  - [ ] Verify static build for $0/mo deployment to GitHub Pages / Cloudflare Pages
  - [ ] Update `context.md` and `CONTEXT_HANDOFF.md` with final architecture and usage instructions
  - [ ] Commit all changes following git workflow conventions
