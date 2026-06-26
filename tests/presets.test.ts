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
    // 14 normal locations + 6 dungeons = 20 locations in total
    expect(zonesCatalog.length).toBe(20);
  });

  it('should correctly mark dungeons and locations', () => {
    const dungeons = zonesCatalog.filter(z => z.isDungeon === true);
    const locations = zonesCatalog.filter(z => !z.isDungeon);

    expect(dungeons.length).toBe(6);
    expect(locations.length).toBe(14);

    const dungeonIds = dungeons.map(d => d.id).sort();
    expect(dungeonIds).toEqual(['ancient_mine', 'forgotten_ironmine', 'goblin_sanctuary', 'lava_keep', 'oakhaven_sewers', 'sunken_temple']);
  });

  it('should assign a valid region to every location', () => {
    const validRegions = [
      'Kingdom of Eldoria',
      'Ashen Frontier'
    ];

    for (const loc of zonesCatalog) {
      expect(loc.region).toBeDefined();
      expect(validRegions).toContain(loc.region);
    }
  });
});

describe('Preset Combos Migration & Validation', () => {
  it('should correctly migrate old presets format (flat string array) to new combo format', async () => {
    const { migrateOldPresets } = await import('../src/systems/combat/presets.js');
    const oldPresets = ['attack', null, 'warrior_power_strike'];

    const migrated = migrateOldPresets(oldPresets);

    expect(migrated.length).toBe(3);
    expect(migrated[0]).toEqual({ name: 'Preset 1', actions: ['attack'] });
    expect(migrated[1]).toEqual({ name: 'Preset 2', actions: [] });
    expect(migrated[2]).toEqual({ name: 'Preset 3', actions: ['warrior_power_strike'] });
  });

  it('should correctly parse new presets format and fallback on invalid formats', async () => {
    const { parsePresets } = await import('../src/systems/combat/presets.js');

    // Valid new format
    const newFormat = [
      { name: 'My Combo', actions: ['attack', 'mage_fireball'] },
      { name: 'Preset 2', actions: [] },
      { name: 'Preset 3', actions: [] }
    ];
    const parsed = parsePresets(newFormat);
    expect(parsed[0].name).toBe('My Combo');
    expect(parsed[0].actions).toEqual(['attack', 'mage_fireball']);

    // Invalid format fallback
    const fallback = parsePresets(null);
    expect(fallback[0]).toEqual({ name: 'Preset 1', actions: ['attack'] });
  });

  it('should correctly validate combos based on player mana and learned skills', async () => {
    const { validateCombo } = await import('../src/systems/combat/presets.js');

    const slot = {
      name: 'Combo A',
      actions: ['attack', 'warrior_power_strike'] // warrior_power_strike costs 8 mana
    };

    // Valid case
    const validResult = validateCombo(slot, 10, ['warrior_power_strike']);
    expect(validResult.valid).toBe(true);
    expect(validResult.totalManaCost).toBe(8);

    // Insufficient mana case
    const lowManaResult = validateCombo(slot, 5, ['warrior_power_strike']);
    expect(lowManaResult.valid).toBe(false);
    expect(lowManaResult.error).toContain('Not enough Mana');

    // Unlearned skill case
    const unlearnedResult = validateCombo(slot, 20, []);
    expect(unlearnedResult.valid).toBe(false);
    expect(unlearnedResult.error).toContain('have not learned');
  });

  it('should handle preset name edge cases correctly during migration and parsing', async () => {
    const { parsePresets } = await import('../src/systems/combat/presets.js');

    // 1. Very long name should be truncated to 20 characters
    const longNamePresets = [
      { name: 'ThisIsAVeryLongPresetNameThatExceeds20Characters', actions: ['attack'] },
      { name: 'Preset 2', actions: [] },
      { name: 'Preset 3', actions: [] }
    ];
    const parsedLong = parsePresets(longNamePresets);
    expect(parsedLong[0].name).toBe('ThisIsAVeryLongPrese'); // 20 chars
    expect(parsedLong[0].name.length).toBe(20);

    // 2. Whitespace-only name should fall back to default slot name
    const whitespacePresets = [
      { name: '   ', actions: ['attack'] },
      { name: 'Preset 2', actions: [] },
      { name: 'Preset 3', actions: [] }
    ];
    const parsedWhitespace = parsePresets(whitespacePresets);
    expect(parsedWhitespace[0].name).toBe('Preset 1');

    // 3. Special characters should be preserved properly and truncated
    const specialPresets = [
      { name: '⚔️🛡️🔥 Rogue Preset ⚔️🛡️🔥', actions: ['attack'] },
      { name: 'Preset 2', actions: [] },
      { name: 'Preset 3', actions: [] }
    ];
    const parsedSpecial = parsePresets(specialPresets);
    expect(parsedSpecial[0].name.length).toBe(20);
    expect(parsedSpecial[0].name).toBe('⚔️🛡️🔥 Rogue Preset');
  });


  it('should guarantee deterministic alphabetical sorting of learned skills', () => {
    const learnedSkills = [
      { skillId: 'warrior_shield_wall' },
      { skillId: 'warrior_power_strike' },
      { skillId: 'healer_holy_light' }
    ];

    learnedSkills.sort((a, b) => a.skillId.localeCompare(b.skillId));

    expect(learnedSkills[0].skillId).toBe('healer_holy_light');
    expect(learnedSkills[1].skillId).toBe('warrior_power_strike');
    expect(learnedSkills[2].skillId).toBe('warrior_shield_wall');
  });
});


