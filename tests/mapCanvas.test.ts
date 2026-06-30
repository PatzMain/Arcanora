import { describe, it, expect, beforeAll } from 'vitest';
import { initMapAssets, renderMapImage, invalidateMapCache } from '../src/utils/mapCanvas.js';

describe('Map Canvas Rendering Engine', () => {
  beforeAll(async () => {
    // Initialize assets before running tests
    await initMapAssets();
  });

  it('should render a valid PNG map image with buffer signature', async () => {
    const playerZoneId = 'cozy_tavern';
    const discoveredIds = ['cozy_tavern', 'oakhaven_square'];
    const playerId = 'test_user_123';

    const buffer = await renderMapImage(playerZoneId, discoveredIds, playerId);
    expect(buffer).not.toBeNull();
    expect(Buffer.isBuffer(buffer)).toBe(true);

    // PNG signature check: \x89PNG\r\n\x1a\n
    if (buffer) {
      expect(buffer[0]).toBe(0x89);
      expect(buffer[1]).toBe(0x50); // P
      expect(buffer[2]).toBe(0x4e); // N
      expect(buffer[3]).toBe(0x47); // G
    }
  });

  it('should utilize in-memory cache on subsequent requests', async () => {
    const playerZoneId = 'oakhaven_square';
    const discoveredIds = ['cozy_tavern', 'oakhaven_square', 'river_docks'];
    const playerId = 'test_user_cache';

    const firstBuffer = await renderMapImage(playerZoneId, discoveredIds, playerId);
    const secondBuffer = await renderMapImage(playerZoneId, discoveredIds, playerId);

    expect(firstBuffer).not.toBeNull();
    expect(secondBuffer).not.toBeNull();
    // Cache hits should return the exact same Buffer instance/contents
    expect(firstBuffer).toBe(secondBuffer);
  });

  it('should invalidate cache when invalidateMapCache is called', async () => {
    const playerZoneId = 'river_docks';
    const discoveredIds = ['cozy_tavern', 'oakhaven_square', 'river_docks'];
    const playerId = 'test_user_invalidate';

    const firstBuffer = await renderMapImage(playerZoneId, discoveredIds, playerId);
    invalidateMapCache(playerId);
    const secondBuffer = await renderMapImage(playerZoneId, discoveredIds, playerId);

    expect(firstBuffer).not.toBeNull();
    expect(secondBuffer).not.toBeNull();
    // Since cache was invalidated, it should render a fresh buffer (different reference)
    expect(firstBuffer).not.toBe(secondBuffer);
  });
});
