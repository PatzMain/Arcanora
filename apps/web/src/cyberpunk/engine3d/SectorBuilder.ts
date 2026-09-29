import * as THREE from 'three';
import type { BlastDoorId, CyberpunkGameState, SectorId } from '@arcanora/core';
import { materials } from './materials.js';
import type { BlastDoor3DInstance, Terminal3DInstance } from './types3d.js';

export interface SectorRoomConfig {
  id: SectorId;
  center: THREE.Vector3;
  size: THREE.Vector3;
  wallColor: number;
  neonColor: number;
  lightIntensity: number;
}

export const SECTOR_CONFIGS: Record<SectorId, SectorRoomConfig> = {
  platform_04: {
    id: 'platform_04',
    center: new THREE.Vector3(0, 3, 0),
    size: new THREE.Vector3(28, 6, 30),
    wallColor: 0x1e293b,
    neonColor: 0x06b6d4, // Cyan
    lightIntensity: 1.2,
  },
  sector_01_power: {
    id: 'sector_01_power',
    center: new THREE.Vector3(0, 3.5, -42),
    size: new THREE.Vector3(24, 7, 26),
    wallColor: 0x1e1b4b,
    neonColor: 0x3b82f6, // Blue High-Voltage
    lightIntensity: 1.5,
  },
  sector_02_chop_shop: {
    id: 'sector_02_chop_shop',
    center: new THREE.Vector3(-38, 3, 0),
    size: new THREE.Vector3(24, 6, 24),
    wallColor: 0x311302,
    neonColor: 0xf97316, // Orange Lathe Glow
    lightIntensity: 1.4,
  },
  sector_03_ripper_clinic: {
    id: 'sector_03_ripper_clinic',
    center: new THREE.Vector3(0, 3, -78),
    size: new THREE.Vector3(24, 6, 26),
    wallColor: 0x022c22,
    neonColor: 0x10b981, // Medical Emerald
    lightIntensity: 1.3,
  },
  sector_04_mag_junction: {
    id: 'sector_04_mag_junction',
    center: new THREE.Vector3(-76, 4, 0),
    size: new THREE.Vector3(30, 8, 32),
    wallColor: 0x27272a,
    neonColor: 0xeab308, // Hazard Yellow
    lightIntensity: 1.3,
  },
  sector_05_deep_vault: {
    id: 'sector_05_deep_vault',
    center: new THREE.Vector3(-76, 3.5, -50),
    size: new THREE.Vector3(26, 7, 32),
    wallColor: 0x09090b,
    neonColor: 0xa855f7, // Deep Purple / Gold
    lightIntensity: 1.6,
  },
};

export interface DoorPlacement {
  id: BlastDoorId;
  position: THREE.Vector3;
  rotationY: number; // 0 for Z-aligned (facing Z), Math.PI / 2 for X-aligned
  width: number;
  height: number;
}

export const DOOR_PLACEMENTS: Record<BlastDoorId, DoorPlacement> = {
  door_power_substation: {
    id: 'door_power_substation',
    position: new THREE.Vector3(0, 0, -15),
    rotationY: 0,
    width: 6,
    height: 4.5,
  },
  door_chop_shop: {
    id: 'door_chop_shop',
    position: new THREE.Vector3(-14, 0, 0),
    rotationY: Math.PI / 2,
    width: 6,
    height: 4.5,
  },
  door_ripper_clinic: {
    id: 'door_ripper_clinic',
    position: new THREE.Vector3(0, 0, -55),
    rotationY: 0,
    width: 6,
    height: 4.5,
  },
  door_mag_junction: {
    id: 'door_mag_junction',
    position: new THREE.Vector3(-50, 0, 0),
    rotationY: Math.PI / 2,
    width: 6,
    height: 4.5,
  },
  door_deep_vault: {
    id: 'door_deep_vault',
    position: new THREE.Vector3(-76, 0, -20),
    rotationY: 0,
    width: 6,
    height: 4.5,
  },
};

export class SectorBuilder {
  readonly rootGroup: THREE.Group = new THREE.Group();
  readonly doors: Map<BlastDoorId, BlastDoor3DInstance> = new Map();
  readonly terminals: Map<string, Terminal3DInstance> = new Map();
  readonly wallColliders: THREE.Box3[] = [];

  buildWorld(state: CyberpunkGameState) {
    // 1. Build all 6 sectors
    for (const sectorConfig of Object.values(SECTOR_CONFIGS)) {
      this.buildSectorRoom(sectorConfig);
    }

    // 2. Build subway station specific features in Platform 04
    this.buildPlatform04Details();

    // 3. Build workstations / terminals in each sector
    this.buildSectorWorkstations(state);

    // 4. Build 3D Blast Doors
    for (const placement of Object.values(DOOR_PLACEMENTS)) {
      this.buildBlastDoor(placement, state);
    }
  }

  private buildSectorRoom(config: SectorRoomConfig) {
    const group = new THREE.Group();
    const { center, size, wallColor, neonColor, lightIntensity } = config;

    // Floor
    const floorGeo = new THREE.PlaneGeometry(size.x, size.z);
    const floorMat = materials.getFloorMaterial();
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(center.x, 0, center.z);
    floor.receiveShadow = true;
    group.add(floor);

    // Ceiling
    const ceilGeo = new THREE.PlaneGeometry(size.x, size.z);
    const ceilMat = materials.getWallMaterial(0x0f172a);
    const ceil = new THREE.Mesh(ceilGeo, ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(center.x, size.y, center.z);
    group.add(ceil);

    // Overhead neon lights
    const pointLight = new THREE.PointLight(neonColor, lightIntensity, 22);
    pointLight.position.set(center.x, size.y - 0.8, center.z);
    group.add(pointLight);

    // Add neon light tube fixture
    const tubeGeo = new THREE.BoxGeometry(4, 0.15, 0.3);
    const tubeMat = new THREE.MeshBasicMaterial({ color: neonColor });
    const tube = new THREE.Mesh(tubeGeo, tubeMat);
    tube.position.set(center.x, size.y - 0.1, center.z);
    group.add(tube);

    // Build perimeter walls with doorways left open where doors connect
    this.buildPerimeterWalls(config, group);

    this.rootGroup.add(group);
  }

  private buildPerimeterWalls(config: SectorRoomConfig, group: THREE.Group) {
    const { center, size, wallColor } = config;
    const wallMat = materials.getWallMaterial(wallColor);
    const halfX = size.x / 2;
    const halfZ = size.z / 2;
    const wallThick = 1.0;

    // North Wall (-Z)
    this.createWallSegment(group, wallMat, new THREE.Vector3(center.x, size.y / 2, center.z - halfZ), new THREE.Vector3(size.x, size.y, wallThick));
    // South Wall (+Z)
    this.createWallSegment(group, wallMat, new THREE.Vector3(center.x, size.y / 2, center.z + halfZ), new THREE.Vector3(size.x, size.y, wallThick));
    // East Wall (+X)
    this.createWallSegment(group, wallMat, new THREE.Vector3(center.x + halfX, size.y / 2, center.z), new THREE.Vector3(wallThick, size.y, size.z));
    // West Wall (-X)
    this.createWallSegment(group, wallMat, new THREE.Vector3(center.x - halfX, size.y / 2, center.z), new THREE.Vector3(wallThick, size.y, size.z));
  }

  private createWallSegment(parent: THREE.Group, mat: THREE.Material, pos: THREE.Vector3, size: THREE.Vector3) {
    const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    parent.add(mesh);

    // Register wall collider
    const box = new THREE.Box3().setFromObject(mesh);
    this.wallColliders.push(box);
  }

  private buildPlatform04Details() {
    // Subway track trench: Recessed track bed along X = -8 to -13
    const trenchMat = materials.getWallMaterial(0x0a0f1d);
    const trenchGeo = new THREE.BoxGeometry(5, 0.4, 28);
    const trench = new THREE.Mesh(trenchGeo, trenchMat);
    trench.position.set(-10, -0.2, 0);
    this.rootGroup.add(trench);

    // Steel rails
    const railMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });
    const railGeo = new THREE.BoxGeometry(0.12, 0.2, 28);
    const leftRail = new THREE.Mesh(railGeo, railMat);
    leftRail.position.set(-11, 0.1, 0);
    const rightRail = new THREE.Mesh(railGeo, railMat);
    rightRail.position.set(-9, 0.1, 0);
    this.rootGroup.add(leftRail);
    this.rootGroup.add(rightRail);

    // Platform hazard edge strip
    const hazardMat = materials.getHazardMaterial();
    const hazardGeo = new THREE.BoxGeometry(0.6, 0.05, 28);
    const hazard = new THREE.Mesh(hazardGeo, hazardMat);
    hazard.position.set(-7.2, 0.03, 0);
    this.rootGroup.add(hazard);

    // Central diesel-fusion dynamo generator
    const dynamoGroup = new THREE.Group();
    dynamoGroup.position.set(6, 0, 6);

    const baseGeo = new THREE.CylinderGeometry(1.6, 1.8, 1.2, 16);
    const baseMat = materials.getWallMaterial(0x334155);
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.6;
    dynamoGroup.add(base);

    // Glowing core
    const coreGeo = new THREE.CylinderGeometry(1.0, 1.0, 1.5, 16);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.y = 1.8;
    dynamoGroup.add(core);

    const dynamoLight = new THREE.PointLight(0x06b6d4, 1.5, 8);
    dynamoLight.position.y = 2.2;
    dynamoGroup.add(dynamoLight);

    this.rootGroup.add(dynamoGroup);
  }

  private buildSectorWorkstations(state: CyberpunkGameState) {
    // 1. Scrapper bench in Platform 04
    this.createWorkstationTerminal({
      id: 'term_hub_scrappers',
      sectorId: 'platform_04',
      position: new THREE.Vector3(8, 0, -6),
      color: 0x38bdf8,
      name: 'Scavenger Sorting Bench',
      subtitle: '[E] SALVAGE TECH SCRAP',
      state,
    });

    // 2. Grid Power Circuit Breaker in Sector 01
    this.createWorkstationTerminal({
      id: 'term_substation_grid',
      sectorId: 'sector_01_power',
      position: new THREE.Vector3(6, 0, -42),
      color: 0x3b82f6,
      name: 'Grid Circuit Breaker',
      subtitle: '[E] SUBSTATION GRID',
      state,
    });

    // 3. Chop-Shop Weapon Overclock Lathe ("Pack-a-Punch") in Sector 02
    this.createWorkstationTerminal({
      id: 'term_overclock_bench',
      sectorId: 'sector_02_chop_shop',
      position: new THREE.Vector3(-38, 0, 0),
      color: 0xf97316,
      name: 'Chop-Shop Weapon Lathe',
      subtitle: '[E] PACK-A-PUNCH OVERCLOCK',
      state,
    });

    // 4. Ripper Clinic Bio-Synthetic Perk Terminal in Sector 03
    this.createWorkstationTerminal({
      id: 'term_cyber_perk_pod',
      sectorId: 'sector_03_ripper_clinic',
      position: new THREE.Vector3(0, 0, -82),
      color: 0x10b981,
      name: 'Bio-Synthetic Perk Terminal',
      subtitle: '[E] BUY CYBER-PERKS',
      state,
    });

    // 5. Heavy Salvage Crane in Sector 04
    this.createWorkstationTerminal({
      id: 'term_mag_crane',
      sectorId: 'sector_04_mag_junction',
      position: new THREE.Vector3(-80, 0, 6),
      color: 0xeab308,
      name: 'Heavy Scrap Salvage Rig',
      subtitle: '[E] INDUSTRIAL SCRAP CRANE',
      state,
    });

    // 6. Quantum Data Core in Sector 05
    this.createWorkstationTerminal({
      id: 'term_vault_mainframe',
      sectorId: 'sector_05_deep_vault',
      position: new THREE.Vector3(-76, 0, -56),
      color: 0xa855f7,
      name: 'Quantum Data Core',
      subtitle: '[E] QUANTUM MAINFRAME',
      state,
    });
  }

  private createWorkstationTerminal(options: {
    id: string;
    sectorId: SectorId;
    position: THREE.Vector3;
    color: number;
    name: string;
    subtitle: string;
    state: CyberpunkGameState;
  }) {
    const { id, sectorId, position, color, name, subtitle, state } = options;
    const group = new THREE.Group();
    group.position.copy(position);

    // Desk/Console base
    const deskGeo = new THREE.BoxGeometry(2.4, 1.1, 1.2);
    const deskMat = materials.getWallMaterial(0x1e293b);
    const desk = new THREE.Mesh(deskGeo, deskMat);
    desk.position.y = 0.55;
    group.add(desk);

    // Angled holographic monitor
    const screenGeo = new THREE.BoxGeometry(1.6, 0.9, 0.1);
    const screenMat = new THREE.MeshBasicMaterial({ color });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.set(0, 1.4, -0.2);
    screen.rotation.x = 0.2;
    group.add(screen);

    // Terminal light
    const light = new THREE.PointLight(color, 1.2, 5);
    light.position.set(0, 1.8, 0);
    group.add(light);

    // Overhead Floating Badge
    const badge = materials.createBadgeSprite(name, subtitle, '#' + color.toString(16).padStart(6, '0'));
    badge.position.set(0, 2.5, 0);
    group.add(badge);

    const terminalData = state.sectors[sectorId]?.terminals.find((t) => t.id === id) || {
      id,
      name,
      type: 'power',
      operational: true,
      repairCost: {},
      description: '',
    };

    const instance: Terminal3DInstance = {
      terminalId: id,
      sectorId,
      data: terminalData,
      mesh: group,
      light,
      screenMesh: screen,
    };

    this.terminals.set(id, instance);
    this.rootGroup.add(group);
  }

  private buildBlastDoor(placement: DoorPlacement, state: CyberpunkGameState) {
    const { id, position, rotationY, width, height } = placement;
    const doorData = state.doors[id];
    const isUnlocked = doorData ? doorData.unlocked : false;

    const group = new THREE.Group();
    group.position.copy(position);
    group.rotation.y = rotationY;

    // Door Frame Top Beam
    const frameMat = materials.getWallMaterial(0x334155);
    const topBeamGeo = new THREE.BoxGeometry(width + 0.8, 0.8, 0.8);
    const topBeam = new THREE.Mesh(topBeamGeo, frameMat);
    topBeam.position.set(0, height + 0.4, 0);
    group.add(topBeam);

    // Left and Right Frame Posts
    const postGeo = new THREE.BoxGeometry(0.8, height, 0.8);
    const leftPost = new THREE.Mesh(postGeo, frameMat);
    leftPost.position.set(-(width / 2 + 0.4), height / 2, 0);
    const rightPost = new THREE.Mesh(postGeo, frameMat);
    rightPost.position.set(width / 2 + 0.4, height / 2, 0);
    group.add(leftPost);
    group.add(rightPost);

    // Warning light above door
    const lightColor = isUnlocked ? 0x22c55e : 0xef4444; // Green if open, Red if locked
    const warningLight = new THREE.PointLight(lightColor, 1.5, 6);
    warningLight.position.set(0, height + 0.9, 0.6);
    group.add(warningLight);

    // Hydraulic Sliding Door Panels (Left and Right)
    const panelWidth = width / 2;
    const panelGeo = new THREE.BoxGeometry(panelWidth, height, 0.3);
    const doorMat = materials.getHazardMaterial();

    const leftPanel = new THREE.Mesh(panelGeo, doorMat);
    leftPanel.position.set(-panelWidth / 2, height / 2, 0);
    group.add(leftPanel);

    const rightPanel = new THREE.Mesh(panelGeo, doorMat);
    rightPanel.position.set(panelWidth / 2, height / 2, 0);
    group.add(rightPanel);

    // Floating 3D Badge (COD Zombies Style Door Prompt)
    const costText = doorData ? `${doorData.code} | [E] UNLOCK — ${doorData.cost.credits || 0} CR` : '[E] UNLOCK';
    const badgeColor = isUnlocked ? '#22c55e' : '#f59e0b';
    const badge = materials.createBadgeSprite(doorData?.name || 'Blast Door', isUnlocked ? 'DOOR OPEN' : costText, badgeColor);
    badge.position.set(0, height / 2, 0.8);
    group.add(badge);

    // Collider box
    const collider = new THREE.Box3();
    const boxHelper = new THREE.Mesh(new THREE.BoxGeometry(width, height, 1.2));
    boxHelper.position.copy(position);
    boxHelper.rotation.y = rotationY;
    boxHelper.position.y += height / 2;
    collider.setFromObject(boxHelper);

    const instance: BlastDoor3DInstance = {
      doorId: id,
      group,
      leftPanel,
      rightPanel,
      collider,
      unlocked: isUnlocked,
      slideProgress: isUnlocked ? 1.0 : 0.0,
      badgeSprite: badge,
      warningLight,
    };

    if (isUnlocked) {
      leftPanel.position.x = -panelWidth * 1.5;
      rightPanel.position.x = panelWidth * 1.5;
    }

    this.doors.set(id, instance);
    this.rootGroup.add(group);
  }

  updateDoors(deltaSec: number) {
    for (const door of this.doors.values()) {
      if (door.unlocked && door.slideProgress < 1.0) {
        door.slideProgress = Math.min(1.0, door.slideProgress + deltaSec * 2.5);
        const panelWidth = 3.0;
        door.leftPanel.position.x = -panelWidth / 2 - door.slideProgress * panelWidth;
        door.rightPanel.position.x = panelWidth / 2 + door.slideProgress * panelWidth;
      }
    }
  }

  unlockDoor3D(doorId: BlastDoorId) {
    const door = this.doors.get(doorId);
    if (!door) return;
    door.unlocked = true;
    door.warningLight.color.setHex(0x22c55e);
    door.badgeSprite.visible = false;
  }
}
