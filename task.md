# Sector 0: 3D First-Person Shooter Cyberpunk Outpost Checklist

- [x] **Phase 1: Core Cyberpunk Domain Logic (`packages/core/src/cyberpunk/`)**
  - [x] Implement `weapons.ts`: Weapon stats, Chop-Shop Overclocking ("Pack-a-Punch"), and Cyber-Perks
  - [x] Implement `combatEngine.ts`: Damage calculations, headshots, elemental affinities, wave droid spawning
  - [x] Implement `raids.ts`: Breach alarms, corporate droid raids, terminal damage, and trauma revival
  - [x] Implement `index.ts` in `packages/core/src/cyberpunk/` and export from `packages/core/src/index.ts`
  - [x] Add unit tests in `tests/cyberpunk.test.ts` verifying doors, comrades, overclocking, perks, combat, and raids

- [x] **Phase 2: 3D WebGL / Three.js FPS Engine (`apps/web/src/cyberpunk/engine3d/`)**
  - [x] Implement `types3d.ts`: Interfaces for 3D entities, doors, comrades, droids, viewmodel
  - [x] Implement `materials.ts`: Procedural canvas textures (cyber concrete, hazard stripes, neon circuits, weathered metal)
  - [x] Implement `SectorBuilder.ts`: 3D construction of Platform 04 subway station, corridors, and animated pneumatic blast doors
  - [x] Implement `Viewmodel3D.ts`: 3D first-person gun model with sway, firing recoil, muzzle flash, and laser tracers
  - [x] Implement `Comrades3D.ts`: 3D stylized NPC comrades physically stationed at interactive workstations
  - [x] Implement `EnemyDroids3D.ts`: 3D security droids with hover/bipedal models, navigation, hit reactions, and robotic debris
  - [x] Implement `FpsControls.ts`: PointerLockControls with WASD movement, jump, collision detection, and proximity raycasting
  - [x] Implement `SoundManager.ts`: Procedural Web Audio API sound synthesizer (100% offline gunshots, hits, doors, alarms)
  - [x] Implement `FpsScene.ts`: Master Three.js scene loop orchestrating rendering, audio, and gameplay interactions

- [x] **Phase 3: Cyberpunk React UI & HUD (`apps/web/src/cyberpunk/`)**
  - [x] Implement `cyberpunk.css`: Neon styling, crosshair, ammo counter, health/shield bars, scanlines, modal dialogs
  - [x] Implement `CyberHUD.tsx`: Real-time 3D FPS HUD with interact prompts (`[E] OPEN BLAST DOOR - 350 CR`), hit markers, ammo, perks
  - [x] Implement `ChopShopModal.tsx`: Weapon Overclock bench ("Pack-a-Punch")
  - [x] Implement `ClinicModal.tsx`: Cyber-Perk vending terminal ("Perk-a-Colas")
  - [x] Implement `ComradeModal.tsx`: Comrade manager and role assignment
  - [x] Implement `BreachBanner.tsx`: Corporate raid threat warnings and alert sirens
  - [x] Implement `CyberpunkFpsGame.tsx`: Main 3D FPS game component with canvas mount, controls, and offline save/load
  - [x] Integrate into `apps/web/src/App.tsx` with dedicated "Sector 0: 3D Cyberpunk FPS" mode

- [x] **Phase 4: Verification, Build & Testing**
  - [x] Run `npm test` / vitest and ensure all cyberpunk unit tests pass (23 passed)
  - [x] Run `npm run build` and ensure all packages compile cleanly in FULL TURBO
  - [x] Update `context.md` and `CONTEXT_HANDOFF.md`
  - [x] Commit incremental changes following git workflow conventions
