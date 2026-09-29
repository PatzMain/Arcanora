import * as THREE from 'three';
import type { CombatEnemy } from '@arcanora/core';
import { materials } from './materials.js';
import { sounds } from './SoundManager.js';
import type { Droid3DInstance, Particle3D } from './types3d.js';
import type { SectorBuilder } from './SectorBuilder.js';

interface AnimatedDroidParts {
  rotors?: THREE.Mesh[];
  leftLeg?: THREE.Group;
  rightLeg?: THREE.Group;
  frontLeftLeg?: THREE.Group;
  frontRightLeg?: THREE.Group;
  backLeftLeg?: THREE.Group;
  backRightLeg?: THREE.Group;
  spineSegments?: THREE.Mesh[];
  hydraulicPistons?: THREE.Mesh[];
  reactorMesh?: THREE.Mesh;
  spotlightCone?: THREE.Mesh;
  animTimer: number;
}

export class EnemyDroids3D {
  readonly rootGroup: THREE.Group = new THREE.Group();
  readonly droids: Map<string, Droid3DInstance> = new Map();
  private droidAnimParts: Map<string, AnimatedDroidParts> = new Map();
  private particles: Particle3D[] = [];

  spawnDroid(enemy: CombatEnemy, spawnPos: THREE.Vector3) {
    const droidGroup = new THREE.Group();
    droidGroup.position.copy(spawnPos);

    // Build Articulated 3D mesh based on enemy type
    const animParts: AnimatedDroidParts = { animTimer: Math.random() * 10 };
    this.buildArticulatedDroidMesh(droidGroup, enemy.type, animParts);
    this.droidAnimParts.set(enemy.id, animParts);

    // Billboard Health & Shield Bar
    const healthTex = materials.createHealthBarSprite(1.0, enemy.shield > 0 ? 1.0 : 0);
    const spriteMat = new THREE.SpriteMaterial({ map: healthTex, transparent: true });
    const healthSprite = new THREE.Sprite(spriteMat);
    const barHeight = enemy.type === 'heavy_mech' ? 3.6 : enemy.type === 'shock_hound' ? 1.5 : 2.4;
    healthSprite.scale.set(enemy.type === 'heavy_mech' ? 2.6 : 2.0, 0.26, 1);
    healthSprite.position.set(0, barHeight, 0);
    droidGroup.add(healthSprite);

    const instance: Droid3DInstance = {
      data: enemy,
      mesh: droidGroup,
      healthBarMesh: healthSprite,
      currentHp: enemy.hp,
      currentShield: enemy.shield,
      velocity: new THREE.Vector3(),
      lastAttackTime: 0,
      isHitFlashing: false,
      hitFlashTimer: 0,
    };

    this.droids.set(enemy.id, instance);
    this.rootGroup.add(droidGroup);
  }

  private buildArticulatedDroidMesh(
    group: THREE.Group,
    type: CombatEnemy['type'],
    animParts: AnimatedDroidParts
  ) {
    const armorMat = materials.getWallMaterial(0x1e293b);
    const darkMat = materials.getWallMaterial(0x0f172a);
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.9, roughness: 0.2 });
    const redEyeMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const amberCoreMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const cyanArcMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });

    if (type === 'stealth_infiltrator') {
      // ============================================================
      // 1. STEALTH INFILTRATOR / PATROL DRONE: Flying quad-rotor with scanning spotlight
      // ============================================================
      const droneBase = new THREE.Group();
      droneBase.position.y = 1.4;
      group.add(droneBase);

      // Spherical central core
      const coreGeo = new THREE.SphereGeometry(0.35, 12, 12);
      const core = new THREE.Mesh(coreGeo, armorMat);
      droneBase.add(core);

      // Central glowing red sensor eye
      const eyeGeo = new THREE.SphereGeometry(0.14, 10, 10);
      const eye = new THREE.Mesh(eyeGeo, redEyeMat);
      eye.position.set(0, 0, 0.32);
      droneBase.add(eye);

      // 4 Angled Outrigger Arms with Spinning Rotor Blades
      animParts.rotors = [];
      const armAngles = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];
      const armLength = 0.55;

      for (const angle of armAngles) {
        const armGeo = new THREE.CylinderGeometry(0.03, 0.03, armLength, 8);
        const arm = new THREE.Mesh(armGeo, darkMat);
        arm.rotation.z = Math.PI / 2;
        arm.rotation.y = angle;
        arm.position.set(Math.cos(angle) * (armLength / 2), 0.05, Math.sin(angle) * (armLength / 2));
        droneBase.add(arm);

        // Rotor motor housing
        const motorGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.08, 8);
        const motor = new THREE.Mesh(motorGeo, darkMat);
        motor.position.set(Math.cos(angle) * armLength, 0.08, Math.sin(angle) * armLength);
        droneBase.add(motor);

        // Rotor blade (2 crossed thin boxes)
        const bladeGeo = new THREE.BoxGeometry(0.32, 0.01, 0.04);
        const blade = new THREE.Mesh(bladeGeo, chromeMat);
        blade.position.set(Math.cos(angle) * armLength, 0.13, Math.sin(angle) * armLength);
        droneBase.add(blade);
        animParts.rotors.push(blade);
      }

      // Downward scanning spotlight cone
      const coneGeo = new THREE.ConeGeometry(0.7, 1.4, 12, 1, true);
      const coneMat = new THREE.MeshBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
      });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.set(0, -0.7, 0.2);
      cone.rotation.x = 0.35;
      droneBase.add(cone);
      animParts.spotlightCone = cone;

    } else if (type === 'security_droid') {
      // ============================================================
      // 2. SECURITY DROID: Articulated bipedal tactical combat android
      // ============================================================
      // Torso & Chest Armor
      const torsoGeo = new THREE.BoxGeometry(0.55, 0.65, 0.35);
      const torso = new THREE.Mesh(torsoGeo, armorMat);
      torso.position.y = 1.35;
      group.add(torso);

      // Chest plate with hazard stripe
      const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.35, 0.08), darkMat);
      chestPlate.position.set(0, 1.45, 0.18);
      group.add(chestPlate);

      // Head with glowing visor slit
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.26, 0.28), darkMat);
      head.position.set(0, 1.82, 0);
      group.add(head);

      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.04), redEyeMat);
      visor.position.set(0, 1.82, 0.15);
      group.add(visor);

      // Two-handed pulse carbine held forward
      const carbine = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.75), darkMat);
      carbine.position.set(0.18, 1.25, 0.35);
      group.add(carbine);

      const carbineGlow = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.45), redEyeMat);
      carbineGlow.position.set(0.18, 1.28, 0.38);
      group.add(carbineGlow);

      // Left Leg Assembly
      const leftLeg = new THREE.Group();
      leftLeg.position.set(-0.18, 1.0, 0);
      const lThigh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.16), darkMat);
      lThigh.position.y = -0.22;
      leftLeg.add(lThigh);
      const lShin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.14), armorMat);
      lShin.position.y = -0.65;
      leftLeg.add(lShin);
      const lFoot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.22), darkMat);
      lFoot.position.set(0, -0.92, 0.04);
      leftLeg.add(lFoot);
      group.add(leftLeg);
      animParts.leftLeg = leftLeg;

      // Right Leg Assembly
      const rightLeg = new THREE.Group();
      rightLeg.position.set(0.18, 1.0, 0);
      const rThigh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.16), darkMat);
      rThigh.position.y = -0.22;
      rightLeg.add(rThigh);
      const rShin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.14), armorMat);
      rShin.position.y = -0.65;
      rightLeg.add(rShin);
      const rFoot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.22), darkMat);
      rFoot.position.set(0, -0.92, 0.04);
      rightLeg.add(rFoot);
      group.add(rightLeg);
      animParts.rightLeg = rightLeg;

    } else if (type === 'shock_hound') {
      // ============================================================
      // 3. SHOCK HOUND: Cybernetic quadruped with articulated spine
      // ============================================================
      // Segmented vertebrae spine
      animParts.spineSegments = [];
      for (let s = 0; s < 5; s++) {
        const segGeo = new THREE.BoxGeometry(0.38, 0.32, 0.26);
        const seg = new THREE.Mesh(segGeo, s % 2 === 0 ? armorMat : darkMat);
        seg.position.set(0, 0.65, -0.4 + s * 0.22);
        group.add(seg);
        animParts.spineSegments.push(seg);
      }

      // Glowing electric rib conduits
      const ribGeo = new THREE.BoxGeometry(0.42, 0.05, 0.85);
      const rib = new THREE.Mesh(ribGeo, cyanArcMat);
      rib.position.set(0, 0.65, 0.05);
      group.add(rib);

      // Predatory cybernetic head
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.25, 0.42), darkMat);
      head.position.set(0, 0.72, 0.75);
      group.add(head);

      // Sparking tesla jaw tines
      const tineL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.24), cyanArcMat);
      tineL.position.set(-0.12, 0.66, 0.98);
      group.add(tineL);

      const tineR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.24), cyanArcMat);
      tineR.position.set(0.12, 0.66, 0.98);
      group.add(tineR);

      // 4 Articulated Quadruped Legs
      const makeHoundLeg = (x: number, z: number) => {
        const legGroup = new THREE.Group();
        legGroup.position.set(x, 0.55, z);
        const upper = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.32, 0.1), darkMat);
        upper.position.y = -0.15;
        legGroup.add(upper);
        const lower = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 0.08), chromeMat);
        lower.position.y = -0.42;
        legGroup.add(lower);
        group.add(legGroup);
        return legGroup;
      };

      animParts.frontLeftLeg = makeHoundLeg(-0.24, 0.45);
      animParts.frontRightLeg = makeHoundLeg(0.24, 0.45);
      animParts.backLeftLeg = makeHoundLeg(-0.24, -0.35);
      animParts.backRightLeg = makeHoundLeg(0.24, -0.35);

    } else {
      // ============================================================
      // 4. HEAVY MECH (TITAN): Massive siege walker with reactor core
      // ============================================================
      // Bulky armored chassis
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.8, 1.6), armorMat);
      chassis.position.y = 2.4;
      group.add(chassis);

      // Illuminated Power Reactor Core (Chest Weakpoint! 2.5x Critical)
      const reactorGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.15, 16);
      const reactor = new THREE.Mesh(reactorGeo, amberCoreMat);
      reactor.rotation.x = Math.PI / 2;
      reactor.position.set(0, 2.3, 0.85);
      group.add(reactor);
      animParts.reactorMesh = reactor;

      // Reactor protective cage grill
      const cage = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.04, 6, 16), darkMat);
      cage.position.set(0, 2.3, 0.9);
      group.add(cage);

      // Glowing sensor head
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45, 0.6), darkMat);
      head.position.set(0, 3.4, 0.4);
      group.add(head);

      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.12, 0.1), redEyeMat);
      visor.position.set(0, 3.4, 0.72);
      group.add(visor);

      // Twin shoulder rocket pods (6 silos each)
      const podGeo = new THREE.BoxGeometry(0.65, 0.65, 1.2);
      const leftPod = new THREE.Mesh(podGeo, darkMat);
      leftPod.position.set(-1.45, 3.1, 0);
      group.add(leftPod);

      const rightPod = new THREE.Mesh(podGeo, darkMat);
      rightPod.position.set(1.45, 3.1, 0);
      group.add(rightPod);

      // Missile silos inside pods
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 3; c++) {
          const siloGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.1, 8);
          const siloL = new THREE.Mesh(siloGeo, amberCoreMat);
          siloL.rotation.x = Math.PI / 2;
          siloL.position.set(-1.6 + c * 0.15, 3.2 - r * 0.18, 0.62);
          group.add(siloL);

          const siloR = new THREE.Mesh(siloGeo, amberCoreMat);
          siloR.rotation.x = Math.PI / 2;
          siloR.position.set(1.3 + c * 0.15, 3.2 - r * 0.18, 0.62);
          group.add(siloR);
        }
      }

      // Twin Gatling Cannon Arms
      const makeGatlingArm = (x: number) => {
        const armGroup = new THREE.Group();
        armGroup.position.set(x, 2.2, 0.2);
        const mount = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.5), darkMat);
        armGroup.add(mount);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.9, 10), chromeMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, -0.1, 0.5);
        armGroup.add(barrel);
        group.add(armGroup);
      };
      makeGatlingArm(-1.4);
      makeGatlingArm(1.4);

      // Heavy Hydraulic Legs with moving pistons
      animParts.hydraulicPistons = [];
      const makeMechLeg = (x: number) => {
        const legGroup = new THREE.Group();
        legGroup.position.set(x, 1.6, 0);

        // Upper thigh assembly
        const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.9, 0.55), darkMat);
        thigh.position.y = -0.45;
        legGroup.add(thigh);

        // Hydraulic piston cylinder
        const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.7, 8), chromeMat);
        piston.position.set(0, -0.7, -0.2);
        legGroup.add(piston);
        animParts.hydraulicPistons?.push(piston);

        // Lower calf & footpad
        const calf = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.8, 0.5), armorMat);
        calf.position.y = -1.1;
        legGroup.add(calf);

        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.2, 0.85), darkMat);
        foot.position.set(0, -1.5, 0.1);
        legGroup.add(foot);

        group.add(legGroup);
        return legGroup;
      };

      animParts.leftLeg = makeMechLeg(-0.85);
      animParts.rightLeg = makeMechLeg(0.85);
    }
  }

  damageDroid(droidId: string, shieldDmg: number, hpDmg: number, killed: boolean): boolean {
    const droid = this.droids.get(droidId);
    if (!droid) return false;

    droid.currentShield = Math.max(0, droid.currentShield - shieldDmg);
    droid.currentHp = Math.max(0, droid.currentHp - hpDmg);

    // Update billboard health texture
    const hpRatio = Math.max(0, droid.currentHp / droid.data.maxHp);
    const shieldRatio = droid.data.maxShield > 0 ? Math.max(0, droid.currentShield / droid.data.maxShield) : 0;

    const newTex = materials.createHealthBarSprite(hpRatio, shieldRatio);
    (droid.healthBarMesh.material as THREE.SpriteMaterial).map?.dispose();
    (droid.healthBarMesh.material as THREE.SpriteMaterial).map = newTex;
    (droid.healthBarMesh.material as THREE.SpriteMaterial).needsUpdate = true;

    // Hit flash
    droid.isHitFlashing = true;
    droid.hitFlashTimer = 0.08;
    this.applyFlashMaterial(droid.mesh, true);

    if (killed || droid.currentHp <= 0) {
      this.explodeDroid(droid);
      return true;
    }
    return false;
  }

  private applyFlashMaterial(mesh: THREE.Group, flashing: boolean) {
    mesh.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        if (flashing) {
          child.userData.origMat = child.material;
          child.material = new THREE.MeshBasicMaterial({ color: 0xffffff });
        } else if (child.userData.origMat) {
          child.material = child.userData.origMat;
          delete child.userData.origMat;
        }
      }
    });
  }

  private explodeDroid(droid: Droid3DInstance) {
    sounds.playDroidExplosion();

    // Spawn 14-20 debris particles
    const pos = droid.mesh.position;
    const isMech = droid.data.type === 'heavy_mech';
    const count = isMech ? 24 : 14;

    for (let i = 0; i < count; i++) {
      const pGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
      const pMat = new THREE.MeshBasicMaterial({
        color: Math.random() < 0.4 ? 0xef4444 : Math.random() < 0.7 ? 0xf59e0b : 0x06b6d4,
      });
      const pMesh = new THREE.Mesh(pGeo, pMat);
      pMesh.position.copy(pos);
      pMesh.position.y += 0.8 + Math.random() * (isMech ? 2.0 : 1.0);
      this.rootGroup.add(pMesh);

      this.particles.push({
        mesh: pMesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 8,
          Math.random() * 6 + 2,
          (Math.random() - 0.5) * 8
        ),
        life: 0,
        maxLife: 1.4,
        gravity: 9.8,
      });
    }

    // Remove droid and animation data
    this.rootGroup.remove(droid.mesh);
    this.droids.delete(droid.data.id);
    this.droidAnimParts.delete(droid.data.id);
  }

  update(
    deltaSec: number,
    playerPos: THREE.Vector3,
    sectorBuilder: SectorBuilder,
    onPlayerAttacked: (damage: number) => void
  ) {
    const now = performance.now();

    for (const droid of this.droids.values()) {
      const animParts = this.droidAnimParts.get(droid.data.id);
      if (animParts) {
        animParts.animTimer += deltaSec;
      }

      // Hit flash recovery
      if (droid.isHitFlashing) {
        droid.hitFlashTimer -= deltaSec;
        if (droid.hitFlashTimer <= 0) {
          droid.isHitFlashing = false;
          this.applyFlashMaterial(droid.mesh, false);
        }
      }

      // Movement toward player
      const dir = new THREE.Vector3().subVectors(playerPos, droid.mesh.position);
      dir.y = 0;
      const dist = dir.length();

      // Look at player
      droid.mesh.lookAt(playerPos.x, droid.mesh.position.y, playerPos.z);

      // Speed based on type
      let moveSpeed = 2.4;
      if (droid.data.type === 'shock_hound') moveSpeed = 4.4;
      else if (droid.data.type === 'heavy_mech') moveSpeed = 1.6;
      else if (droid.data.type === 'stealth_infiltrator') moveSpeed = 3.0;

      const stopDist = droid.data.type === 'shock_hound' ? 1.6 : droid.data.type === 'heavy_mech' ? 3.4 : 2.6;
      const isWalking = dist > stopDist;

      if (isWalking) {
        dir.normalize();
        const proposedPos = droid.mesh.position.clone().addScaledVector(dir, moveSpeed * deltaSec);

        // Check if movement intersects any locked blast door
        let blockedByDoor = false;
        const droidBox = new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(proposedPos.x, proposedPos.y + 1, proposedPos.z),
          new THREE.Vector3(1.0, 2.2, 1.0)
        );

        for (const door of sectorBuilder.doors.values()) {
          if (!door.unlocked && door.collider.intersectsBox(droidBox)) {
            blockedByDoor = true;
            break;
          }
        }

        if (!blockedByDoor) {
          droid.mesh.position.copy(proposedPos);
        }
      } else {
        // Attack player if within range
        const attackInterval = droid.data.type === 'heavy_mech' ? 2200 : 1500;
        if (now - droid.lastAttackTime > attackInterval) {
          droid.lastAttackTime = now;
          onPlayerAttacked(droid.data.damage);
        }
      }

      // --- Articulated Animations ---
      if (animParts) {
        const t = animParts.animTimer;

        // 1. Patrol Drone: Spin 4 rotors & bob hover
        if (animParts.rotors) {
          for (const rotor of animParts.rotors) {
            rotor.rotation.y += deltaSec * 35;
          }
          droid.mesh.position.y = 0.2 + Math.sin(t * 3.5) * 0.12;
        }

        // 2. Security Droid: Walking stride
        if (animParts.leftLeg && animParts.rightLeg && droid.data.type === 'security_droid') {
          if (isWalking) {
            const stride = Math.sin(t * 8) * 0.5;
            animParts.leftLeg.rotation.x = stride;
            animParts.rightLeg.rotation.x = -stride;
          } else {
            animParts.leftLeg.rotation.x = THREE.MathUtils.lerp(animParts.leftLeg.rotation.x, 0, deltaSec * 8);
            animParts.rightLeg.rotation.x = THREE.MathUtils.lerp(animParts.rightLeg.rotation.x, 0, deltaSec * 8);
          }
        }

        // 3. Shock Hound: Quadruped run gallop & spine flex
        if (droid.data.type === 'shock_hound') {
          if (isWalking) {
            const stride = Math.sin(t * 12) * 0.6;
            if (animParts.frontLeftLeg) animParts.frontLeftLeg.rotation.x = stride;
            if (animParts.frontRightLeg) animParts.frontRightLeg.rotation.x = -stride;
            if (animParts.backLeftLeg) animParts.backLeftLeg.rotation.x = -stride;
            if (animParts.backRightLeg) animParts.backRightLeg.rotation.x = stride;

            if (animParts.spineSegments) {
              for (let s = 0; s < animParts.spineSegments.length; s++) {
                animParts.spineSegments[s].position.y = 0.65 + Math.sin(t * 12 + s) * 0.04;
              }
            }
          }
        }

        // 4. Heavy Mech: Hydraulic piston movement & reactor core pulse
        if (droid.data.type === 'heavy_mech') {
          if (animParts.reactorMesh) {
            const pulse = 0.8 + Math.sin(t * 6) * 0.2;
            (animParts.reactorMesh.material as THREE.MeshBasicMaterial).color.setRGB(1.0 * pulse, 0.65 * pulse, 0.1);
          }
          if (isWalking && animParts.leftLeg && animParts.rightLeg) {
            const stride = Math.sin(t * 4) * 0.35;
            animParts.leftLeg.rotation.x = stride;
            animParts.rightLeg.rotation.x = -stride;

            if (animParts.hydraulicPistons) {
              for (const piston of animParts.hydraulicPistons) {
                piston.position.y = -0.7 + Math.abs(Math.sin(t * 4)) * 0.08;
              }
            }
          }
        }
      }
    }

    // Update debris particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += deltaSec;
      if (p.life >= p.maxLife) {
        this.rootGroup.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
      } else {
        p.velocity.y -= p.gravity * deltaSec;
        p.mesh.position.addScaledVector(p.velocity, deltaSec);
        p.mesh.rotation.x += deltaSec * 5;
        p.mesh.rotation.y += deltaSec * 7;
      }
    }
  }
}
