import * as THREE from 'three';
import type { WeaponStats } from '@arcanora/core';
import type { LaserTracer3D } from './types3d.js';

export class Viewmodel3D {
  readonly rootGroup: THREE.Group = new THREE.Group();
  private weaponRigGroup: THREE.Group = new THREE.Group();
  private gunMesh: THREE.Group = new THREE.Group();
  private armsGroup: THREE.Group = new THREE.Group();

  private rightArmGroup: THREE.Group = new THREE.Group();
  private leftArmGroup: THREE.Group = new THREE.Group();
  private magazineMesh?: THREE.Mesh;

  private muzzleFlashMesh: THREE.Mesh;
  private muzzleFlashLight: THREE.PointLight;
  private muzzleOffset = new THREE.Vector3(0, 0.04, -0.45);

  // Tracers
  private tracers: LaserTracer3D[] = [];

  // Transform offsets
  private basePosition = new THREE.Vector3(0.24, -0.22, -0.42);
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
  private magOriginalPos = new THREE.Vector3();

  // Flash timer
  private flashTimer = 0;

  constructor() {
    this.rootGroup.add(this.weaponRigGroup);
    this.weaponRigGroup.add(this.gunMesh);
    this.weaponRigGroup.add(this.armsGroup);

    // Muzzle Flash
    const flashGeo = new THREE.ConeGeometry(0.07, 0.22, 8);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
    this.muzzleFlashMesh = new THREE.Mesh(flashGeo, flashMat);
    this.muzzleFlashMesh.rotation.x = -Math.PI / 2;
    this.gunMesh.add(this.muzzleFlashMesh);

    this.muzzleFlashLight = new THREE.PointLight(0x06b6d4, 0, 6);
    this.gunMesh.add(this.muzzleFlashLight);

    // Build Articulated Arms
    this.buildCyberArms();

    // Default to Pistol
    this.buildWeaponModel('pulse_pistol', '#06b6d4');

    this.weaponRigGroup.position.copy(this.basePosition);
  }

  getMuzzleWorldPosition(): THREE.Vector3 {
    const pos = new THREE.Vector3();
    this.muzzleFlashMesh.getWorldPosition(pos);
    return pos;
  }

  private buildCyberArms() {
    // Clear previous arms
    while (this.armsGroup.children.length > 0) {
      this.armsGroup.remove(this.armsGroup.children[0]);
    }

    this.rightArmGroup = new THREE.Group();
    this.leftArmGroup = new THREE.Group();

    const sleeveMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // Tactical carbon sleeve
      metalness: 0.7,
      roughness: 0.35,
    });

    const cyberMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a, // Dark titanium forearm
      metalness: 0.9,
      roughness: 0.2,
    });

    const jointMat = new THREE.MeshStandardMaterial({
      color: 0x475569, // Chrome mechanical joints
      metalness: 0.95,
      roughness: 0.15,
    });

    const neonSeamMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4, // Cyan forearm conduit
    });

    // --- Right Arm (Triggers & holds primary grip) ---
    // Forearm
    const rightForearmGeo = new THREE.CylinderGeometry(0.045, 0.055, 0.42, 10);
    const rightForearm = new THREE.Mesh(rightForearmGeo, sleeveMat);
    rightForearm.rotation.x = Math.PI / 2.6;
    rightForearm.rotation.z = -0.15;
    rightForearm.position.set(0.12, -0.22, 0.18);
    this.rightArmGroup.add(rightForearm);

    // Wrist brace
    const rightWristGeo = new THREE.CylinderGeometry(0.042, 0.045, 0.08, 10);
    const rightWrist = new THREE.Mesh(rightWristGeo, cyberMat);
    rightWrist.rotation.x = Math.PI / 2.6;
    rightWrist.position.set(0.06, -0.14, -0.02);
    this.rightArmGroup.add(rightWrist);

    // Right Hand / Knuckles
    const rightHandGeo = new THREE.BoxGeometry(0.07, 0.06, 0.09);
    const rightHand = new THREE.Mesh(rightHandGeo, cyberMat);
    rightHand.position.set(0.02, -0.1, -0.06);
    this.rightArmGroup.add(rightHand);

    // Fingers gripping
    for (let f = 0; f < 3; f++) {
      const fingerGeo = new THREE.BoxGeometry(0.018, 0.045, 0.022);
      const finger = new THREE.Mesh(fingerGeo, jointMat);
      finger.position.set(-0.02, -0.11 - f * 0.02, -0.03 + f * 0.015);
      finger.rotation.z = 0.4;
      this.rightArmGroup.add(finger);
    }

    // --- Left Arm (Supports barrel / foregrip or reloads) ---
    // Forearm
    const leftForearmGeo = new THREE.CylinderGeometry(0.045, 0.055, 0.46, 10);
    const leftForearm = new THREE.Mesh(leftForearmGeo, sleeveMat);
    leftForearm.rotation.x = Math.PI / 2.8;
    leftForearm.rotation.z = 0.55;
    leftForearm.position.set(-0.24, -0.26, 0.12);
    this.leftArmGroup.add(leftForearm);

    // Cyber conduit seam
    const leftSeamGeo = new THREE.BoxGeometry(0.01, 0.28, 0.02);
    const leftSeam = new THREE.Mesh(leftSeamGeo, neonSeamMat);
    leftSeam.rotation.x = Math.PI / 2.8;
    leftSeam.rotation.z = 0.55;
    leftSeam.position.set(-0.23, -0.24, 0.12);
    this.leftArmGroup.add(leftSeam);

    // Left Hand
    const leftHandGeo = new THREE.BoxGeometry(0.07, 0.05, 0.08);
    const leftHand = new THREE.Mesh(leftHandGeo, cyberMat);
    leftHand.position.set(-0.06, -0.11, -0.22);
    this.leftArmGroup.add(leftHand);

    this.armsGroup.add(this.rightArmGroup);
    this.armsGroup.add(this.leftArmGroup);
  }

  private buildWeaponModel(weaponId: string, neonColorHex: string) {
    // Clear previous gun mesh children except muzzle flash
    while (this.gunMesh.children.length > 0) {
      this.gunMesh.remove(this.gunMesh.children[0]);
    }
    this.magazineMesh = undefined;

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.88,
      roughness: 0.22,
    });

    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x090d16,
      metalness: 0.92,
      roughness: 0.18,
    });

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.95,
      roughness: 0.12,
    });

    const neonMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(neonColorHex),
    });

    if (weaponId === 'scrap_pistol' || weaponId === 'pulse_pistol') {
      // --- MODEL 1: PULSE STINGER / SCRAP AUTOPISTOL (TACTICAL PISTOL) ---
      this.muzzleOffset.set(0, 0.035, -0.38);

      // Slide & Receiver
      const slideGeo = new THREE.BoxGeometry(0.065, 0.08, 0.28);
      const slide = new THREE.Mesh(slideGeo, bodyMat);
      slide.position.set(0, 0.02, -0.16);
      this.gunMesh.add(slide);

      // Angled tactical grip
      const gripGeo = new THREE.BoxGeometry(0.055, 0.15, 0.075);
      const grip = new THREE.Mesh(gripGeo, darkMat);
      grip.position.set(0, -0.09, -0.04);
      grip.rotation.x = 0.22;
      this.gunMesh.add(grip);

      // Extended magazine basepad
      const magGeo = new THREE.BoxGeometry(0.05, 0.04, 0.07);
      this.magazineMesh = new THREE.Mesh(magGeo, chromeMat);
      this.magazineMesh.position.set(0, -0.17, -0.02);
      this.magazineMesh.rotation.x = 0.22;
      this.gunMesh.add(this.magazineMesh);
      this.magOriginalPos.copy(this.magazineMesh.position);

      // Under-barrel laser rail
      const railGeo = new THREE.BoxGeometry(0.045, 0.03, 0.14);
      const rail = new THREE.Mesh(railGeo, darkMat);
      rail.position.set(0, -0.03, -0.22);
      this.gunMesh.add(rail);

      // Mini reflex sight
      const sightBase = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.05), darkMat);
      sightBase.position.set(0, 0.07, -0.12);
      this.gunMesh.add(sightBase);

      const glassGeo = new THREE.PlaneGeometry(0.035, 0.035);
      const glassMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(neonColorHex),
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
      });
      const glass = new THREE.Mesh(glassGeo, glassMat);
      glass.position.set(0, 0.09, -0.12);
      this.gunMesh.add(glass);

      // Neon Slide Grooves
      const neonStripe = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.01, 0.18), neonMat);
      neonStripe.position.set(0, 0.03, -0.16);
      this.gunMesh.add(neonStripe);

    } else if (weaponId === 'auto_shotgun') {
      // --- MODEL 2: RIOT-BREAKER (HEAVY AUTO-SHOTGUN) ---
      this.muzzleOffset.set(0, 0.045, -0.56);

      // Heavy rectangular receiver
      const receiverGeo = new THREE.BoxGeometry(0.1, 0.14, 0.38);
      const receiver = new THREE.Mesh(receiverGeo, bodyMat);
      receiver.position.set(0, 0.02, -0.14);
      this.gunMesh.add(receiver);

      // Heavy dual-barrel shroud
      const barrelTopGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.36, 12);
      const barrelTop = new THREE.Mesh(barrelTopGeo, darkMat);
      barrelTop.rotation.x = Math.PI / 2;
      barrelTop.position.set(0, 0.045, -0.38);
      this.gunMesh.add(barrelTop);

      const barrelBotGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.32, 12);
      const barrelBot = new THREE.Mesh(barrelBotGeo, chromeMat);
      barrelBot.rotation.x = Math.PI / 2;
      barrelBot.position.set(0, 0.005, -0.36);
      this.gunMesh.add(barrelBot);

      // Rotary Drum Magazine underneath
      const drumGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.1, 16);
      this.magazineMesh = new THREE.Mesh(drumGeo, darkMat);
      this.magazineMesh.rotation.z = Math.PI / 2;
      this.magazineMesh.position.set(0, -0.11, -0.16);
      this.gunMesh.add(this.magazineMesh);
      this.magOriginalPos.copy(this.magazineMesh.position);

      // Ribbed pump forend
      const pumpGeo = new THREE.BoxGeometry(0.08, 0.06, 0.18);
      const pump = new THREE.Mesh(pumpGeo, darkMat);
      pump.position.set(0, -0.02, -0.36);
      this.gunMesh.add(pump);

      // Pistol grip & stock bracket
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.08), darkMat);
      grip.position.set(0, -0.1, 0.02);
      grip.rotation.x = 0.25;
      this.gunMesh.add(grip);

      // Heavy Heat Vents (Glowing Neon)
      const ventGeo = new THREE.BoxGeometry(0.104, 0.018, 0.22);
      const vent = new THREE.Mesh(ventGeo, neonMat);
      vent.position.set(0, 0.05, -0.18);
      this.gunMesh.add(vent);

    } else if (weaponId === 'kinetic_smg') {
      // --- MODEL 3: NEON HYPER-CUTTER (BULLPUP SMG) ---
      this.muzzleOffset.set(0, 0.04, -0.48);

      // Compact bullpup receiver
      const receiverGeo = new THREE.BoxGeometry(0.075, 0.13, 0.36);
      const receiver = new THREE.Mesh(receiverGeo, bodyMat);
      receiver.position.set(0, 0.01, -0.16);
      this.gunMesh.add(receiver);

      // Extended barrel with perforated flash suppressor
      const barrelGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.24, 10);
      const barrel = new THREE.Mesh(barrelGeo, chromeMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.04, -0.36);
      this.gunMesh.add(barrel);

      const suppressor = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.08), darkMat);
      suppressor.position.set(0, 0.04, -0.46);
      this.gunMesh.add(suppressor);

      // Vertical tactical foregrip
      const foregrip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.12, 0.045), darkMat);
      foregrip.position.set(0, -0.09, -0.28);
      this.gunMesh.add(foregrip);

      // Main handle
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.15, 0.07), darkMat);
      grip.position.set(0, -0.1, -0.06);
      grip.rotation.x = 0.18;
      this.gunMesh.add(grip);

      // Curved rear bullpup magazine
      const magGeo = new THREE.BoxGeometry(0.048, 0.16, 0.06);
      this.magazineMesh = new THREE.Mesh(magGeo, chromeMat);
      this.magazineMesh.position.set(0, -0.12, 0.08);
      this.magazineMesh.rotation.x = -0.15;
      this.gunMesh.add(this.magazineMesh);
      this.magOriginalPos.copy(this.magazineMesh.position);

      // Holographic Framed Sight
      const frameGeo = new THREE.BoxGeometry(0.05, 0.06, 0.07);
      const frame = new THREE.Mesh(frameGeo, darkMat);
      frame.position.set(0, 0.09, -0.15);
      this.gunMesh.add(frame);

      const glass = new THREE.Mesh(
        new THREE.PlaneGeometry(0.04, 0.04),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(neonColorHex), transparent: true, opacity: 0.85 })
      );
      glass.position.set(0, 0.09, -0.15);
      this.gunMesh.add(glass);

      // Magenta side circuit strip
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.02, 0.26), neonMat);
      strip.position.set(0, 0.02, -0.16);
      this.gunMesh.add(strip);

    } else {
      // --- MODEL 4: THE ORBITAL LANCE (HEAVY RAIL-RIFLE) ---
      this.muzzleOffset.set(0, 0.05, -0.84);

      // Massive angular rail chassis
      const chassisGeo = new THREE.BoxGeometry(0.09, 0.13, 0.52);
      const chassis = new THREE.Mesh(chassisGeo, darkMat);
      chassis.position.set(0, 0.02, -0.18);
      this.gunMesh.add(chassis);

      // Dual electromagnetic acceleration rails (Top and Bottom)
      const railGeo = new THREE.BoxGeometry(0.035, 0.025, 0.58);
      const topRail = new THREE.Mesh(railGeo, chromeMat);
      topRail.position.set(0, 0.065, -0.52);
      this.gunMesh.add(topRail);

      const botRail = new THREE.Mesh(railGeo, chromeMat);
      botRail.position.set(0, 0.015, -0.52);
      this.gunMesh.add(botRail);

      // Visible Copper Induction Coils (4 toroidal rings along rails)
      const coilMat = new THREE.MeshStandardMaterial({
        color: 0xb45309, // Polished copper
        metalness: 0.9,
        roughness: 0.25,
      });
      for (let c = 0; c < 4; c++) {
        const coilGeo = new THREE.TorusGeometry(0.042, 0.012, 8, 16);
        const coil = new THREE.Mesh(coilGeo, coilMat);
        coil.position.set(0, 0.04, -0.32 - c * 0.11);
        this.gunMesh.add(coil);
      }

      // High-magnification optical sniper scope
      const scopeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.32, 12), bodyMat);
      scopeBody.rotation.x = Math.PI / 2;
      scopeBody.position.set(0, 0.13, -0.18);
      this.gunMesh.add(scopeBody);

      // Scope lens
      const lens = new THREE.Mesh(
        new THREE.CircleGeometry(0.028, 12),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(neonColorHex), transparent: true, opacity: 0.9 })
      );
      lens.position.set(0, 0.13, -0.02);
      this.gunMesh.add(lens);

      // High-voltage capacitor battery pack (magazine)
      const batteryGeo = new THREE.BoxGeometry(0.08, 0.14, 0.1);
      this.magazineMesh = new THREE.Mesh(batteryGeo, neonMat);
      this.magazineMesh.position.set(0, -0.08, -0.05);
      this.gunMesh.add(this.magazineMesh);
      this.magOriginalPos.copy(this.magazineMesh.position);

      // Grip and stock
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.16, 0.08), darkMat);
      grip.position.set(0, -0.12, 0.1);
      grip.rotation.x = 0.28;
      this.gunMesh.add(grip);

      // Folded bipod fins
      const finGeo = new THREE.BoxGeometry(0.015, 0.02, 0.22);
      const leftFin = new THREE.Mesh(finGeo, chromeMat);
      leftFin.position.set(-0.04, -0.01, -0.45);
      this.gunMesh.add(leftFin);

      const rightFin = new THREE.Mesh(finGeo, chromeMat);
      rightFin.position.set(0.04, -0.01, -0.45);
      this.gunMesh.add(rightFin);
    }

    // Re-attach Muzzle Flash & Light at the exact barrel tip
    this.muzzleFlashMesh.position.copy(this.muzzleOffset);
    this.muzzleFlashLight.position.copy(this.muzzleOffset);
    this.muzzleFlashLight.color.set(neonColorHex);
    this.gunMesh.add(this.muzzleFlashMesh);
    this.gunMesh.add(this.muzzleFlashLight);

    // Adjust left supporting arm based on weapon frame length
    if (weaponId === 'pulse_pistol') {
      this.leftArmGroup.position.set(0.08, -0.02, 0.08); // Two-handed cup pistol grip
    } else if (weaponId === 'auto_shotgun') {
      this.leftArmGroup.position.set(0.02, 0.01, -0.12); // Gripping pump forend
    } else if (weaponId === 'kinetic_smg') {
      this.leftArmGroup.position.set(0.02, 0.02, -0.06); // Gripping vertical foregrip
    } else {
      this.leftArmGroup.position.set(0.01, 0.04, -0.16); // Holding rail shroud forward
    }
  }

  setWeapon(stats: WeaponStats) {
    this.buildWeaponModel(stats.baseId, stats.neonColor);
  }

  triggerFire(stats: WeaponStats) {
    // 1. Recoil kickback scaled per weapon
    const isRail = stats.baseId === 'heavy_rail_rifle';
    const isShot = stats.baseId === 'auto_shotgun';
    const kickZ = isRail ? 0.14 : isShot ? 0.09 : 0.04;
    const kickPitch = isRail ? 0.26 : isShot ? 0.14 : 0.07;

    this.recoilOffset.z = kickZ;
    this.recoilOffset.y = kickZ * 0.35;
    this.recoilRotation.x = kickPitch;
    this.recoilRotation.y = (Math.random() - 0.5) * 0.035;

    // 2. Muzzle flash
    this.flashTimer = 0.055;
    (this.muzzleFlashMesh.material as THREE.MeshBasicMaterial).opacity = 1.0;
    this.muzzleFlashLight.intensity = 5.0;
  }

  triggerReload(reloadTimeMs: number) {
    this.isReloading = true;
    this.reloadProgress = 0;
    this.reloadDuration = reloadTimeMs / 1000;
  }

  update(deltaSec: number, isMoving: boolean) {
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
      bobX = Math.cos(this.bobTimer * 0.5) * 0.014;
      bobY = Math.abs(Math.sin(this.bobTimer)) * 0.016;
    }

    // 4. Reload animation (dip weapon, left hand pulls magazine and slams it back)
    let reloadOffsetY = 0;
    let reloadRotX = 0;
    let reloadRotZ = 0;

    if (this.isReloading) {
      this.reloadProgress += deltaSec / this.reloadDuration;
      if (this.reloadProgress >= 1.0) {
        this.isReloading = false;
        this.reloadProgress = 0;
        if (this.magazineMesh) {
          this.magazineMesh.position.copy(this.magOriginalPos);
        }
      } else {
        const dip = Math.sin(this.reloadProgress * Math.PI);
        reloadOffsetY = -dip * 0.22;
        reloadRotX = dip * 0.35;
        reloadRotZ = dip * 0.15;

        // Animate magazine eject and insert
        if (this.magazineMesh) {
          if (this.reloadProgress < 0.5) {
            // Eject downward
            this.magazineMesh.position.y = this.magOriginalPos.y - (this.reloadProgress / 0.5) * 0.2;
          } else {
            // Slam new magazine upward into chamber
            const slamProgress = (this.reloadProgress - 0.5) / 0.5;
            this.magazineMesh.position.y = this.magOriginalPos.y - (1.0 - slamProgress) * 0.2;
          }
        }
      }
    }

    // Apply combined transforms to weaponRigGroup
    this.weaponRigGroup.position.set(
      this.basePosition.x + idleSwayX + bobX + this.recoilOffset.x,
      this.basePosition.y + idleSwayY - bobY + this.recoilOffset.y + reloadOffsetY,
      this.basePosition.z + this.recoilOffset.z
    );

    this.weaponRigGroup.rotation.set(
      this.baseRotation.x + this.recoilRotation.x + reloadRotX,
      this.baseRotation.y + this.recoilRotation.y,
      this.baseRotation.z + reloadRotZ
    );
  }
}
