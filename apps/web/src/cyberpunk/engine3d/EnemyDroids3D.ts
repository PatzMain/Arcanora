import * as THREE from 'three';
import type { CombatEnemy } from '@arcanora/core';
import { materials } from './materials.js';
import { sounds } from './SoundManager.js';
import type { Droid3DInstance, Particle3D } from './types3d.js';
import type { SectorBuilder } from './SectorBuilder.js';

export class EnemyDroids3D {
  readonly rootGroup: THREE.Group = new THREE.Group();
  readonly droids: Map<string, Droid3DInstance> = new Map();
  private particles: Particle3D[] = [];

  spawnDroid(enemy: CombatEnemy, spawnPos: THREE.Vector3) {
    const droidGroup = new THREE.Group();
    droidGroup.position.copy(spawnPos);

    // Build 3D mesh based on enemy type
    this.buildDroidMesh(droidGroup, enemy.type);

    // Billboard Health & Shield Bar
    const healthTex = materials.createHealthBarSprite(1.0, enemy.shield > 0 ? 1.0 : 0);
    const spriteMat = new THREE.SpriteMaterial({ map: healthTex, transparent: true });
    const healthSprite = new THREE.Sprite(spriteMat);
    healthSprite.scale.set(2.0, 0.25, 1);
    healthSprite.position.set(0, enemy.type === 'heavy_mech' ? 3.4 : 2.2, 0);
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

  private buildDroidMesh(group: THREE.Group, type: CombatEnemy['type']) {
    const armorMat = materials.getWallMaterial(0x1e293b);
    const darkMat = materials.getWallMaterial(0x0f172a);
    const redEyeMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

    if (type === 'heavy_mech') {
      // Bulky torso
      const torsoGeo = new THREE.BoxGeometry(2.0, 1.8, 1.4);
      const torso = new THREE.Mesh(torsoGeo, armorMat);
      torso.position.y = 1.8;
      group.add(torso);

      // Glowing red sensor visor
      const visorGeo = new THREE.BoxGeometry(1.2, 0.25, 0.2);
      const visor = new THREE.Mesh(visorGeo, redEyeMat);
      visor.position.set(0, 2.2, 0.72);
      group.add(visor);

      // Twin shoulder rocket pods
      const podGeo = new THREE.BoxGeometry(0.6, 0.6, 1.2);
      const leftPod = new THREE.Mesh(podGeo, darkMat);
      leftPod.position.set(-1.3, 2.4, 0);
      const rightPod = new THREE.Mesh(podGeo, darkMat);
      rightPod.position.set(1.3, 2.4, 0);
      group.add(leftPod);
      group.add(rightPod);

      // Heavy Legs
      const legGeo = new THREE.BoxGeometry(0.5, 1.4, 0.6);
      const leftLeg = new THREE.Mesh(legGeo, darkMat);
      leftLeg.position.set(-0.7, 0.7, 0);
      const rightLeg = new THREE.Mesh(legGeo, darkMat);
      rightLeg.position.set(0.7, 0.7, 0);
      group.add(leftLeg);
      group.add(rightLeg);
    } else if (type === 'shock_hound') {
      // Quadruped body
      const bodyGeo = new THREE.BoxGeometry(0.8, 0.6, 1.6);
      const body = new THREE.Mesh(bodyGeo, armorMat);
      body.position.y = 0.7;
      group.add(body);

      // Head with electric arc tines
      const headGeo = new THREE.BoxGeometry(0.5, 0.4, 0.6);
      const head = new THREE.Mesh(headGeo, darkMat);
      head.position.set(0, 0.9, -0.9);
      group.add(head);

      const tineGeo = new THREE.BoxGeometry(0.08, 0.08, 0.4);
      const tineMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
      const leftTine = new THREE.Mesh(tineGeo, tineMat);
      leftTine.position.set(-0.25, 0.9, -1.2);
      const rightTine = new THREE.Mesh(tineGeo, tineMat);
      rightTine.position.set(0.25, 0.9, -1.2);
      group.add(leftTine);
      group.add(rightTine);
    } else {
      // Standard Security Droid / Corp Enforcer (Humanoid / Hovering)
      const chassisGeo = new THREE.CylinderGeometry(0.45, 0.35, 1.2, 12);
      const chassis = new THREE.Mesh(chassisGeo, armorMat);
      chassis.position.y = 1.2;
      group.add(chassis);

      // Glowing central optical eye
      const eyeGeo = new THREE.SphereGeometry(0.18, 12, 12);
      const eye = new THREE.Mesh(eyeGeo, redEyeMat);
      eye.position.set(0, 1.5, 0.38);
      group.add(eye);

      // Weapon arm
      const armGeo = new THREE.BoxGeometry(0.15, 0.15, 0.8);
      const arm = new THREE.Mesh(armGeo, darkMat);
      arm.position.set(0.55, 1.1, 0.2);
      group.add(arm);

      // Thruster light under chassis
      const thrustLight = new THREE.PointLight(0xef4444, 0.8, 3);
      thrustLight.position.set(0, 0.4, 0);
      group.add(thrustLight);
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

    // Spawn 8-14 debris particles
    const pos = droid.mesh.position;
    for (let i = 0; i < 12; i++) {
      const pGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
      const pMat = new THREE.MeshBasicMaterial({
        color: Math.random() < 0.5 ? 0xef4444 : 0x06b6d4,
      });
      const pMesh = new THREE.Mesh(pGeo, pMat);
      pMesh.position.copy(pos);
      pMesh.position.y += 0.8 + Math.random() * 0.8;
      this.rootGroup.add(pMesh);

      this.particles.push({
        mesh: pMesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 6,
          Math.random() * 5 + 2,
          (Math.random() - 0.5) * 6
        ),
        life: 0,
        maxLife: 1.2,
        gravity: 9.8,
      });
    }

    // Remove droid from scene
    this.rootGroup.remove(droid.mesh);
    this.droids.delete(droid.data.id);
  }

  update(
    deltaSec: number,
    playerPos: THREE.Vector3,
    sectorBuilder: SectorBuilder,
    onPlayerAttacked: (damage: number) => void
  ) {
    const now = performance.now();

    for (const droid of this.droids.values()) {
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
      if (droid.data.type === 'shock_hound') moveSpeed = 4.2;
      else if (droid.data.type === 'heavy_mech') moveSpeed = 1.6;

      const stopDist = droid.data.type === 'shock_hound' ? 1.6 : 2.8;

      if (dist > stopDist) {
        dir.normalize();
        const proposedPos = droid.mesh.position.clone().addScaledVector(dir, moveSpeed * deltaSec);

        // Check if movement intersects any locked blast door
        let blockedByDoor = false;
        const droidBox = new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(proposedPos.x, proposedPos.y + 1, proposedPos.z),
          new THREE.Vector3(0.8, 2.0, 0.8)
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
