import * as THREE from 'three';
import type { BlastDoorId, CyberpunkGameState, SectorId } from '@arcanora/core';
import type { SectorBuilder } from './SectorBuilder.js';
import type { Comrades3D } from './Comrades3D.js';
import type { RaycastInteraction } from './types3d.js';

export class FpsControls {
  readonly camera: THREE.PerspectiveCamera;
  readonly domElement: HTMLElement;

  // Rotation angles
  private pitch = 0; // Look up/down (-Math.PI/2 to +Math.PI/2)
  private yaw = 0;   // Turn left/right

  // Movement vectors
  private keysPressed: Set<string> = new Set();
  private velocity = new THREE.Vector3();
  private isGrounded = true;
  private playerHeight = 1.75;
  private moveSpeed = 8.0;
  private sprintMultiplier = 1.45;
  private jumpForce = 6.5;
  private gravity = 18.0;

  // Pointer lock state
  isLocked = false;

  // Raycaster for interactions
  private raycaster = new THREE.Raycaster();
  private currentInteraction: RaycastInteraction = {
    type: 'none',
    id: '',
    name: '',
    prompt: '',
    distance: 0,
  };

  // Callbacks
  onInteract?: (interaction: RaycastInteraction) => void;
  onFire?: () => void;
  onReload?: () => void;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;

    this.initEvents();
  }

  private initEvents() {
    this.domElement.addEventListener('click', () => {
      if (!this.isLocked) {
        this.domElement.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === this.domElement;
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isLocked) return;

      const sensitivity = 0.0022;
      this.yaw -= e.movementX * sensitivity;
      this.pitch -= e.movementY * sensitivity;

      // Clamp pitch to ~85 degrees
      const maxPitch = (Math.PI / 2) * 0.95;
      this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));

      this.updateCameraRotation();
    });

    window.addEventListener('keydown', (e) => {
      this.keysPressed.add(e.code);

      if (this.isLocked) {
        if (e.code === 'KeyE') {
          if (this.currentInteraction.type !== 'none' && this.onInteract) {
            this.onInteract(this.currentInteraction);
          }
        } else if (e.code === 'KeyR') {
          if (this.onReload) this.onReload();
        } else if (e.code === 'Space' && this.isGrounded) {
          this.velocity.y = this.jumpForce;
          this.isGrounded = false;
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keysPressed.delete(e.code);
    });

    window.addEventListener('mousedown', (e) => {
      if (this.isLocked && e.button === 0) {
        if (this.onFire) this.onFire();
      }
    });
  }

  private updateCameraRotation() {
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.x = this.pitch;
    euler.y = this.yaw;
    this.camera.quaternion.setFromEuler(euler);
  }

  getCurrentInteraction(): RaycastInteraction {
    return this.currentInteraction;
  }

  update(
    deltaSec: number,
    state: CyberpunkGameState,
    sectorBuilder: SectorBuilder,
    comrades3d: Comrades3D
  ): boolean {
    if (!this.isLocked) {
      return false;
    }

    // 1. Calculate movement direction relative to camera yaw
    const forward = (this.keysPressed.has('KeyW') ? 1 : 0) - (this.keysPressed.has('KeyS') ? 1 : 0);
    const strafe = (this.keysPressed.has('KeyD') ? 1 : 0) - (this.keysPressed.has('KeyA') ? 1 : 0);
    const isSprinting = this.keysPressed.has('ShiftLeft') || this.keysPressed.has('ShiftRight');

    const inputVec = new THREE.Vector2(strafe, forward);
    const isMoving = inputVec.lengthSq() > 0.01;

    if (isMoving) {
      inputVec.normalize();
    }

    // Apply perk speed bonus
    const speedBonus = state.player.activePerks.includes('overclock_stim') ? 1.35 : 1.0;
    const currentSpeed = this.moveSpeed * (isSprinting ? this.sprintMultiplier : 1.0) * speedBonus;

    // Direction vector in XZ plane
    const moveDir = new THREE.Vector3(
      Math.sin(this.yaw) * -forward + Math.cos(this.yaw) * strafe,
      0,
      Math.cos(this.yaw) * -forward - Math.sin(this.yaw) * strafe
    );

    if (isMoving) {
      moveDir.normalize();
      this.velocity.x = moveDir.x * currentSpeed;
      this.velocity.z = moveDir.z * currentSpeed;
    } else {
      this.velocity.x = 0;
      this.velocity.z = 0;
    }

    // Gravity
    if (!this.isGrounded) {
      this.velocity.y -= this.gravity * deltaSec;
    }

    // New proposed position
    const nextPos = this.camera.position.clone();
    nextPos.x += this.velocity.x * deltaSec;
    nextPos.z += this.velocity.z * deltaSec;
    nextPos.y += this.velocity.y * deltaSec;

    // Floor collision
    if (nextPos.y <= this.playerHeight) {
      nextPos.y = this.playerHeight;
      this.velocity.y = 0;
      this.isGrounded = true;
    }

    // Collision check against locked blast doors
    const playerRadius = 0.5;
    for (const door of sectorBuilder.doors.values()) {
      if (!door.unlocked) {
        if (door.collider.containsPoint(nextPos)) {
          // Push back
          nextPos.x = this.camera.position.x;
          nextPos.z = this.camera.position.z;
          break;
        }
      }
    }

    this.camera.position.copy(nextPos);

    // 2. Raycast forward for COD Zombies interactions
    this.updateRaycastInteraction(state, sectorBuilder, comrades3d);

    return isMoving;
  }

  private updateRaycastInteraction(
    state: CyberpunkGameState,
    sectorBuilder: SectorBuilder,
    comrades3d: Comrades3D
  ) {
    const camPos = this.camera.position;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);

    this.raycaster.set(camPos, forward);
    this.raycaster.far = 4.8;

    let nearestInteraction: RaycastInteraction = {
      type: 'none',
      id: '',
      name: '',
      prompt: '',
      distance: Infinity,
    };

    // 1. Check Blast Doors
    for (const [doorId, doorInstance] of sectorBuilder.doors.entries()) {
      const doorData = state.doors[doorId];
      if (!doorData || doorData.unlocked) continue;

      const doorWorldPos = new THREE.Vector3();
      doorInstance.group.getWorldPosition(doorWorldPos);
      doorWorldPos.y += 2.0;

      const dist = camPos.distanceTo(doorWorldPos);
      if (dist < 4.8 && dist < nearestInteraction.distance) {
        const cost = doorData.cost;
        const credits = cost.credits || 0;
        const scrap = cost.scrap || 0;
        const canAfford = state.player.credits >= credits && state.player.scrap >= scrap;

        const costParts = [];
        if (credits > 0) costParts.push(`${credits} CR`);
        if (scrap > 0) costParts.push(`${scrap} SCRAP`);

        nearestInteraction = {
          type: 'door',
          id: doorId,
          name: doorData.name,
          prompt: `[E] UNLOCK ${doorData.code} — ${costParts.join(' + ')}`,
          costText: costParts.join(' + '),
          canAfford,
          distance: dist,
        };
      }
    }

    // 2. Check Terminals / Workstations
    for (const [termId, termInstance] of sectorBuilder.terminals.entries()) {
      const termWorldPos = new THREE.Vector3();
      termInstance.mesh.getWorldPosition(termWorldPos);
      termWorldPos.y += 1.0;

      const dist = camPos.distanceTo(termWorldPos);
      if (dist < 3.8 && dist < nearestInteraction.distance) {
        let actionPrompt = '[E] ACCESS TERMINAL';
        if (termInstance.data.type === 'chop_shop') actionPrompt = '[E] OPEN CHOP-SHOP LATHE (PACK-A-PUNCH)';
        else if (termInstance.data.type === 'clinic') actionPrompt = '[E] BIO-SYNTH CYBER-PERKS';
        else if (termInstance.data.type === 'scrapper_station') actionPrompt = '[E] STRIP SALVAGE SCRAP';

        nearestInteraction = {
          type: 'terminal',
          id: termId,
          name: termInstance.data.name,
          prompt: actionPrompt,
          canAfford: true,
          distance: dist,
        };
      }
    }

    // 3. Check Comrades
    for (const [comradeId, comradeInstance] of comrades3d.comrades.entries()) {
      const comradeWorldPos = new THREE.Vector3();
      comradeInstance.mesh.getWorldPosition(comradeWorldPos);
      comradeWorldPos.y += 1.5;

      const dist = camPos.distanceTo(comradeWorldPos);
      if (dist < 3.5 && dist < nearestInteraction.distance) {
        nearestInteraction = {
          type: 'comrade',
          id: comradeId,
          name: comradeInstance.data.name,
          prompt: `[E] TALK TO ${comradeInstance.data.name.toUpperCase()} [${comradeInstance.data.role.toUpperCase()}]`,
          canAfford: true,
          distance: dist,
        };
      }
    }

    this.currentInteraction = nearestInteraction;
  }
}
