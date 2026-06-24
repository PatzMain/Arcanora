import { describe, it, expect, beforeEach } from 'vitest';
import { itemsRegistry, itemsCatalog, getItemById, achievementsRegistry } from '../src/utils/catalog.js';
import { itemBehaviorRegistry } from '../src/systems/items/itemBehavior.js';
import { skillsRegistry, skillBehaviorRegistry, executeSkill } from '../src/systems/combat/skills.js';
import { achievementEvaluatorRegistry, checkAchievements, getAchievementProgress } from '../src/systems/achievements.js';
import { shopRegistry } from '../src/economy/shopRegistry.js';
import { getShopItems, getItemBuyPrice, getItemSellPrice } from '../src/economy/shop.js';

describe('Modularity Registries', () => {
  beforeEach(() => {
    // Clear dynamic/custom registrations before each test to prevent leaking state
    itemBehaviorRegistry.clear();
    skillBehaviorRegistry.clear();
    shopRegistry.clear();
  });

  describe('Item Catalog Registry & Proxies', () => {
    it('should register a custom item dynamically and make it visible in catalog', () => {
      const customItem = {
        id: 'item_test_crystal',
        name: 'Glow Crystal',
        description: 'Test crystal.',
        type: 'material',
        rarity: 'rare',
        buyPrice: 50,
        sellPrice: 20,
        levelReq: 1,
      };

      itemsRegistry.register(customItem.id, customItem);

      // Verify direct retrieval from catalog/helpers
      expect(getItemById('item_test_crystal')).toBeDefined();
      expect(getItemById('item_test_crystal')?.name).toBe('Glow Crystal');

      // Verify array proxy behavior (e.g. find, length, etc.)
      const found = itemsCatalog.find((i) => i.id === 'item_test_crystal');
      expect(found).toBeDefined();
      expect(found?.buyPrice).toBe(50);

      // Cleanup
      itemsRegistry.unregister('item_test_crystal');
    });

    it('should invoke registered custom item behaviors', async () => {
      let behaviorInvoked = false;
      const customItemId = 'potion_health_small'; // override default small hp potion behavior

      itemBehaviorRegistry.register(customItemId, {
        onUse: async (context) => {
          behaviorInvoked = true;
          context.state.playerHp = context.state.playerMaxHp; // heal to full
          return { success: true, log: 'Used custom potion' };
        },
      });

      // Verify custom behavior exists in registry
      const customBehavior = itemBehaviorRegistry.get(customItemId);
      expect(customBehavior).toBeDefined();

      // Trigger behavior manually (simulating combat/handler.ts execution)
      const mockState = {
        playerHp: 10,
        playerMaxHp: 100,
        playerMana: 50,
        playerMaxMana: 50,
        playerBuffs: [],
        combatLog: [],
      };

      const res = await customBehavior!.onUse({
        playerId: 'p1',
        state: mockState,
        itemDef: { id: customItemId },
        dbItem: { itemId: customItemId },
      });

      expect(res.success).toBe(true);
      expect(behaviorInvoked).toBe(true);
      expect(mockState.playerHp).toBe(100);
    });
  });

  describe('Skills Behavior Registry', () => {
    it('should execute custom skill behavior from the registry', () => {
      const skillDef = {
        id: 'warrior_test_bash',
        name: 'Test Bash',
        description: 'Deals 999 damage.',
        class: 'warrior' as const,
        manaCost: 10,
        cooldown: 3,
        levelReq: 1,
        effects: [],
      };

      skillsRegistry.register(skillDef.id, skillDef);

      skillBehaviorRegistry.register('warrior_test_bash', {
        execute: (skill, casterStats, targetStats) => {
          return {
            damage: 999,
            healing: 0,
            effects: [],
            description: 'Deals massive 999 damage!',
          };
        },
      });

      const result = executeSkill(skillDef, {} as any, {} as any);
      expect(result.damage).toBe(999);
      expect(result.description).toContain('999 damage');

      // Cleanup
      skillsRegistry.unregister('warrior_test_bash');
    });
  });

  describe('Achievement Evaluators Registry', () => {
    it('should support dynamic custom achievement conditions', () => {
      achievementEvaluatorRegistry.register('custom_stat_reach', {
        evaluate: (pd: any, val) => pd.level * 2 >= val,
        getCurrentValue: (pd: any) => pd.level * 2,
      });

      const dummyAchievement = {
        id: 'ach_custom_level',
        name: 'Double Level Achievement',
        description: 'Level times two reach threshold.',
        condition: {
          type: 'custom_stat_reach',
          value: 10,
        },
        rewards: {},
        hidden: false,
      };

      // Player level is 5 => 5 * 2 = 10 (achievement met)
      const pdMet = { level: 5, totalKills: 0, gold: 0, totalQuestsCompleted: 0, prestige: 0, hasGuild: false };
      const pdNotMet = { level: 4, totalKills: 0, gold: 0, totalQuestsCompleted: 0, prestige: 0, hasGuild: false };

      // Register achievement to catalog registry
      achievementsRegistry.register(dummyAchievement.id, dummyAchievement);

      const unlockedMet = checkAchievements(pdMet, []);
      expect(unlockedMet.find((a) => a.id === 'ach_custom_level')).toBeDefined();

      const unlockedNotMet = checkAchievements(pdNotMet, []);
      expect(unlockedNotMet.find((a) => a.id === 'ach_custom_level')).toBeUndefined();

      const progress = getAchievementProgress(dummyAchievement, pdMet);
      expect(progress.current).toBe(10);
      expect(progress.percentage).toBe(100);

      // Cleanup
      achievementsRegistry.unregister(dummyAchievement.id);
      achievementEvaluatorRegistry.unregister('custom_stat_reach');
    });
  });

  describe('Shop Registry & Overrides', () => {
    it('should override pricing and availability using shopRegistry', () => {
      const listing = {
        itemId: 'potion_health_small',
        buyPrice: 99,
        sellPrice: 33,
        levelReq: 2,
      };

      shopRegistry.register(listing.itemId, listing);

      // Verify price overrides are queried correctly
      expect(getItemBuyPrice('potion_health_small')).toBe(99);
      expect(getItemSellPrice('potion_health_small')).toBe(33);

      // Verify browsing respects overrides
      const shopItems = getShopItems(5, 1, 10);
      const matched = shopItems.items.find((i) => i.id === 'potion_health_small');
      expect(matched).toBeDefined();
      expect(matched?.buyPrice).toBe(99);
      expect(matched?.sellPrice).toBe(33);
      expect(matched?.levelReq).toBe(2);
    });

    it('should respect custom conditional listings', () => {
      const listing = {
        itemId: 'potion_health_small',
        buyPrice: 10,
        condition: (playerId: string) => playerId === 'vip_member',
      };

      shopRegistry.register(listing.itemId, listing);

      // VIP player should see price 10
      expect(getItemBuyPrice('potion_health_small', 'vip_member')).toBe(10);

      // Normal player should see catalog default price (which is 20)
      expect(getItemBuyPrice('potion_health_small', 'regular_member')).toBe(20);
    });
  });
});
