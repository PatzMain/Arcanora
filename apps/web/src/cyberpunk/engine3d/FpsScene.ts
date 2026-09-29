import * as THREE from 'three';
import {
  type BlastDoorId,
  type CombatEnemy,
  type CyberpunkGameState,
  type SectorId,
  calculateShotDamage,
  applyEnemyDamageToPlayer,
  unlockDoor,
  triggerEmpDischarge,
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

    // 5. Initial Spawning of Droids if wave is active
    this.syncEnemiesWithGameState();

    // 6. Start Render Loop
    this.startLoop();
  }

  private setupControlCallbacks() {
    this.controls.onFire = () => this.handlePlayerShoot();
    this.controls.onReload = () => this.handlePlayerReload();
    this.controls.onInteract = (interaction) => this.handlePlayerInteract(interaction);
  }

  private handleResize() {
    if (!this.renderer || !this.renderer.domElement.parentElement) return;
    const parent = this.renderer.domElement.parentElement;
    this.camera.aspect = parent.clientWidth / parent.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(parent.clientWidth, parent.clientHeight);
  }

  updateGameState(nextState: CyberpunkGameState) {
    this.gameState = nextState;
    this.viewmodel.setWeapon(nextState.player.equippedWeapon);
    this.comrades3d.syncComrades(nextState.comrades);

    // Check if any doors unlocked that need 3D visual opening
    for (const [id, door] of Object.entries(nextState.doors)) {
      if (door.unlocked) {
        this.sectorBuilder.unlockDoor3D(id as BlastDoorId);
      }
    }
  }

  private syncEnemiesWithGameState() {
    // If raid is active, spawn active squad droids into 3D world
    if (this.gameState.raidState.isActive && this.enemyDroids.droids.size === 0) {
      const spawnCenter = new THREE.Vector3(0, 0, -28);
      for (const enemy of this.gameState.raidState.activeSquad) {
        const offset = new THREE.Vector3(
          (Math.random() - 0.5) * 8,
          0,
          (Math.random() - 0.5) * 8
        );
        this.enemyDroids.spawnDroid(enemy, spawnCenter.clone().add(offset));
      }
    }
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

      // 4. Update Enemy Droids
      this.enemyDroids.update(delta, this.camera.position, (damage) => {
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
