import { describe, it, expect } from 'vitest';
import { classesCatalog, getClassById, zonesCatalog } from '../src/utils/catalog.js';
import { applyClassModifiers, getClassModifiers } from '../src/systems/classes.js';
import { SKILLS } from '../src/systems/combat/skills.js';

describe('Classes Definition & Loading', () => {
  it('should load all five classes (warrior, mage, rogue, ranger, healer) from data/classes/', () => {
    expect(classesCatalog.length).toBe(5);
    const ids = classesCatalog.map(c => c.id).sort();
    expect(ids).toEqual(['healer', 'mage', 'ranger', 'rogue', 'warrior']);
  });

  it('should retrieve a class definition by ID', () => {
    const warrior = getClassById('warrior');
    expect(warrior).toBeDefined();
    expect(warrior.name).toBe('Warrior');
    expect(warrior.statModifiers.hpMax).toBe(0.20);
  });

  it('should correctly apply class modifiers to base stats', () => {
    const baseStats = {
      hpMax: 100,
      manaMax: 50,
      attack: 20,
      defense: 20,
      critChance: 5,
      critDmg: 150,
      speed: 10,
      luck: 5
    };

    const warriorStats = applyClassModifiers(baseStats, 'warrior');
    // Warrior hpMax modifier: +20% -> 120
    // Warrior manaMax modifier: -10% -> 45
    // Warrior attack modifier: +15% -> 23
    // Warrior defense modifier: +10% -> 22
    expect(warriorStats.hpMax).toBe(120);
    expect(warriorStats.manaMax).toBe(45);
    expect(warriorStats.attack).toBe(23);
    expect(warriorStats.defense).toBe(22);
  });
});

describe('Starter Skills Selection', () => {
  it('should have basic attack skill defined in SKILLS', () => {
    const basicAttack = SKILLS.find(s => s.id === 'skill_basic_attack');
    expect(basicAttack).toBeDefined();
    expect(basicAttack?.name).toBe('Basic Attack');
    expect(basicAttack?.class).toBe('all');
  });

  it('should map each starting class to their respective starter skill', () => {
    const classStarterSkills: Record<string, string> = {
      warrior: 'warrior_power_strike',
      mage: 'mage_fireball',
      rogue: 'rogue_backstab',
      ranger: 'ranger_quick_shot',
      healer: 'healer_holy_light'
    };

    for (const [className, skillId] of Object.entries(classStarterSkills)) {
      const skillDef = SKILLS.find(s => s.id === skillId);
      expect(skillDef).toBeDefined();
      expect(skillDef?.class).toBe(className);
    }
  });
});

describe('Locations & Regions Mapping', () => {
  // Using top-level import for zonesCatalog

  it('should load all locations and dungeons from data/locations/', () => {
    // 5 normal locations + 4 dungeons = 9 locations in total
    expect(zonesCatalog.length).toBe(9);
  });

  it('should correctly mark dungeons and locations', () => {
    const dungeons = zonesCatalog.filter(z => z.isDungeon === true);
    const locations = zonesCatalog.filter(z => !z.isDungeon);

    expect(dungeons.length).toBe(4);
    expect(locations.length).toBe(5);

    const dungeonIds = dungeons.map(d => d.id).sort();
    expect(dungeonIds).toEqual(['ancient_mine', 'goblin_sanctuary', 'lava_keep', 'sunken_temple']);
  });

  it('should assign a valid region to every location', () => {
    const validRegions = [
      'The Whispering Wilds',
      'The Subterranean Core',
      'The Infernal Peaks',
      'The Sunken Abysses'
    ];

    for (const loc of zonesCatalog) {
      expect(loc.region).toBeDefined();
      expect(validRegions).toContain(loc.region);
    }
  });
});

