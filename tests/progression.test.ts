import { describe, it, expect } from 'vitest';
import { STORY_QUEST_ORDER } from '../src/systems/progression/questSystem.js';
import { questsCatalog } from '../src/utils/catalog.js';

describe('Story Quest Progression Alignment', () => {
  it('should contain exactly 19 story quests to cover levels 1 to 20', () => {
    expect(STORY_QUEST_ORDER.length).toBe(19);
  });

  it('should map every quest ID in STORY_QUEST_ORDER to a valid catalog definition', () => {
    for (const questId of STORY_QUEST_ORDER) {
      const def = questsCatalog.find((q) => q.id === questId);
      expect(def).toBeDefined();
      expect(def?.type).toBe('story');
    }
  });

  it('should have correct levelReq and linear sequence', () => {
    // story_01_begin starts at level 1 and unlocks level 2
    // story_02_meadows_clear starts at level 2 and unlocks level 3, and so on...
    STORY_QUEST_ORDER.forEach((questId, idx) => {
      const def = questsCatalog.find((q) => q.id === questId);
      const expectedLevelReq = idx + 1;
      expect(def?.levelReq).toBe(expectedLevelReq);
    });
  });
});
