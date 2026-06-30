import { describe, it, expect } from 'vitest';
import { STORY_QUEST_ORDER } from '../src/systems/progression/questSystem.js';
import { questsCatalog } from '../src/utils/catalog.js';

describe('Story Quest Progression Alignment', () => {
  it('should contain exactly 35 story/tutorial quests', () => {
    expect(STORY_QUEST_ORDER.length).toBe(35);
  });

  it('should map every quest ID in STORY_QUEST_ORDER to a valid catalog definition', () => {
    for (const questId of STORY_QUEST_ORDER) {
      const def = questsCatalog.find((q) => q.id === questId);
      expect(def).toBeDefined();
      expect(def?.type).toBe('story');
    }
  });

  it('should have non-decreasing level requirements', () => {
    let lastLevelReq = 1;
    STORY_QUEST_ORDER.forEach((questId) => {
      const def = questsCatalog.find((q) => q.id === questId);
      expect(def?.levelReq).toBeGreaterThanOrEqual(lastLevelReq);
      lastLevelReq = def?.levelReq || lastLevelReq;
    });
  });
});
