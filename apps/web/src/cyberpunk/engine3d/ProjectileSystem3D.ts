import * as THREE from 'three';
import type { WeaponStats, WeaponId } from '@arcanora/core';
import type { SectorBuilder } from './SectorBuilder.js';
import type { EnemyDroids3D } from './EnemyDroids3D.js';

export interface ProjectileHitResult {
  hit: boolean;
  droidId?: string;
  isHeadshot?: boolean;
  isWeakpoint?: boolean;
  hitPoint?: THREE.Vector3;
}

interface ActiveProjectile {
  mesh: THREE.Group;
  velocity: THREE.Vector3;
  speed: number;
  prevPosition: THREE.Vector3;
  weaponId: WeaponId;
  neonColor: string;
  light?: THREE.PointLight;
  age: number;
  maxLife: number;
  pierceRemaining: number;
  hitDroids: Set<string>;
  extraSpinMesh?: THREE.Mesh;
}

interface SparkParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  gravity: number;
}

export class ProjectileSystem3D {
  readonly rootGroup: THREE.Group = new THREE.Group();
  private projectiles: ActiveProjectile[] = [];
  private sparks: SparkParticle[] = [];

  // Shared reusable geometries and materials for performance pooling
  private pistolBoltGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.45, 8);
  private pelletGeo = new THREE.SphereGeometry(0.045, 6, 6);
  private smgDartGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.35, 6);
  private railSlugGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8);
  private railRingGeo = new THREE.TorusGeometry(0.14, 0.025, 6, 12);
  private sparkGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);

  spawnProjectiles(
    weapon: WeaponStats,
    muzzleWorldPos: THREE.Vector3,
    shootDirection: THREE.Vector3
  ) {
    const isShotgun = weapon.baseId === 'auto_shotgun';
    const isPistol = weapon.baseId === 'scrap_pistol';
    const isSmg = weapon.baseId === 'kinetic_smg';
    const isRailgun = weapon.baseId === 'heavy_rail_rifle';

    const pelletCount = isShotgun ? 8 : 1;
    const baseSpeed = isRailgun ? 240 : isSmg ? 120 : isPistol ? 90 : 75;

    for (let i = 0; i < pelletCount; i++) {
      const dir = shootDirection.clone();

      if (isShotgun) {
        // Cone spread
        const spreadX = (Math.random() - 0.5) * 0.09;
        const spreadY = (Math.random() - 0.5) * 0.09;
        const spreadZ = (Math.random() - 0.5) * 0.09;
        dir.add(new THREE.Vector3(spreadX, spreadY, spreadZ)).normalize();
      } else if (isSmg) {
        // Subtle kinetic spread
        const spread = 0.015;
        dir.x += (Math.random() - 0.5) * spread;
        dir.y += (Math.random() - 0.5) * spread;
        dir.z += (Math.random() - 0.5) * spread;
        dir.normalize();
      }

      const projGroup = new THREE.Group();
      projGroup.position.copy(muzzleWorldPos);

      // Align group rotation with flight direction
      const orientation = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        dir
      );
      projGroup.quaternion.copy(orientation);

      let light: THREE.PointLight | undefined;
      let extraSpinMesh: THREE.Mesh | undefined;

      const neonMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(weapon.neonColor),
      });

      if (isPistol) {
        // Cyan plasma bolt capsule + dynamic point light
        const bolt = new THREE.Mesh(this.pistolBoltGeo, neonMat);
        projGroup.add(bolt);

        light = new THREE.PointLight(new THREE.Color(weapon.neonColor), 2.5, 4.0);
        projGroup.add(light);
      } else if (isShotgun) {
        // Incendiary pellet sphere
        const pelletMat = new THREE.MeshBasicMaterial({
          color: Math.random() < 0.3 ? 0xffffff : new THREE.Color(weapon.neonColor),
        });
        const pellet = new THREE.Mesh(this.pelletGeo, pelletMat);
        projGroup.add(pellet);

        // Small point light for the central pellet
        if (i === 0) {
          light = new THREE.PointLight(new THREE.Color(weapon.neonColor), 2.0, 3.5);
          projGroup.add(light);
        }
      } else if (isSmg) {
        // Laser dart needle
        const dart = new THREE.Mesh(this.smgDartGeo, neonMat);
        projGroup.add(dart);
      } else if (isRailgun) {
        // Hyper-sonic heavy slug with spinning outer rings
        const slug = new THREE.Mesh(this.railSlugGeo, neonMat);
        projGroup.add(slug);

        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          wireframe: true,
        });
        extraSpinMesh = new THREE.Mesh(this.railRingGeo, ringMat);
        extraSpinMesh.rotation.x = Math.PI / 2;
        projGroup.add(extraSpinMesh);

        light = new THREE.PointLight(new THREE.Color(weapon.neonColor), 4.5, 7.0);
        projGroup.add(light);
      }

      this.rootGroup.add(projGroup);

      const projectileVelocity = dir.clone().multiplyScalar(baseSpeed);

      this.projectiles.push({
        mesh: projGroup,
        velocity: projectileVelocity,
        speed: baseSpeed,
        prevPosition: muzzleWorldPos.clone(),
        weaponId: weapon.baseId,
        neonColor: weapon.neonColor,
        light,
        age: 0,
        maxLife: isRailgun ? 1.5 : 1.2,
        pierceRemaining: isRailgun ? 3 : 1, // Railgun pierces multiple targets
        hitDroids: new Set<string>(),
        extraSpinMesh,
      });
    }
  }

  update(
    deltaSec: number,
    sectorBuilder: SectorBuilder,
    enemyDroids: EnemyDroids3D,
    onHitDroid: (
      droidId: string,
      hitPos: THREE.Vector3,
      isHeadshot: boolean,
      isWeakpoint: boolean,
      weaponId: WeaponId
    ) => void
  ) {
    // 1. Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.age += deltaSec;

      if (proj.age >= proj.maxLife) {
        this.removeProjectile(i);
        continue;
      }

      if (proj.extraSpinMesh) {
        proj.extraSpinMesh.rotation.z += deltaSec * 15;
      }

      proj.prevPosition.copy(proj.mesh.position);
      proj.mesh.position.addScaledVector(proj.velocity, deltaSec);

      // Sub-step Raycast from prevPosition to currentPosition
      const stepDelta = new THREE.Vector3().subVectors(proj.mesh.position, proj.prevPosition);
      const stepDist = stepDelta.length();
      if (stepDist < 0.0001) continue;

      const stepDir = stepDelta.clone().normalize();
      const ray = new THREE.Raycaster(proj.prevPosition, stepDir, 0, stepDist);

      // Check collision against locked blast doors or walls
      let hitEnvironment = false;
      const hitPoint = new THREE.Vector3();

      for (const door of sectorBuilder.doors.values()) {
        if (!door.unlocked) {
          const doorIntersects = ray.intersectObjects(door.group.children, true);
          if (doorIntersects.length > 0) {
            hitEnvironment = true;
            hitPoint.copy(doorIntersects[0].point);
            break;
          }
        }
      }

      if (hitEnvironment) {
        this.spawnImpactSparks(hitPoint, proj.neonColor, 8);
        this.removeProjectile(i);
        continue;
      }

      // Check collision against Enemy Droids
      let shouldTerminate = false;

      for (const [droidId, droidInstance] of enemyDroids.droids.entries()) {
        if (proj.hitDroids.has(droidId)) continue;

        const droidIntersects = ray.intersectObject(droidInstance.mesh, true);
        if (droidIntersects.length > 0) {
          const hit = droidIntersects[0];
          proj.hitDroids.add(droidId);
          proj.pierceRemaining--;

          // Detection for critical zones:
          // 1. Heavy Mech reactor core weakpoint: lower-mid front glowing reactor
          const isHeavyMech = droidInstance.data.type === 'heavy_mech';
          const relativeY = hit.point.y - droidInstance.mesh.position.y;
          const isHeadshot = !isHeavyMech && relativeY > 1.5;
          const isWeakpoint = isHeavyMech && relativeY > 1.2 && relativeY < 2.0;

          this.spawnImpactSparks(hit.point, isWeakpoint || isHeadshot ? '#f59e0b' : proj.neonColor, 12);
          onHitDroid(droidId, hit.point, isHeadshot, isWeakpoint, proj.weaponId);

          if (proj.pierceRemaining <= 0) {
            shouldTerminate = true;
            break;
          }
        }
      }

      if (shouldTerminate) {
        this.removeProjectile(i);
      }
    }

    // 2. Update Spark Particles
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const spark = this.sparks[i];
      spark.life += deltaSec;
      if (spark.life >= spark.maxLife) {
        this.rootGroup.remove(spark.mesh);
        spark.mesh.geometry.dispose();
        (spark.mesh.material as THREE.Material).dispose();
        this.sparks.splice(i, 1);
      } else {
        spark.velocity.y -= spark.gravity * deltaSec;
        spark.mesh.position.addScaledVector(spark.velocity, deltaSec);
        const alpha = 1.0 - spark.life / spark.maxLife;
        (spark.mesh.material as THREE.MeshBasicMaterial).opacity = alpha;
      }
    }
  }

  private spawnImpactSparks(pos: THREE.Vector3, colorHex: string, count: number) {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colorHex),
      transparent: true,
      opacity: 1.0,
    });

    for (let i = 0; i < count; i++) {
      const sparkMesh = new THREE.Mesh(this.sparkGeo, mat.clone());
      sparkMesh.position.copy(pos);
      this.rootGroup.add(sparkMesh);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 5,
        Math.random() * 4 + 1,
        (Math.random() - 0.5) * 5
      );

      this.sparks.push({
        mesh: sparkMesh,
        velocity: vel,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.25,
        gravity: 12.0,
      });
    }
  }

  private removeProjectile(index: number) {
    const proj = this.projectiles[index];
    this.rootGroup.remove(proj.mesh);
    this.projectiles.splice(index, 1);
  }

  clear() {
    for (const proj of this.projectiles) {
      this.rootGroup.remove(proj.mesh);
    }
    this.projectiles = [];

    for (const spark of this.sparks) {
      this.rootGroup.remove(spark.mesh);
    }
    this.sparks = [];
  }
}
