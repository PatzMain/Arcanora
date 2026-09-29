# Sector 0: 3D First-Person Shooter Cyberpunk Outpost Checklist

- [ ] **Phase 1: Core Cyberpunk Domain Logic (`packages/core/src/cyberpunk/`)**
  - [ ] Implement `weapons.ts`: Weapon stats, Chop-Shop Overclocking ("Pack-a-Punch"), and Cyber-Perks
  - [ ] Implement `combatEngine.ts`: Damage calculations, headshots, elemental affinities, wave droid spawning
  - [ ] Implement `raids.ts`: Breach alarms, corporate droid raids, terminal damage, and trauma revival
  - [ ] Implement `index.ts` in `packages/core/src/cyberpunk/` and export from `packages/core/src/index.ts`
  - [ ] Add unit tests in `tests/cyberpunk.test.ts` verifying doors, comrades, overclocking, perks, combat, and raids

- [ ] **Phase 2: 3D WebGL / Three.js FPS Engine (`apps/web/src/cyberpunk/engine3d/`)**
  - [ ] Implement `types3d.ts`: Interfaces for 3D entities, doors, comrades, droids, viewmodel
  - [ ] Implement `materials.ts`: Procedural canvas textures (cyber concrete, hazard stripes, neon circuits, weathered metal)
  - [ ] Implement `SectorBuilder.ts`: 3D construction of Platform 04 subway station, corridors, and animated pneumatic blast doors
  - [ ] Implement `Viewmodel3D.ts`: 3D first-person gun model with sway, firing recoil, muzzle flash, and laser tracers
  - [ ] Implement `Comrades3D.ts`: 3D stylized NPC comrades physically stationed at interactive workstations
  - [ ] Implement `EnemyDroids3D.ts`: 3D security droids with hover/bipedal models, navigation, hit reactions, and robotic debris
  - [ ] Implement `FpsControls.ts`: PointerLockControls with WASD movement, jump, collision detection, and proximity raycasting
  - [ ] Implement `SoundManager.ts`: Procedural Web Audio API sound synthesizer (100% offline gunshots, hits, doors, alarms)
  - [ ] Implement `FpsScene.ts`: Master Three.js scene loop orchestrating rendering, audio, and gameplay interactions

- [ ] **Phase 3: Cyberpunk React UI & HUD (`apps/web/src/cyberpunk/`)**
  - [ ] Implement `cyberpunk.css`: Neon styling, crosshair, ammo counter, health/shield bars, scanlines, modal dialogs
  - [ ] Implement `CyberHUD.tsx`: Real-time 3D FPS HUD with interact prompts (`[E] OPEN BLAST DOOR - 350 CR`), hit markers, ammo, perks
  - [ ] Implement `ChopShopModal.tsx`: Weapon Overclock bench ("Pack-a-Punch")
  - [ ] Implement `ClinicModal.tsx`: Cyber-Perk vending terminal ("Perk-a-Colas")
  - [ ] Implement `ComradeModal.tsx`: Comrade manager and role assignment
  - [ ] Implement `BreachBanner.tsx`: Corporate raid threat warnings and alert sirens
  - [ ] Implement `CyberpunkFpsGame.tsx`: Main 3D FPS game component with canvas mount, controls, and offline save/load
  - [ ] Integrate into `apps/web/src/App.tsx` with dedicated "Sector 0: 3D Cyberpunk FPS" mode

- [ ] **Phase 4: Verification, Build & Testing**
  - [ ] Run `npm test` / vitest and ensure all cyberpunk unit tests pass
  - [ ] Run `npm run build` and ensure all packages compile cleanly in FULL TURBO
  - [ ] Update `context.md` and `CONTEXT_HANDOFF.md`
  - [ ] Commit incremental changes following git workflow conventions
