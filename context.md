# Sector 0: 3D First-Person Shooter & Cyberpunk Outpost — Context Brief

## 1. Project Snapshot
- **Core**: Sector 0 — 3D First Person Shooter (FPS) + Tycoon + Breach Survival RPG in the browser.
- **Tech Stack**: Three.js (WebGL), Turborepo 2.x, Node.js 20+, TypeScript 5.7, Vite 6, React 19, TailwindCSS, Vitest 2+, 100% Offline Procedural Audio & WebGL textures.
- **Theme & Aesthetics**: Gritty industrial cyberpunk (Platform 04 beneath Neo-Vanguard). Neon cyan/magenta lighting, dark metallic subway textures, glowing energy conduits, custom 3D low-poly robotic chassis. **Strictly NO medieval tropes and NO emojis**.
- **Core Loops**:
  1. *3D Spatial Door Unlocking (COD Zombies style)*: Walk up to 3D pneumatic blast doors and barricades, press [E] to spend credits/scrap to open and expand into new 3D sectors (Power Sub-Station, Chop-Shop, Ripper Clinic, Mag Junction, Deep Vault).
  2. *First-Person Combat*: PointerLock controls (WASD, Mouse Look, Left-Click Fire, R Reload, Space Jump). First-person gun viewmodel with recoil, muzzle flash, and laser tracers against rogue corporate security droids.
  3. *3D Stationed Comrades*: Rescued street survivors physically rendered at 3D workstations (Scrappers welding machinery, Netrunners typing at holographic server racks, Enforcers defending blast doors).
  4. *Weapon Overclocking ("Pack-a-Punch")*: Upgrade kinetic ballistic weapons into high-voltage plasma weapons with elemental effects and neon color shifts at the Chop-Shop lathe.
  5. *Cyber-Perks ("Perk-a-Colas")*: Bio-synthetic enhancements (Titan Subdermal, Overclock Stim, Smart-Link, Trauma Ghost, EMP Capacitance).
  6. *Realistic Breach Consequences*: Escalating corporate raid threat, blast doors breached, terminals damaged, comrades injured, safehouse clinic trauma revival.

## 2. Directory Layout
- `apps/web/src/cyberpunk/engine3d/`: 3D WebGL engine (Three.js scene, procedural materials, sector geometry, articulated viewmodel arms & 4 unique guns, traveling projectile engine, articulated droids, comrades, procedural audio).
- `apps/web/src/cyberpunk/`: Cyberpunk UI client (HUD, Chop-Shop, Clinic, Comrade Manager, Breach Banner).
- `packages/core/src/cyberpunk/`: Core simulation engine (sectors, comrades, weapons, overclocking, combat math, raids).
- `tests/cyberpunk.test.ts` & `tests/cyberpunk3dVisuals.test.ts`: Vitest test suites for core cyberpunk mechanics and 3D visual/projectile math.

## 3. Visual & Audio Fidelity
- **Articulated First-Person Viewmodel**: Tactical sleeves, cybernetic forearms, and finger segments gripping weapons naturally, with magazine reload animations.
- **4 Distinct 3D Weapon Models**: Pistol (Pulse Stinger), Auto-Shotgun (Riot-Breaker), SMG (Neon Hyper-Cutter), Heavy Rail-Rifle (The Orbital Lance).
- **3D Traveling Projectiles**: Real physical meshes with dynamic point lights, spark trails, and sub-step anti-tunneling raycasts (plasma bolts, 8-pellet spread, laser darts, piercing rail slugs).
- **Modular Articulated Droids**: Flying rotor drones with spotlights, bipedal androids with walking stride cycles, shock hounds with flexible spines, and heavy titan mechs with hydraulic pistons and chest reactor core weakpoints (2.5x crit).
- **Tactical Player Legs**: Visible cybernetic legs and combat boots with walking strides when looking down.

## 4. Key Rules & Constraints
- **Primary Dev Command**: `npm run dev` boots the web dev server with sub-second HMR.
- **100% Offline**: Zero cloud dependence, zero external DBs, runs completely locally.
- **Strict Git Rules**: NEVER execute `git push`. Incremental `git add` & `git commit` on each logical step.
