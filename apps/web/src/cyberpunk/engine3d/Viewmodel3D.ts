import * as THREE from 'three';
import type { WeaponStats } from '@arcanora/core';
import type { LaserTracer3D } from './types3d.js';

export class Viewmodel3D {
  readonly rootGroup: THREE.Group = new THREE.Group();
  private gunMesh: THREE.Group = new THREE.Group();
  private muzzleFlashMesh: THREE.Mesh;
  private muzzleFlashLight: THREE.PointLight;
  private neonStrips: THREE.Mesh[] = [];

  // Tracers
  private tracers: LaserTracer3D[] = [];

  // Transform offsets
  private basePosition = new THREE.Vector3(0.26, -0.22, -0.42);
  private baseRotation = new THREE.Euler(0, 0, 0);

  // Recoil
  private recoilOffset = new THREE.Vector3(0, 0, 0);
  private recoilRotation = new THREE.Euler(0, 0, 0);
  private recoilRecoverySpeed = 16.0;

  // Sway & Bob
  private swayAngle = 0;
  private bobTimer = 0;

  // Reload state
  private isReloading = false;
  private reloadProgress = 0;
  private reloadDuration = 1.0;

  // Flash timer
  private flashTimer = 0;

  constructor() {
    // Build procedural 3D weapon viewmodel
    this.buildGunGeometry('#06b6d4');

    // Muzzle Flash
    const flashGeo = new THREE.ConeGeometry(0.06, 0.2, 8);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
    this.muzzleFlashMesh = new THREE.Mesh(flashGeo, flashMat);
    this.muzzleFlashMesh.rotation.x = -Math.PI / 2;
    this.muzzleFlashMesh.position.set(0, 0.04, -0.45);
    this.gunMesh.add(this.muzzleFlashMesh);

    this.muzzleFlashLight = new THREE.PointLight(0x06b6d4, 0, 6);
    this.muzzleFlashLight.position.set(0, 0.04, -0.45);
    this.gunMesh.add(this.muzzleFlashLight);

    this.rootGroup.add(this.gunMesh);
    this.gunMesh.position.copy(this.basePosition);
  }

  private buildGunGeometry(neonColorHex: string) {
    // Clear previous children
    while (this.gunMesh.children.length > 0) {
      this.gunMesh.remove(this.gunMesh.children[0]);
    }
    this.neonStrips = [];

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.85,
      roughness: 0.25,
    });

    const darkAccentMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.9,
      roughness: 0.2,
    });

    const neonMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(neonColorHex),
    });

    // Main receiver body
    const receiverGeo = new THREE.BoxGeometry(0.08, 0.12, 0.35);
    const receiver = new THREE.Mesh(receiverGeo, bodyMat);
    receiver.position.set(0, 0, -0.1);
    this.gunMesh.add(receiver);

    // Barrel
    const barrelGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.28, 12);
    const barrel = new THREE.Mesh(barrelGeo, darkAccentMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.035, -0.32);
    this.gunMesh.add(barrel);

    // Muzzle compensator brake
    const brakeGeo = new THREE.BoxGeometry(0.06, 0.06, 0.08);
    const brake = new THREE.Mesh(brakeGeo, bodyMat);
    brake.position.set(0, 0.035, -0.44);
    this.gunMesh.add(brake);

    // Grip
    const gripGeo = new THREE.BoxGeometry(0.06, 0.16, 0.09);
    const grip = new THREE.Mesh(gripGeo, darkAccentMat);
    grip.position.set(0, -0.11, 0.02);
    grip.rotation.x = 0.22;
    this.gunMesh.add(grip);

    // Energy Magazine Pack
    const magGeo = new THREE.BoxGeometry(0.05, 0.12, 0.07);
    const mag = new THREE.Mesh(magGeo, bodyMat);
    mag.position.set(0, -0.14, 0.02);
    mag.rotation.x = 0.22;
    this.gunMesh.add(mag);

    // Holographic Optic Sight
    const sightBaseGeo = new THREE.BoxGeometry(0.04, 0.03, 0.08);
    const sightBase = new THREE.Mesh(sightBaseGeo, darkAccentMat);
    sightBase.position.set(0, 0.075, -0.06);
    this.gunMesh.add(sightBase);

    // Holographic Glass Reticle
    const reticleGeo = new THREE.PlaneGeometry(0.05, 0.05);
    const reticleMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(neonColorHex),
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const reticle = new THREE.Mesh(reticleGeo, reticleMat);
    reticle.position.set(0, 0.11, -0.06);
    this.gunMesh.add(reticle);

    // Glowing Neon Accent Strips along the side of the weapon
    const stripGeo = new THREE.BoxGeometry(0.084, 0.015, 0.24);
    const strip = new THREE.Mesh(stripGeo, neonMat);
    strip.position.set(0, 0.01, -0.1);
    this.gunMesh.add(strip);
    this.neonStrips.push(strip);
  }

  setWeapon(stats: WeaponStats) {
    this.buildGunGeometry(stats.neonColor);
    this.muzzleFlashLight.color.set(stats.neonColor);
    this.muzzleFlashMesh.position.set(0, 0.04, -0.45);
    this.gunMesh.add(this.muzzleFlashMesh);
    this.gunMesh.add(this.muzzleFlashLight);
  }

  triggerFire(stats: WeaponStats, targetPoint: THREE.Vector3, scene: THREE.Scene) {
    // 1. Kick recoil
    const kickZ = stats.baseId === 'heavy_rail_rifle' ? 0.12 : stats.baseId === 'auto_shotgun' ? 0.09 : 0.04;
    const kickPitch = stats.baseId === 'heavy_rail_rifle' ? 0.22 : 0.08;

    this.recoilOffset.z = kickZ;
    this.recoilOffset.y = kickZ * 0.4;
    this.recoilRotation.x = kickPitch;
    this.recoilRotation.y = (Math.random() - 0.5) * 0.03;

    // 2. Muzzle flash
    this.flashTimer = 0.06;
    (this.muzzleFlashMesh.material as THREE.MeshBasicMaterial).opacity = 1.0;
    this.muzzleFlashLight.intensity = 4.0;

    // 3. Create Laser Tracer in 3D world space
    const muzzleWorldPos = new THREE.Vector3();
    this.muzzleFlashMesh.getWorldPosition(muzzleWorldPos);

    const tracerGeo = new THREE.BufferGeometry().setFromPoints([muzzleWorldPos, targetPoint]);
    const tracerMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(stats.neonColor),
      linewidth: 2,
      transparent: true,
      opacity: 0.9,
    });
    const tracerLine = new THREE.Line(tracerGeo, tracerMat);
    scene.add(tracerLine);

    this.tracers.push({
      line: tracerLine,
      start: muzzleWorldPos,
      end: targetPoint,
      color: stats.neonColor,
      age: 0,
      lifetime: 0.08,
    });
  }

  triggerReload(reloadTimeMs: number) {
    this.isReloading = true;
    this.reloadProgress = 0;
    this.reloadDuration = reloadTimeMs / 1000;
  }

  update(deltaSec: number, isMoving: boolean, scene: THREE.Scene) {
    // 1. Recover recoil
    this.recoilOffset.lerp(new THREE.Vector3(0, 0, 0), deltaSec * this.recoilRecoverySpeed);
    this.recoilRotation.x = THREE.MathUtils.lerp(this.recoilRotation.x, 0, deltaSec * this.recoilRecoverySpeed);
    this.recoilRotation.y = THREE.MathUtils.lerp(this.recoilRotation.y, 0, deltaSec * this.recoilRecoverySpeed);

    // 2. Muzzle flash fade
    if (this.flashTimer > 0) {
      this.flashTimer -= deltaSec;
      if (this.flashTimer <= 0) {
        (this.muzzleFlashMesh.material as THREE.MeshBasicMaterial).opacity = 0;
        this.muzzleFlashLight.intensity = 0;
      }
    }

    // 3. Sway & Walk Bob
    this.swayAngle += deltaSec * 1.5;
    const idleSwayX = Math.sin(this.swayAngle) * 0.003;
    const idleSwayY = Math.cos(this.swayAngle * 2) * 0.003;

    let bobX = 0;
    let bobY = 0;
    if (isMoving) {
      this.bobTimer += deltaSec * 10;
      bobX = Math.cos(this.bobTimer * 0.5) * 0.015;
      bobY = Math.abs(Math.sin(this.bobTimer)) * 0.018;
    }

    // 4. Reload animation dip
    let reloadOffsetY = 0;
    let reloadRotX = 0;
    if (this.isReloading) {
      this.reloadProgress += deltaSec / this.reloadDuration;
      if (this.reloadProgress >= 1.0) {
        this.isReloading = false;
        this.reloadProgress = 0;
      } else {
        // Bell curve dip
        const dip = Math.sin(this.reloadProgress * Math.PI);
        reloadOffsetY = -dip * 0.25;
        reloadRotX = dip * 0.45;
      }
    }

    // Apply combined transforms to gunMesh
    this.gunMesh.position.set(
      this.basePosition.x + idleSwayX + bobX + this.recoilOffset.x,
      this.basePosition.y + idleSwayY - bobY + this.recoilOffset.y + reloadOffsetY,
      this.basePosition.z + this.recoilOffset.z
    );

    this.gunMesh.rotation.set(
      this.baseRotation.x + this.recoilRotation.x + reloadRotX,
      this.baseRotation.y + this.recoilRotation.y,
      this.baseRotation.z
    );

    // 5. Update Tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tracer = this.tracers[i];
      tracer.age += deltaSec;
      const progress = tracer.age / tracer.lifetime;
      if (progress >= 1.0) {
        scene.remove(tracer.line);
        tracer.line.geometry.dispose();
        (tracer.line.material as THREE.Material).dispose();
        this.tracers.splice(i, 1);
      } else {
        (tracer.line.material as THREE.LineBasicMaterial).opacity = 1.0 - progress;
      }
    }
  }
}
