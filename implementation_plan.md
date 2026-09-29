# Implementation Plan — Sector 0: 3D First-Person Shooter & Cyberpunk Outpost

Convert Sector 0 into a full 3D First Person Shooter (FPS) in the browser powered by Three.js and WebGL with PointerLock controls, featuring Platform 04 subway station, 3D pneumatic blast doors, 3D gun viewmodel, 3D corporate security droids, 3D comrade workstations, weapon overclocking ("Pack-a-Punch"), cyber-perks, and breach defense.

## User Requirements & Architecture
- **Real 3D Environment**: Platform 04 subway station & underground corridors rendered in 3D with neon lighting, dark metallic textures, and spatial sector rooms.
- **First-Person Shooter Controls**: PointerLock controls (Mouse look, WASD walk/strafe, Space jump, Left-click fire, R reload, E interact).
- **3D Viewmodel**: First-person gun model in the player's hands with muzzle flash, recoil animation, and laser tracers.
- **3D COD-Zombies Door Mechanics**: Walk up to 3D pneumatic blast doors, press [E] to spend credits/scrap to open and expand into new 3D sectors.
- **3D Enemies & Combat**: Rogue security droids and combat drones navigating 3D hallways toward the player with hit reactions and explosions.
- **3D Comrades & Tycoon**: Rescued NPC comrades physically stationed at 3D workstations in unlocked sectors (Scrappers dismantling machinery, Netrunners typing at server racks, Turret gunners holding doors).
- **Core Progression Systems**: Weapon Overclocking ("Pack-a-Punch"), Cyber-Perks ("Perk-a-Colas"), breach raids, and 100% offline execution.

## Proposed Changes

### 1. Core Domain Logic (`packages/core/src/cyberpunk/`)
- `types.ts`: Define 3D coordinates, weapon tier stats, overclocking, perks, enemies, and game state.
- `weapons.ts`: Weapon catalogs (4 weapons x 4 tiers), overclocking logic, and cyber-perk definitions.
- `combatEngine.ts`: Damage calculations, headshots, elemental affinities, wave droid spawning.
- `raids.ts`: Threat accumulation, door breach damage, comrade trauma, and revival loop.
- `index.ts`: Export all modules; re-export from `packages/core/src/index.ts`.

### 2. 3D WebGL / Three.js Engine (`apps/web/src/cyberpunk/engine3d/`)
- `types3d.ts`: Interfaces for 3D objects, doors, comrades, droids, viewmodel, particles.
- `materials.ts`: Procedural canvas textures (cyber concrete, hazard stripes, neon circuits, rusted metal).
- `SectorBuilder.ts`: 3D construction of Platform 04, corridors, 5 connected sectors, and pneumatic blast doors with opening animations.
- `Viewmodel3D.ts`: 3D first-person gun model attached to camera with sway, firing recoil, muzzle flash, and laser tracers.
- `Comrades3D.ts`: 3D stylized NPC models at workstations with animation loops (welding sparks, typing).
- `EnemyDroids3D.ts`: 3D security droids with hovering/walking AI, pathfinding to player, hit reactions, and robotic death debris.
- `FpsControls.ts`: PointerLockControls with WASD movement, jump, collision detection, and proximity raycasting.
- `SoundManager.ts`: Procedural Web Audio API sound synthesizer (gunshots, hit markers, headshots, blast doors, perks, alarms) - 100% offline.
- `FpsScene.ts`: Master Three.js scene loop orchestrating all 3D subsystems.

### 3. Cyberpunk React UI & HUD (`apps/web/src/cyberpunk/`)
- `cyberpunk.css`: Neon styling, HUD crosshair, ammo counter, health/shield bars, scanlines, modals.
- `CyberHUD.tsx`: Real-time FPS overlay with interact prompt (`[E] OPEN BLAST DOOR - 350 CR`), hit markers, health/shield/ammo bars, active perks.
- `ChopShopModal.tsx`: Weapon Overclock bench ("Pack-a-Punch").
- `ClinicModal.tsx`: Cyber-Perk vending terminal ("Perk-a-Colas").
- `ComradeModal.tsx`: Comrade manager and role assignment.
- `BreachBanner.tsx`: Corporate raid threat warnings and alert sirens.
- `CyberpunkFpsGame.tsx`: Main component managing 3D canvas, controls, and UI state.
- `apps/web/src/App.tsx`: Add "Sector 0: 3D Cyberpunk FPS" entry point on title screen.

### 4. Verification & Testing
- `tests/cyberpunk.test.ts`: Vitest suite verifying sectors, doors, comrades, overclocking, perks, combat math, and raids.
- `npm run build`: Verify all packages build cleanly.
- `npm test`: Verify unit tests pass.

## Verification Plan
1. Unit tests: Run `npm.cmd run test:vitest` on `tests/cyberpunk.test.ts`.
2. Build integrity: Run `npm.cmd run build` across all workspace packages.
3. Dev verification: Ensure `apps/web` launches cleanly with no bundling errors.
