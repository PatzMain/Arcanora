import { Registry } from '../../utils/registry.js';

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
