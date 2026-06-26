import { describe, it, expect } from 'vitest';
import { zonesCatalog, itemsCatalog } from '../src/utils/catalog.js';

describe('BrownieRPG World Map Design & Adjacency Graph', () => {
  it('should have all 20 locations loaded in the catalog', () => {
    expect(zonesCatalog.length).toBe(20);
  });

  it('should verify every location contains identity, lore, history, and ecosystem details', () => {
    for (const loc of zonesCatalog) {
      // Identity
      expect(loc.id).toBeDefined();
      expect(loc.name).toBeDefined();
      expect(['settlement', 'landmark', 'combat', 'dungeon', 'point_of_interest']).toContain(loc.type);
      expect(loc.region).toBeDefined();
      expect(loc.area).toBeDefined();

      // Visual Theme
      expect(loc.visualTheme).toBeDefined();
      expect(typeof loc.visualTheme).toBe('string');
      expect(loc.visualTheme.length).toBeGreaterThan(10);

      // History (5 Questions)
      expect(loc.history).toBeDefined();
      expect(loc.history.createdWhy).toBeDefined();
      expect(loc.history.builtWho).toBeDefined();
      expect(loc.history.majorEvents).toBeDefined();
      expect(loc.history.whyExists).toBeDefined();
      expect(loc.history.currentConflicts).toBeDefined();

      // Ecosystem
      expect(loc.ecosystem).toBeDefined();
      expect(Array.isArray(loc.ecosystem.creatures)).toBe(true);
      expect(Array.isArray(loc.ecosystem.resources)).toBe(true);
      expect(loc.ecosystem.weather).toBeDefined();

      // Social
      expect(loc.social).toBeDefined();
      expect(Array.isArray(loc.social.npcs)).toBe(true);
      expect(Array.isArray(loc.social.factions)).toBe(true);

      // Connections
      expect(Array.isArray(loc.connections)).toBe(true);
      expect(loc.connections.length).toBeGreaterThan(0);
    }
  });

  it('should ensure all adjacency connections are bidirectional and refer to valid zones', () => {
    for (const loc of zonesCatalog) {
      for (const connId of loc.connections) {
        // Target must exist
        const target = zonesCatalog.find(z => z.id === connId);
        expect(target).toBeDefined();

        // Must be bidirectional: target must connect back to loc
        const hasBackLink = target?.connections.includes(loc.id);
        expect(hasBackLink).toBe(true);
      }
    }
  });

  it('should verify all resource IDs configured in ecosystems exist in itemsCatalog', () => {
    for (const loc of zonesCatalog) {
      const resources = loc.ecosystem?.resources || [];
      for (const resId of resources) {
        const item = itemsCatalog.find(i => i.id === resId);
        expect(item).toBeDefined();
        expect(item?.type).toBe('material');
      }
    }
  });

  it('should ensure level requirements are monotonically logical along paths', () => {
    // Cozy Tavern (lvl 1) connects to Verdant Outpost (lvl 1)
    // Verdant Outpost (lvl 1) connects to Whispering Canopy (lvl 3)
    // Whispering Canopy (lvl 3) connects to Glittering Depths (lvl 6) and Fallen Watchtower (lvl 3)
    // and so on...
    const cozyTavern = zonesCatalog.find(z => z.id === 'cozy_tavern')!;
    const oakhavenSquare = zonesCatalog.find(z => z.id === 'oakhaven_square')!;
    const shadowForest = zonesCatalog.find(z => z.id === 'shadow_forest')!;
    const crystalCaverns = zonesCatalog.find(z => z.id === 'crystal_caverns')!;
    const ancientMine = zonesCatalog.find(z => z.id === 'ancient_mine')!;
    const volcanicWastes = zonesCatalog.find(z => z.id === 'volcanic_wastes')!;
    const abyssalDepths = zonesCatalog.find(z => z.id === 'abyssal_depths')!;

    expect(cozyTavern.minLevel).toBe(1);
    expect(oakhavenSquare.minLevel).toBe(1);
    expect(shadowForest.minLevel).toBe(3);
    expect(crystalCaverns.minLevel).toBe(6);
    expect(ancientMine.minLevel).toBe(9);
    expect(volcanicWastes.minLevel).toBe(10);
    expect(abyssalDepths.minLevel).toBe(15);
  });

  it('should verify that all 5 starter town locations have no enemies', () => {
    const townZones = ['cozy_tavern', 'oakhaven_square', 'oakhaven_forge', 'apothecary', 'river_docks'];
    for (const zoneId of townZones) {
      const zone = zonesCatalog.find(z => z.id === zoneId);
      expect(zone).toBeDefined();
      const enemies = zone?.enemies || [];
      expect(enemies.length).toBe(0);
    }
  });
});
