import type {
  BlastDoorId,
  CombatEnemy,
  Comrade,
  SectorId,
  TerminalState,
  WeaponStats,
} from '@arcanora/core';
import type * as THREE from 'three';

export interface RaycastInteraction {
  type: 'door' | 'terminal' | 'comrade' | 'none';
  id: string;
  name: string;
  prompt: string;
  costText?: string;
  canAfford?: boolean;
  distance: number;
}

export interface Droid3DInstance {
  data: CombatEnemy;
  mesh: THREE.Group;
  healthBarMesh: THREE.Sprite;
  currentHp: number;
  currentShield: number;
  velocity: THREE.Vector3;
  lastAttackTime: number;
  isHitFlashing: boolean;
  hitFlashTimer: number;
}

export interface Comrade3DInstance {
  data: Comrade;
  mesh: THREE.Group;
  nameplate: THREE.Sprite;
  stationPosition: THREE.Vector3;
  animTimer: number;
}

export interface BlastDoor3DInstance {
  doorId: BlastDoorId;
  group: THREE.Group;
  leftPanel: THREE.Mesh;
  rightPanel: THREE.Mesh;
  collider: THREE.Box3;
  unlocked: boolean;
  slideProgress: number; // 0 closed, 1 fully open
  badgeSprite: THREE.Sprite;
  warningLight: THREE.PointLight;
}

export interface Terminal3DInstance {
  terminalId: string;
  sectorId: SectorId;
  data: TerminalState;
  mesh: THREE.Group;
  light: THREE.PointLight;
  screenMesh: THREE.Mesh;
}

export interface Particle3D {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  gravity: number;
}

export interface LaserTracer3D {
  line: THREE.Line;
  start: THREE.Vector3;
  end: THREE.Vector3;
  color: string;
  age: number;
  lifetime: number;
}
