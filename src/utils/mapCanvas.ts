import { createCanvas, loadImage, GlobalFonts, type Image } from '@napi-rs/canvas';
import { join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { zonesCatalog } from './catalog.js';

// ── Types ──

interface LocationConfig {
  x: number;
  y: number;
  type: 'settlement' | 'wilderness' | 'dungeon';
  labelOffset: { x: number; y: number };
  fogRadius: number;
}

interface PathConfig {
  from: string;
  to: string;
}

interface MapConfig {
  imageWidth: number;
  imageHeight: number;
  markerSize: number;
  playerMarkerSize: number;
  labelFont: string;
  labelColor: string;
  labelShadowColor: string;
  pathColor: string;
  pathWidth: number;
  pathDashPattern: number[];
  fogColor: string;
  locations: Record<string, LocationConfig>;
  paths: PathConfig[];
}

// ── Startup Cache (loaded once) ──

let baseImage: Image | null = null;
let mapConfig: MapConfig | null = null;
let initialized = false;

// ── In-Memory Render Cache ──

const renderCache = new Map<string, { buffer: Buffer; timestamp: number }>();
const MAX_CACHE_SIZE = 50;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ── Initialization ──

export async function initMapAssets(): Promise<void> {
  if (initialized) return;

  try {
    const fontPath = join(process.cwd(), 'assets', 'fonts', 'PressStart2P.ttf');
    if (existsSync(fontPath)) {
      GlobalFonts.registerFromPath(fontPath, 'Press Start 2P');
      console.log('[MapCanvas] Registered Press Start 2P font.');
    } else {
      console.warn('[MapCanvas] Font file not found at:', fontPath);
    }

    const imagePath = join(process.cwd(), 'assets', 'maps', 'world_map.png');
    if (existsSync(imagePath)) {
      baseImage = await loadImage(imagePath);
      console.log('[MapCanvas] Loaded base world map image.');
    } else {
      console.warn('[MapCanvas] Base image file not found at:', imagePath);
    }

    const configPath = join(process.cwd(), 'data', 'mapConfig.json');
    if (existsSync(configPath)) {
      mapConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
      console.log(`[MapCanvas] Loaded map config with ${Object.keys(mapConfig?.locations || {}).length} locations.`);
    } else {
      console.warn('[MapCanvas] Map config file not found at:', configPath);
    }

    initialized = true;
  } catch (err) {
    console.error('[MapCanvas] Error during initialization:', err);
    throw err;
  }
}

// ── Cache Invalidation Helper ──

export function invalidateMapCache(playerId: string): void {
  const prefix = `${playerId}_`;
  for (const [key] of renderCache) {
    if (key.startsWith(prefix)) {
      renderCache.delete(key);
    }
  }
}

// ── Main Render Function ──

export async function renderMapImage(
  playerZoneId: string,
  discoveredLocationIds: string[],
  playerId: string
): Promise<Buffer | null> {
  try {
    if (!initialized) {
      await initMapAssets();
    }

    if (!baseImage || !mapConfig) {
      console.warn('[MapCanvas] Assets not fully loaded. Falling back to ASCII map.');
      return null;
    }

    // 1. Check cache
    const sortedDiscovered = [...discoveredLocationIds].sort().join(',');
    const cacheKey = `${playerId}_${playerZoneId}_${sortedDiscovered}`;
    const cached = renderCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.buffer;
    }

    // 2. Create Canvas
    const canvas = createCanvas(mapConfig.imageWidth, mapConfig.imageHeight);
    const ctx = canvas.getContext('2d');

    // 3. Draw Base Image
    ctx.drawImage(baseImage, 0, 0, mapConfig.imageWidth, mapConfig.imageHeight);

    // 4. Draw Connection Paths (only if both nodes are discovered)
    ctx.save();
    ctx.strokeStyle = mapConfig.pathColor;
    ctx.lineWidth = mapConfig.pathWidth;
    ctx.setLineDash(mapConfig.pathDashPattern || [8, 6]);

    for (const path of mapConfig.paths) {
      const fromLoc = mapConfig.locations[path.from];
      const toLoc = mapConfig.locations[path.to];

      if (!fromLoc || !toLoc || fromLoc.x === 0 || fromLoc.y === 0 || toLoc.x === 0 || toLoc.y === 0) {
        continue;
      }

      const bothDiscovered = discoveredLocationIds.includes(path.from) && discoveredLocationIds.includes(path.to);
      if (bothDiscovered) {
        ctx.beginPath();
        ctx.moveTo(Math.round(fromLoc.x), Math.round(fromLoc.y));
        ctx.lineTo(Math.round(toLoc.x), Math.round(toLoc.y));
        ctx.stroke();
      }
    }
    ctx.restore();

    // 5. Draw Fog-of-War for undiscovered locations
    ctx.save();
    ctx.fillStyle = mapConfig.fogColor || 'rgba(0, 0, 0, 0.7)';
    for (const [locId, locConfig] of Object.entries(mapConfig.locations)) {
      if (locConfig.x === 0 && locConfig.y === 0) continue;

      const isDiscovered = discoveredLocationIds.includes(locId);
      if (!isDiscovered) {
        ctx.beginPath();
        ctx.arc(Math.round(locConfig.x), Math.round(locConfig.y), Math.round(locConfig.fogRadius), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // 6. Draw Markers (only if discovered)
    for (const [locId, locConfig] of Object.entries(mapConfig.locations)) {
      if (locConfig.x === 0 && locConfig.y === 0) continue;

      const isDiscovered = discoveredLocationIds.includes(locId);
      if (isDiscovered) {
        ctx.save();
        const rx = Math.round(locConfig.x);
        const ry = Math.round(locConfig.y);
        ctx.beginPath();
        ctx.arc(rx, ry, mapConfig.markerSize / 2, 0, Math.PI * 2);

        if (locConfig.type === 'settlement') {
          ctx.fillStyle = '#10B981'; // Emerald
        } else if (locConfig.type === 'wilderness') {
          ctx.fillStyle = '#06B6D4'; // Cyan
        } else {
          ctx.fillStyle = '#EF4444'; // Red
        }

        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Inner dot/symbol representation
        ctx.beginPath();
        if (locConfig.type === 'settlement') {
          ctx.arc(rx, ry, 3, 0, Math.PI * 2);
          ctx.fillStyle = '#FFFFFF';
          ctx.fill();
        } else if (locConfig.type === 'wilderness') {
          // Draw small crossed lines
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1;
          ctx.moveTo(rx - 3, ry - 3);
          ctx.lineTo(rx + 3, ry + 3);
          ctx.moveTo(rx + 3, ry - 3);
          ctx.lineTo(rx - 3, ry + 3);
          ctx.stroke();
        } else {
          // Dungeon - small white square center
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(rx - 2, ry - 2, 4, 4);
        }
        ctx.restore();
      }
    }

    // 7. Draw Labels (only if discovered)
    ctx.save();
    ctx.font = mapConfig.labelFont || "10px 'Press Start 2P', sans-serif";
    ctx.textAlign = 'center';

    for (const [locId, locConfig] of Object.entries(mapConfig.locations)) {
      if (locConfig.x === 0 && locConfig.y === 0) continue;

      const isDiscovered = discoveredLocationIds.includes(locId);
      if (isDiscovered) {
        const zone = zonesCatalog.find((z) => z.id === locId);
        const displayName = zone?.name || locId;

        const labelX = Math.round(locConfig.x + locConfig.labelOffset.x);
        const labelY = Math.round(locConfig.y + locConfig.labelOffset.y);

        // Shadow
        ctx.fillStyle = mapConfig.labelShadowColor || '#000000';
        ctx.fillText(displayName, labelX + 1, labelY + 1);

        // Foreground
        ctx.fillStyle = mapConfig.labelColor || '#FFFFFF';
        ctx.fillText(displayName, labelX, labelY);
      }
    }
    ctx.restore();

    // 8. Draw Player Marker
    const playerLoc = mapConfig.locations[playerZoneId];
    if (playerLoc && playerLoc.x !== 0 && playerLoc.y !== 0) {
      ctx.save();
      const px = Math.round(playerLoc.x);
      const py = Math.round(playerLoc.y);
      // Outer pulse ring
      ctx.beginPath();
      ctx.arc(px, py, mapConfig.playerMarkerSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(251, 191, 36, 0.4)';
      ctx.fill();
      ctx.strokeStyle = '#FBBF24'; // Amber-400 gold
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Inner center pulse point
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.restore();
    }

    // 9. Encode to PNG
    const buffer = await canvas.encode('png');

    // 10. Cache and return
    if (renderCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = [...renderCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0]?.[0];
      if (oldestKey) renderCache.delete(oldestKey);
    }

    renderCache.set(cacheKey, { buffer, timestamp: Date.now() });
    return buffer;

  } catch (err) {
    console.error('[MapCanvas] Failed to render map image:', err);
    return null;
  }
}
