import * as THREE from 'three';
import {
  type BlastDoorId,
  type CombatEnemy,
  type CyberpunkGameState,
  type SectorId,
  type WeaponId,
  calculateShotDamage,
  applyEnemyDamageToPlayer,
  unlockDoor,
  triggerEmpDischarge,
  switchWeapon,
  generateWaveEnemies,
  repelRaid,
} from '@arcanora/core';
import { SectorBuilder } from './SectorBuilder.js';
import { Viewmodel3D } from './Viewmodel3D.js';
import { EnemyDroids3D } from './EnemyDroids3D.js';
import { Comrades3D } from './Comrades3D.js';
import { FpsControls } from './FpsControls.js';
import { sounds } from './SoundManager.js';
import type { RaycastInteraction } from './types3d.js';

export interface FpsSceneCallbacks {
  onStateUpdate: (updater: (prev: CyberpunkGameState) => CyberpunkGameState) => void;
  onOpenModal: (type: 'chop_shop' | 'clinic' | 'comrade' | 'salvage', targetId?: string) => void;
  onPlayerHit: (isHeadshot: boolean, killed: boolean) => void;
}

export class FpsScene {
  readonly scene: THREE.Scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;

  readonly sectorBuilder: SectorBuilder;
  readonly viewmodel: Viewmodel3D;
  readonly enemyDroids: EnemyDroids3D;
  readonly comrades3d: Comrades3D;
  readonly controls: FpsControls;

  private clock = new THREE.Clock();
  private animFrameId: number | null = null;
  private isDestroyed = false;

  private lastFireTime = 0;
  private isReloading = false;
  private reloadTimer = 0;

  private isWaveActive = false;
  private waveCooldownTimer = 1.5;
  private raidSpawned = false;

  private gameState: CyberpunkGameState;
  private callbacks: FpsSceneCallbacks;

  constructor(
    container: HTMLElement,
    initialState: CyberpunkGameState,
    callbacks: FpsSceneCallbacks
  ) {
    this.gameState = initialState;
    this.callbacks = callbacks;

    // 1. Setup Camera & Renderer
    this.camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      150
    );
    this.camera.position.set(0, 1.75, 5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    // Cyberpunk Atmosphere & Depth Fog
    this.scene.background = new THREE.Color(0x050814);
    this.scene.fog = new THREE.FogExp2(0x050814, 0.018);

    // Ambient Lighting
    const ambientLight = new THREE.AmbientLight(0x0c192c, 0.8);
    this.scene.add(ambientLight);

    // 2. Initialize Subsystems
    this.sectorBuilder = new SectorBuilder();
    this.sectorBuilder.buildWorld(this.gameState);
    this.scene.add(this.sectorBuilder.rootGroup);

    this.viewmodel = new Viewmodel3D();
    this.viewmodel.setWeapon(this.gameState.player.equippedWeapon);
    this.camera.add(this.viewmodel.rootGroup);
    this.scene.add(this.camera);

    this.enemyDroids = new EnemyDroids3D();
    this.scene.add(this.enemyDroids.rootGroup);

    this.comrades3d = new Comrades3D();
    this.comrades3d.syncComrades(this.gameState.comrades);
    this.scene.add(this.comrades3d.rootGroup);

    // 3. Setup Controls
    this.controls = new FpsControls(this.camera, this.renderer.domElement);
    this.setupControlCallbacks();

    // 4. Handle Window Resize
    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);

    // 5. Initial Spawning of Droids if raid is active
    if (this.gameState.raidState.isActive) {
      this.spawnRaidSquad();
    }

    // 6. Start Render Loop
    this.startLoop();
  }

  private setupControlCallbacks() {
    this.controls.onFire = () => this.handlePlayerShoot();
    this.controls.onReload = () => this.handlePlayerReload();
    this.controls.onInteract = (interaction) => this.handlePlayerInteract(interaction);
    this.controls.onSwitchWeapon = (baseId) => this.handleWeaponSwitch(baseId);
  }

  private handleWeaponSwitch(baseId: WeaponId) {
    if (this.gameState.player.equippedWeapon.baseId === baseId) return;
    const res = switchWeapon(this.gameState, baseId);
    if (res.success) {
      this.gameState = res.newState;
      this.viewmodel.setWeapon(res.newState.player.equippedWeapon);
      sounds.playWeaponSwitch();
      this.callbacks.onStateUpdate(() => res.newState);
    }
  }

  private handleResize() {
    if (!this.renderer || !this.renderer.domElement.parentElement) return;
    const parent = this.renderer.domElement.parentElement;
    this.camera.aspect = parent.clientWidth / parent.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(parent.clientWidth, parent.clientHeight);
  }

  updateGameState(nextState: CyberpunkGameState) {
    const prevWeapon = this.gameState.player.equippedWeapon;
    this.gameState = nextState;

    if (prevWeapon.id !== nextState.player.equippedWeapon.id) {
      this.viewmodel.setWeapon(nextState.player.equippedWeapon);
    }

    this.comrades3d.syncComrades(nextState.comrades);

    // Check if any doors unlocked that need 3D visual opening
    for (const [id, door] of Object.entries(nextState.doors)) {
      if (door.unlocked) {
        this.sectorBuilder.unlockDoor3D(id as BlastDoorId);
      }
    }

    // Check if corporate raid started
    if (nextState.raidState.isActive && !this.raidSpawned) {
      this.spawnRaidSquad();
    }
  }

  private spawnWave(waveNumber: number) {
    const unlockedCount = Object.values(this.gameState.sectors).filter((s) => s.unlocked).length;
    const enemies = generateWaveEnemies(waveNumber, unlockedCount);

    const spawnPoints: THREE.Vector3[] = [];
    spawnPoints.push(new THREE.Vector3(-10, 0, -12), new THREE.Vector3(-10, 0, 12));
    if (this.gameState.sectors.sector_01_power.unlocked) {
      spawnPoints.push(new THREE.Vector3(0, 0, -42), new THREE.Vector3(0, 0, -22));
    }
    if (this.gameState.sectors.sector_02_chop_shop.unlocked) {
      spawnPoints.push(new THREE.Vector3(-38, 0, 0), new THREE.Vector3(-20, 0, 0));
    }
    if (this.gameState.sectors.sector_03_ripper_clinic.unlocked) {
      spawnPoints.push(new THREE.Vector3(0, 0, -78));
    }
    if (this.gameState.sectors.sector_04_mag_junction.unlocked) {
      spawnPoints.push(new THREE.Vector3(-76, 0, 4));
    }
    if (this.gameState.sectors.sector_05_deep_vault.unlocked) {
      spawnPoints.push(new THREE.Vector3(-76, 0, -50));
    }

    enemies.forEach((enemy, idx) => {
      const sp = spawnPoints[idx % spawnPoints.length].clone();
      sp.x += (Math.random() - 0.5) * 4;
      sp.z += (Math.random() - 0.5) * 4;
      this.enemyDroids.spawnDroid(enemy, sp);
    });

    sounds.playWaveStart();
    this.isWaveActive = true;
  }

  private spawnRaidSquad() {
    const squad = this.gameState.raidState.activeSquad;
    if (squad.length === 0) return;

    let spawnCenter = new THREE.Vector3(0, 0, -28);
    if (this.gameState.raidState.targetDoorId === 'door_chop_shop') {
      spawnCenter = new THREE.Vector3(-20, 0, 0);
    } else if (this.gameState.raidState.targetDoorId === 'door_ripper_clinic') {
      spawnCenter = new THREE.Vector3(0, 0, -60);
    } else if (this.gameState.raidState.targetDoorId === 'door_mag_junction') {
      spawnCenter = new THREE.Vector3(-55, 0, 0);
    } else if (this.gameState.raidState.targetDoorId === 'door_deep_vault') {
      spawnCenter = new THREE.Vector3(-76, 0, -25);
    }

    for (const enemy of squad) {
      const offset = new THREE.Vector3((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6);
      this.enemyDroids.spawnDroid(enemy, spawnCenter.clone().add(offset));
    }

    sounds.playRaidAlarm();
    this.raidSpawned = true;
  }

  private handlePlayerShoot() {
    const weapon = this.gameState.player.equippedWeapon;
    const now = performance.now();

    if (now - this.lastFireTime < weapon.fireRate) return;
    if (this.isReloading) return;

    if (weapon.currentAmmo <= 0) {
      this.handlePlayerReload();
      return;
    }

    this.lastFireTime = now;

    // Deduct ammo in player state
    this.callbacks.onStateUpdate((prev) => ({
      ...prev,
      player: {
        ...prev.player,
        equippedWeapon: {
          ...prev.player.equippedWeapon,
          currentAmmo: prev.player.equippedWeapon.currentAmmo - 1,
        },
      },
    }));

    // Play Sound
    sounds.playShoot(weapon.baseId, weapon.tier > 0);

    // Raycast shot from camera forward
    const camPos = this.camera.position;
    const camDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);

    const shotRay = new THREE.Raycaster(camPos, camDir, 0.1, 100);
    const targetPoint = camPos.clone().addScaledVector(camDir, 50);

    // Test intersection against droids
    let hitAnyDroid = false;
    for (const [droidId, droidInstance] of this.enemyDroids.droids.entries()) {
      const intersects = shotRay.intersectObject(droidInstance.mesh, true);
      if (intersects.length > 0) {
        const hit = intersects[0];
        targetPoint.copy(hit.point);
        hitAnyDroid = true;

        // Headshot detection: hit point near top of droid mesh
        const isHeadshot = hit.point.y > droidInstance.mesh.position.y + 1.6;

        // Calculate damage
        const damageResult = calculateShotDamage(
          this.gameState.player,
          weapon,
          droidInstance.data,
          isHeadshot
        );

        sounds.playHitmarker(isHeadshot);
        this.callbacks.onPlayerHit(isHeadshot, damageResult.killed);

        const killed = this.enemyDroids.damageDroid(
          droidId,
          damageResult.shieldDamage,
          damageResult.hpDamage,
          damageResult.killed
        );

        if (killed && damageResult.lootAwarded) {
          const loot = damageResult.lootAwarded;
          this.callbacks.onStateUpdate((prev) => ({
            ...prev,
            player: {
              ...prev.player,
              credits: prev.player.credits + loot.credits,
              scrap: prev.player.scrap + loot.scrap,
              decryptKeys: prev.player.decryptKeys + (loot.keycardDropped ? 1 : 0),
            },
            stats: {
              ...prev.stats,
              droidsEliminated: prev.stats.droidsEliminated + 1,
            },
          }));
        }
        break;
      }
    }

    // Trigger Viewmodel Recoil, Muzzle Flash, and Laser Tracer
    this.viewmodel.triggerFire(weapon, targetPoint, this.scene);
  }

  private handlePlayerReload() {
    const weapon = this.gameState.player.equippedWeapon;
    if (this.isReloading || weapon.currentAmmo >= weapon.magazineSize) return;

    this.isReloading = true;
    const perkSpeedBonus = this.gameState.player.activePerks.includes('overclock_stim') ? 0.75 : 1.0;
    const duration = weapon.reloadTimeMs * perkSpeedBonus;
    this.reloadTimer = duration / 1000;

    sounds.playReload();
    this.viewmodel.triggerReload(duration);

    // If EMP Capacitance perk is active, discharge EMP shockwave
    if (this.gameState.player.activePerks.includes('emp_capacitance')) {
      this.callbacks.onStateUpdate((prev) => {
        const { newState } = triggerEmpDischarge(prev, 60);
        return newState;
      });
    }

    setTimeout(() => {
      this.isReloading = false;
      this.callbacks.onStateUpdate((prev) => ({
        ...prev,
        player: {
          ...prev.player,
          equippedWeapon: {
            ...prev.player.equippedWeapon,
            currentAmmo: prev.player.equippedWeapon.magazineSize,
          },
        },
      }));
    }, duration);
  }

  private handlePlayerInteract(interaction: RaycastInteraction) {
    if (interaction.type === 'door') {
      const doorId = interaction.id as BlastDoorId;
      const res = unlockDoor(this.gameState, doorId);
      if (res.success) {
        sounds.playDoorOpen();
        this.sectorBuilder.unlockDoor3D(doorId);
        this.callbacks.onStateUpdate(() => res.newState);
      }
    } else if (interaction.type === 'terminal') {
      const term = this.sectorBuilder.terminals.get(interaction.id);
      if (term) {
        if (term.data.type === 'chop_shop') {
          this.callbacks.onOpenModal('chop_shop', interaction.id);
        } else if (term.data.type === 'clinic') {
          this.callbacks.onOpenModal('clinic', interaction.id);
        } else {
          this.callbacks.onOpenModal('salvage', interaction.id);
        }
      }
    } else if (interaction.type === 'comrade') {
      this.callbacks.onOpenModal('comrade', interaction.id);
    }
  }

  private startLoop() {
    const loop = () => {
      if (this.isDestroyed) return;
      this.animFrameId = requestAnimationFrame(loop);

      const delta = Math.min(0.1, this.clock.getDelta());

      // 1. Update Controls & Movement
      const isMoving = this.controls.update(
        delta,
        this.gameState,
        this.sectorBuilder,
        this.comrades3d
      );

      // 2. Update Sector Doors
      this.sectorBuilder.updateDoors(delta);

      // 3. Update Comrades
      this.comrades3d.update(delta);

      // 4. Update Wave & Corporate Raid Cycle
      if (this.gameState.raidState.isActive) {
        if (!this.raidSpawned) {
          this.spawnRaidSquad();
        } else if (this.enemyDroids.droids.size === 0) {
          // Raid defeated!
          this.raidSpawned = false;
          sounds.playWaveClear();
          this.callbacks.onStateUpdate((prev) => {
            const { newState } = repelRaid(prev);
            return newState;
          });
        }
      } else {
        // Normal Wave cycle
        if (this.isWaveActive && this.enemyDroids.droids.size === 0) {
          this.isWaveActive = false;
          this.waveCooldownTimer = 5.0;
          sounds.playWaveClear();

          const waveBonus = 150 * this.gameState.stats.currentWave;
          const scrapBonus = 15 * this.gameState.stats.currentWave;

          this.callbacks.onStateUpdate((prev) => ({
            ...prev,
            player: {
              ...prev.player,
              credits: prev.player.credits + waveBonus,
              scrap: prev.player.scrap + scrapBonus,
            },
            stats: {
              ...prev.stats,
              currentWave: prev.stats.currentWave + 1,
            },
          }));
        } else if (!this.isWaveActive) {
          this.waveCooldownTimer -= delta;
          if (this.waveCooldownTimer <= 0) {
            this.spawnWave(this.gameState.stats.currentWave);
          }
        }
      }

      // 5. Update Enemy Droids with sectorBuilder for locked door collisions
      this.enemyDroids.update(delta, this.camera.position, this.sectorBuilder, (damage) => {
        sounds.playPlayerHurt();
        this.callbacks.onStateUpdate((prev) => {
          const { updatedPlayer } = applyEnemyDamageToPlayer(prev.player, damage);
          return {
            ...prev,
            player: updatedPlayer,
          };
        });
      });

      // 5. Update Viewmodel
      this.viewmodel.update(delta, isMoving, this.scene);

      // 6. Render
      this.renderer.render(this.scene, this.camera);
    };

    loop();
  }

  destroy() {
    this.isDestroyed = true;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    window.removeEventListener('resize', this.handleResize);

    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  }
}
