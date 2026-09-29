import * as THREE from 'three';

export class PlayerBody3D {
  readonly rootGroup: THREE.Group = new THREE.Group();
  private leftLegGroup: THREE.Group = new THREE.Group();
  private rightLegGroup: THREE.Group = new THREE.Group();

  private strideTimer = 0;
  private legMaterials: THREE.Material[] = [];

  constructor() {
    this.buildLegs();
    this.rootGroup.add(this.leftLegGroup);
    this.rootGroup.add(this.rightLegGroup);

    // Position legs relative to camera base
    this.leftLegGroup.position.set(-0.16, -0.9, -0.15);
    this.rightLegGroup.position.set(0.16, -0.9, -0.15);
  }

  private buildLegs() {
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.8,
      roughness: 0.3,
      transparent: true,
      opacity: 1.0,
    });
    this.legMaterials.push(armorMat);

    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.9,
      roughness: 0.2,
      transparent: true,
      opacity: 1.0,
    });
    this.legMaterials.push(darkMat);

    const neonMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.8,
    });
    this.legMaterials.push(neonMat);

    // Build Left Leg Assembly
    this.assembleLeg(this.leftLegGroup, armorMat, darkMat, neonMat);

    // Build Right Leg Assembly
    this.assembleLeg(this.rightLegGroup, armorMat, darkMat, neonMat);
  }

  private assembleLeg(
    legGroup: THREE.Group,
    armorMat: THREE.Material,
    darkMat: THREE.Material,
    neonMat: THREE.Material
  ) {
    // Thigh
    const thighGeo = new THREE.BoxGeometry(0.13, 0.35, 0.14);
    const thigh = new THREE.Mesh(thighGeo, armorMat);
    thigh.position.set(0, 0, 0);
    legGroup.add(thigh);

    // Knee cybernetic hinge
    const kneeGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.14, 12);
    const knee = new THREE.Mesh(kneeGeo, darkMat);
    knee.rotation.z = Math.PI / 2;
    knee.position.set(0, -0.2, 0.02);
    legGroup.add(knee);

    // Shin guard
    const shinGeo = new THREE.BoxGeometry(0.11, 0.35, 0.12);
    const shin = new THREE.Mesh(shinGeo, armorMat);
    shin.position.set(0, -0.4, 0);
    legGroup.add(shin);

    // Shin neon light strip
    const stripGeo = new THREE.BoxGeometry(0.02, 0.25, 0.13);
    const strip = new THREE.Mesh(stripGeo, neonMat);
    strip.position.set(0, -0.4, 0.02);
    legGroup.add(strip);

    // Tactical combat boot
    const bootBaseGeo = new THREE.BoxGeometry(0.12, 0.1, 0.24);
    const boot = new THREE.Mesh(bootBaseGeo, darkMat);
    boot.position.set(0, -0.62, -0.05);
    legGroup.add(boot);

    // Boot toe cap
    const toeGeo = new THREE.BoxGeometry(0.11, 0.08, 0.08);
    const toe = new THREE.Mesh(toeGeo, armorMat);
    toe.position.set(0, -0.62, -0.18);
    legGroup.add(toe);
  }

  update(deltaSec: number, isMoving: boolean, cameraPitch: number) {
    // Looking down causes pitch to be negative (or positive depending on coordinate convention)
    const isLookingDown = cameraPitch < -0.22 || cameraPitch > 0.22;

    if (!isLookingDown) {
      this.rootGroup.visible = false;
      return;
    }

    this.rootGroup.visible = true;

    // Fade opacity based on look down angle (0 at 0.22, 1 at 0.7 rad)
    const absPitch = Math.abs(cameraPitch);
    const opacityFactor = Math.min(1.0, Math.max(0, (absPitch - 0.22) / 0.45));
    for (const mat of this.legMaterials) {
      mat.opacity = opacityFactor;
    }

    // Walking stride animation
    if (isMoving) {
      this.strideTimer += deltaSec * 9;
      const leftStride = Math.sin(this.strideTimer) * 0.35;
      const rightStride = -Math.sin(this.strideTimer) * 0.35;

      this.leftLegGroup.rotation.x = leftStride;
      this.leftLegGroup.position.z = -0.15 + Math.sin(this.strideTimer) * 0.12;
      this.leftLegGroup.position.y = -0.9 + Math.abs(Math.cos(this.strideTimer)) * 0.04;

      this.rightLegGroup.rotation.x = rightStride;
      this.rightLegGroup.position.z = -0.15 - Math.sin(this.strideTimer) * 0.12;
      this.rightLegGroup.position.y = -0.9 + Math.abs(Math.sin(this.strideTimer)) * 0.04;
    } else {
      // Idle recovery
      this.leftLegGroup.rotation.x = THREE.MathUtils.lerp(this.leftLegGroup.rotation.x, 0, deltaSec * 8);
      this.rightLegGroup.rotation.x = THREE.MathUtils.lerp(this.rightLegGroup.rotation.x, 0, deltaSec * 8);
      this.leftLegGroup.position.set(-0.16, -0.9, -0.15);
      this.rightLegGroup.position.set(0.16, -0.9, -0.15);
    }
  }
}
