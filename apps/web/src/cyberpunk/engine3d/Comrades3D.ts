import * as THREE from 'three';
import type { Comrade, SectorId } from '@arcanora/core';
import { materials } from './materials.js';
import type { Comrade3DInstance, Particle3D } from './types3d.js';

export const COMRADE_STATIONS: Record<string, { sectorId: SectorId; position: THREE.Vector3; rotationY: number }> = {
  comrade_jax: {
    sectorId: 'platform_04',
    position: new THREE.Vector3(7.2, 0, -6),
    rotationY: -Math.PI / 2,
  },
  comrade_echo: {
    sectorId: 'sector_01_power',
    position: new THREE.Vector3(5.2, 0, -42),
    rotationY: -Math.PI / 2,
  },
  comrade_kane: {
    sectorId: 'sector_02_chop_shop',
    position: new THREE.Vector3(-35, 0, 3),
    rotationY: Math.PI / 4,
  },
  comrade_vane: {
    sectorId: 'sector_03_ripper_clinic',
    position: new THREE.Vector3(1.2, 0, -82),
    rotationY: -Math.PI / 2,
  },
  comrade_fang: {
    sectorId: 'sector_04_mag_junction',
    position: new THREE.Vector3(-78, 0, 6),
    rotationY: Math.PI / 2,
  },
  comrade_nyx: {
    sectorId: 'sector_05_deep_vault',
    position: new THREE.Vector3(-74, 0, -56),
    rotationY: -Math.PI / 2,
  },
};

export class Comrades3D {
  readonly rootGroup: THREE.Group = new THREE.Group();
  readonly comrades: Map<string, Comrade3DInstance> = new Map();
  private sparkParticles: Particle3D[] = [];

  syncComrades(comradeList: Comrade[]) {
    for (const comrade of comradeList) {
      if (!this.comrades.has(comrade.id)) {
        this.spawnComrade(comrade);
      } else {
        const instance = this.comrades.get(comrade.id)!;
        instance.data = comrade;
      }
    }
  }

  private spawnComrade(comrade: Comrade) {
    const station = COMRADE_STATIONS[comrade.id] || {
      sectorId: 'platform_04' as SectorId,
      position: new THREE.Vector3(4, 0, -2),
      rotationY: 0,
    };

    const group = new THREE.Group();
    group.position.copy(station.position);
    group.rotation.y = station.rotationY;

    // Stylized Humanoid Cyberpunk Model
    const coatMat = materials.getWallMaterial(0x334155);
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.8 });
    const visorMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });

    // Torso / Trenchcoat
    const torsoGeo = new THREE.BoxGeometry(0.65, 0.9, 0.4);
    const torso = new THREE.Mesh(torsoGeo, coatMat);
    torso.position.y = 1.25;
    group.add(torso);

    // Head
    const headGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 1.95;
    group.add(head);

    // Glowing Cyber Visor
    const visorGeo = new THREE.BoxGeometry(0.32, 0.1, 0.1);
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 1.98, 0.18);
    group.add(visor);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.18, 0.7, 0.18);
    const leftArm = new THREE.Mesh(armGeo, coatMat);
    leftArm.position.set(-0.45, 1.2, 0);
    const rightArm = new THREE.Mesh(armGeo, coatMat);
    rightArm.position.set(0.45, 1.2, 0);
    group.add(leftArm);
    group.add(rightArm);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.24, 0.8, 0.24);
    const leftLeg = new THREE.Mesh(legGeo, coatMat);
    leftLeg.position.set(-0.2, 0.4, 0);
    const rightLeg = new THREE.Mesh(legGeo, coatMat);
    rightLeg.position.set(0.2, 0.4, 0);
    group.add(leftLeg);
    group.add(rightLeg);

    // Overhead Nameplate Sprite
    const roleTitle = `${comrade.name} [${comrade.role.toUpperCase()}]`;
    const nameplate = materials.createBadgeSprite(roleTitle, '[E] INTERACT', '#38bdf8');
    nameplate.position.set(0, 2.5, 0);
    group.add(nameplate);

    const instance: Comrade3DInstance = {
      data: comrade,
      mesh: group,
      nameplate,
      stationPosition: station.position.clone(),
      animTimer: Math.random() * 10,
    };

    this.comrades.set(comrade.id, instance);
    this.rootGroup.add(group);
  }

  update(deltaSec: number) {
    for (const comrade of this.comrades.values()) {
      comrade.animTimer += deltaSec;

      // Subtle idle breathing motion
      comrade.mesh.position.y = Math.sin(comrade.animTimer * 2) * 0.02;

      // Scrappers spawn occasional welding sparks
      if (comrade.data.role === 'scrapper' && Math.random() < 0.15) {
        this.emitWeldingSparks(comrade.mesh.position);
      }
    }

    // Update welding sparks
    for (let i = this.sparkParticles.length - 1; i >= 0; i--) {
      const p = this.sparkParticles[i];
      p.life += deltaSec;
      if (p.life >= p.maxLife) {
        this.rootGroup.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.sparkParticles.splice(i, 1);
      } else {
        p.velocity.y -= p.gravity * deltaSec;
        p.mesh.position.addScaledVector(p.velocity, deltaSec);
      }
    }
  }

  private emitWeldingSparks(pos: THREE.Vector3) {
    for (let i = 0; i < 3; i++) {
      const pGeo = new THREE.BoxGeometry(0.04, 0.04, 0.04);
      const pMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const pMesh = new THREE.Mesh(pGeo, pMat);
      pMesh.position.set(pos.x + 0.3, pos.y + 0.9, pos.z + 0.2);
      this.rootGroup.add(pMesh);

      this.sparkParticles.push({
        mesh: pMesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          Math.random() * 2 + 1,
          (Math.random() - 0.5) * 2
        ),
        life: 0,
        maxLife: 0.35,
        gravity: 9.8,
      });
    }
  }
}
