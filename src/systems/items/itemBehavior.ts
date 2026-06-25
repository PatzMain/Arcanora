import { Registry } from '../../utils/registry.js';
import { replenishPlayerStamina } from '../../database/queries/player.js';

export interface ItemUseContext {
  playerId: string;
  state: {
    playerHp: number;
    playerMaxHp: number;
    playerMana: number;
    playerMaxMana: number;
    playerBuffs: any[];
    combatLog: string[];
  };
  itemDef: any;
  dbItem: any;
}

export interface ItemBehavior {
  onUse(context: ItemUseContext): Promise<{ success: boolean; log?: string }>;
}

export const itemBehaviorRegistry = new Registry<ItemBehavior>();

// Helper to create stamina potion behaviors
function createStaminaPotionBehavior(amount: number): ItemBehavior {
  return {
    async onUse(context) {
      try {
        const updated = await replenishPlayerStamina(context.playerId, amount);
        if (!updated) {
          return { success: false, log: 'Player not found.' };
        }
        return {
          success: true,
          log: `Restored ${amount} Stamina! (${updated.stamina}/${updated.staminaMax})`
        };
      } catch (error: any) {
        return { success: false, log: error.message || 'Failed to restore stamina' };
      }
    }
  };
}

// Register stamina behaviors
itemBehaviorRegistry.register('potion_stamina_small', createStaminaPotionBehavior(30));
itemBehaviorRegistry.register('potion_stamina_medium', createStaminaPotionBehavior(60));
itemBehaviorRegistry.register('potion_stamina_large', createStaminaPotionBehavior(100));

