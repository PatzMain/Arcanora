import { Registry } from '../utils/registry.js';

export interface ShopListing {
  itemId: string;
  buyPrice?: number;
  sellPrice?: number;
  levelReq?: number;
  condition?: (playerId: string) => boolean;
}

export const shopRegistry = new Registry<ShopListing>();
