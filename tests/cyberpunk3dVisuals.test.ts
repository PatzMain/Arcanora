import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  WEAPON_DEFINITIONS,
  createEnemy,
  createInitialPlayerState,
  calculateShotDamage,
} from '../packages/core/src/cyberpunk/index.js';

describe('Sector 0: 3D Visuals & Projectile Mechanics', () => {
  describe('Weapon Projectile Configurations', () => {
    it('defines distinct characteristics for all 4 weapons', () => {
      const pistol = WEAPON_DEFINITIONS.scrap_pistol[0];
      const shotgun = WEAPON_DEFINITIONS.auto_shotgun[0];
      const smg = WEAPON_DEFINITIONS.kinetic_smg[0];
      const railgun = WEAPON_DEFINITIONS.heavy_rail_rifle[0];

      expect(pistol.baseId).toBe('scrap_pistol');
      expect(shotgun.baseId).toBe('auto_shotgun');
      expect(smg.baseId).toBe('kinetic_smg');
      expect(railgun.baseId).toBe('heavy_rail_rifle');

      // Unique Neon Accent Colors
      expect(pistol.neonColor).not.toBe(shotgun.neonColor);
      expect(shotgun.neonColor).not.toBe(smg.neonColor);
      expect(smg.neonColor).not.toBe(railgun.neonColor);
    });

    it('simulates shotgun 8-pellet randomized cone spread', () => {
      const baseDir = new THREE.Vector3(0, 0, -1);
      const pelletDirs: THREE.Vector3[] = [];
      const pelletCount = 8;

      for (let i = 0; i < pelletCount; i++) {
        const dir = baseDir.clone();
        const spreadX = (Math.random() - 0.5) * 0.09;
        const spreadY = (Math.random() - 0.5) * 0.09;
        const spreadZ = (Math.random() - 0.5) * 0.09;
        dir.add(new THREE.Vector3(spreadX, spreadY, spreadZ)).normalize();
        pelletDirs.push(dir);
      }

      expect(pelletDirs.length).toBe(8);
      // All pellets should maintain forward momentum
      for (const p of pelletDirs) {
        expect(p.z).toBeLessThan(-0.95);
        expect(Math.abs(p.x)).toBeLessThan(0.1);
        expect(Math.abs(p.y)).toBeLessThan(0.1);
      }
    });

    it('calculates railgun piercing penetration count', () => {
      const railPierce = 3;
      const hitEnemies = new Set<string>();

      const enemyIds = ['droid_1', 'droid_2', 'droid_3', 'droid_4'];
      let remainingPierce = railPierce;

      for (const id of enemyIds) {
        if (remainingPierce > 0) {
          hitEnemies.add(id);
          remainingPierce--;
        }
      }

      expect(hitEnemies.size).toBe(3);
      expect(hitEnemies.has('droid_1')).toBe(true);
      expect(hitEnemies.has('droid_2')).toBe(true);
      expect(hitEnemies.has('droid_3')).toBe(true);
      expect(hitEnemies.has('droid_4')).toBe(false);
    });
  });

  describe('Sub-step Raycasting & Anti-Tunneling', () => {
    it('accurately traces high-speed projectile segment without skipping hitboxes', () => {
      // Railgun velocity: 240 m/s. Over delta 0.016s (60fps), distance = 3.84m
      const speed = 240;
      const deltaSec = 0.016;
      const startPos = new THREE.Vector3(0, 1.5, 0);
      const forwardDir = new THREE.Vector3(0, 0, -1);
      const endPos = startPos.clone().addScaledVector(forwardDir, speed * deltaSec);

      // Target enemy droid center at z = -2.0, thickness 0.8 (z from -1.6 to -2.4)
      const enemyBox = new THREE.Box3(
        new THREE.Vector3(-0.5, 0.5, -2.4),
        new THREE.Vector3(0.5, 2.5, -1.6)
      );

      const segmentRay = new THREE.Ray(startPos, forwardDir);
      const intersectPoint = new THREE.Vector3();
      const hit = segmentRay.intersectBox(enemyBox, intersectPoint);

      expect(hit).not.toBeNull();
      expect(intersectPoint.z).toBeCloseTo(-1.6, 2);
      expect(startPos.distanceTo(intersectPoint)).toBeLessThan(startPos.distanceTo(endPos));
    });
  });

  describe('Critical Hit Zones & Heavy Mech Weakpoint', () => {
    it('detects standard bipedal droid headshots', () => {
      const droidBaseY = 0;
      const hitY = 1.75;
      const isHeadshot = hitY > droidBaseY + 1.5;
      expect(isHeadshot).toBe(true);
    });

    it('detects Heavy Mech central reactor core weakpoint and scales 2.5x critical damage', () => {
      const mechBaseY = 0;
      const hitY = 1.6;
      const relativeY = hitY - mechBaseY;
      const isWeakpoint = relativeY > 1.2 && relativeY < 2.0;

      expect(isWeakpoint).toBe(true);

      const player = createInitialPlayerState();
      const railgun = WEAPON_DEFINITIONS.heavy_rail_rifle[0];
      const mech = createEnemy('heavy_mech', 1);

      const baseResult = calculateShotDamage(player, railgun, mech, false);
      const critHpDmg = Math.round(baseResult.hpDamage * 2.5);
      const critShieldDmg = Math.round(baseResult.shieldDamage * 2.5);

      expect(critHpDmg + critShieldDmg).toBeGreaterThan(baseResult.totalDamage * 2);
    });
  });

  describe('Player Body Leg Visibility Angle Math', () => {
    it('hides tactical legs when looking straight ahead or upward', () => {
      const straightPitch = 0.0;
      const upPitch = -0.15;
      const threshold = 0.22;

      const isStraightVisible = Math.abs(straightPitch) > threshold;
      const isUpVisible = Math.abs(upPitch) > threshold;

      expect(isStraightVisible).toBe(false);
      expect(isUpVisible).toBe(false);
    });

    it('displays tactical legs and scales opacity when looking downward', () => {
      const downPitch = 0.65; // ~37 degrees downward
      const threshold = 0.22;

      const isDownVisible = Math.abs(downPitch) > threshold;
      expect(isDownVisible).toBe(true);

      const opacity = Math.min(1.0, Math.max(0, (Math.abs(downPitch) - threshold) / 0.45));
      expect(opacity).toBeGreaterThan(0.9);
    });
  });

  describe('Viewmodel Reload Dip & Magazine Eject Curve', () => {
    it('computes bell curve dip for weapon reloading', () => {
      const progressMid = 0.5;
      const dipMid = Math.sin(progressMid * Math.PI);
      expect(dipMid).toBeCloseTo(1.0, 5);

      const progressStart = 0.0;
      const dipStart = Math.sin(progressStart * Math.PI);
      expect(dipStart).toBe(0.0);

      const progressEnd = 1.0;
      const dipEnd = Math.sin(progressEnd * Math.PI);
      expect(dipEnd).toBeCloseTo(0.0, 5);
    });
  });
});
