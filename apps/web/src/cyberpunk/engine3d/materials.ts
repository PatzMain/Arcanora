import * as THREE from 'three';

class MaterialManager {
  private textures: Map<string, THREE.CanvasTexture> = new Map();
  private materials: Map<string, THREE.Material> = new Map();

  private getOrCreateTexture(key: string, drawFn: (ctx: CanvasRenderingContext2D, width: number, height: number) => void): THREE.CanvasTexture {
    if (this.textures.has(key)) return this.textures.get(key)!;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      drawFn(ctx, 512, 512);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    this.textures.set(key, texture);
    return texture;
  }

  getFloorMaterial(): THREE.MeshStandardMaterial {
    const key = 'mat_floor';
    if (this.materials.has(key)) return this.materials.get(key) as THREE.MeshStandardMaterial;

    const texture = this.getOrCreateTexture('tex_floor', (ctx, w, h) => {
      // Dark slate background
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w, h);

      // Grid tiles
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 4;
      const step = 64;
      for (let x = 0; x <= w; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Neon cyan accent seams
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2;
      ctx.strokeRect(128, 128, 256, 256);

      // Subtle grunge specks
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      for (let i = 0; i < 500; i++) {
        const px = Math.random() * w;
        const py = Math.random() * h;
        ctx.fillRect(px, py, 2, 2);
      }
    });

    texture.repeat.set(4, 4);
    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.8,
      metalness: 0.3,
    });
    this.materials.set(key, mat);
    return mat;
  }

  getHazardMaterial(): THREE.MeshStandardMaterial {
    const key = 'mat_hazard';
    if (this.materials.has(key)) return this.materials.get(key) as THREE.MeshStandardMaterial;

    const texture = this.getOrCreateTexture('tex_hazard', (ctx, w, h) => {
      ctx.fillStyle = '#f59e0b'; // Amber yellow
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#0f172a'; // Dark stripe
      const stripeWidth = 40;
      for (let x = -w; x < w * 2; x += stripeWidth * 2) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + stripeWidth, 0);
        ctx.lineTo(x + stripeWidth + h, h);
        ctx.lineTo(x + h, h);
        ctx.closePath();
        ctx.fill();
      }
    });

    texture.repeat.set(2, 1);
    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.6,
      metalness: 0.2,
    });
    this.materials.set(key, mat);
    return mat;
  }

  getWallMaterial(colorHex: number = 0x1e293b): THREE.MeshStandardMaterial {
    const key = `mat_wall_${colorHex}`;
    if (this.materials.has(key)) return this.materials.get(key) as THREE.MeshStandardMaterial;

    const texture = this.getOrCreateTexture('tex_wall', (ctx, w, h) => {
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, w, h);

      // Metallic panels
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 6;
      ctx.strokeRect(16, 16, w - 32, h - 32);

      // Rivets
      ctx.fillStyle = '#9ca3af';
      const rivets = [
        [32, 32],
        [w - 32, 32],
        [32, h - 32],
        [w - 32, h - 32],
        [w / 2, 32],
        [w / 2, h - 32],
      ];
      for (const [rx, ry] of rivets) {
        ctx.beginPath();
        ctx.arc(rx, ry, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      color: colorHex,
      roughness: 0.7,
      metalness: 0.5,
    });
    this.materials.set(key, mat);
    return mat;
  }

  getCircuitMaterial(): THREE.MeshStandardMaterial {
    const key = 'mat_circuit';
    if (this.materials.has(key)) return this.materials.get(key) as THREE.MeshStandardMaterial;

    const texture = this.getOrCreateTexture('tex_circuit', (ctx, w, h) => {
      ctx.fillStyle = '#050b14';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 3;
      ctx.beginPath();
      // Draw procedural circuit pathways
      ctx.moveTo(50, 0); ctx.lineTo(50, 100); ctx.lineTo(150, 200); ctx.lineTo(150, 400);
      ctx.moveTo(250, 512); ctx.lineTo(250, 350); ctx.lineTo(380, 220); ctx.lineTo(380, 50);
      ctx.moveTo(0, 250); ctx.lineTo(100, 250); ctx.lineTo(200, 150); ctx.lineTo(450, 150);
      ctx.stroke();

      // Glowing circuit pads
      ctx.fillStyle = '#22d3ee';
      const pads = [[150, 400], [380, 50], [450, 150], [150, 200]];
      for (const [px, py] of pads) {
        ctx.beginPath();
        ctx.arc(px, py, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      emissive: new THREE.Color(0x06b6d4),
      emissiveIntensity: 0.4,
      roughness: 0.5,
      metalness: 0.8,
    });
    this.materials.set(key, mat);
    return mat;
  }

  createBadgeSprite(text: string, subtext: string, color: string = '#00f0ff'): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Dark translucent cyber border
      ctx.fillStyle = 'rgba(10, 15, 26, 0.85)';
      ctx.fillRect(4, 4, 504, 120);

      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, 504, 120);

      // Text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(text, 256, 52);

      ctx.fillStyle = color;
      ctx.font = 'bold 26px monospace';
      ctx.fillText(subtext, 256, 96);
    }

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(3.5, 0.875, 1);
    return sprite;
  }

  createHealthBarSprite(hpRatio: number, shieldRatio: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, 256, 32);

    // HP Bar (Red)
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(4, 18, Math.max(0, 248 * hpRatio), 10);

    // Shield Bar (Cyan)
    if (shieldRatio > 0) {
      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(4, 4, Math.max(0, 248 * shieldRatio), 10);
    }

    // Border
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, 252, 28);

    return new THREE.CanvasTexture(canvas);
  }
}

export const materials = new MaterialManager();
