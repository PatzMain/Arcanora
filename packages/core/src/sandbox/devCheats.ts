import { zonesCatalog } from '../catalog/index.js';

export interface CheatStateModifications {
  hpCurrent?: number;
  manaCurrent?: number;
  stamina?: number;
  gold?: number;
  gems?: number;
  level?: number;
  currentZoneId?: string;
  isGodMode?: boolean;
}

/**
 * Developer Sandbox Cheats for instant offline testing and demonstration.
 */
export const devCheats = {
  /**
   * Refills HP, Mana, and Stamina to maximum.
   */
  refillVitals(maxHp: number, maxMana: number, maxStamina: number = 100): CheatStateModifications {
    return {
      hpCurrent: maxHp,
      manaCurrent: maxMana,
      stamina: maxStamina
    };
  },

  /**
   * Grants substantial gold and gems for economy and shop testing.
   */
  grantWealth(currentGold: number, currentGems: number, addGold = 10000, addGems = 500): CheatStateModifications {
    return {
      gold: currentGold + addGold,
      gems: currentGems + addGems
    };
  },

  /**
   * Jumps the player to a target level.
   */
  jumpLevel(targetLevel: number): CheatStateModifications {
    return {
      level: Math.max(1, Math.min(100, targetLevel))
    };
  },

  /**
   * Teleports player instantly to any discovered or locked world zone.
   */
  teleport(zoneId: string): CheatStateModifications {
    const validZone = zonesCatalog.find(z => z.id === zoneId);
    return {
      currentZoneId: validZone ? validZone.id : 'oakhaven'
    };
  },

  /**
   * Toggles invulnerability / god mode.
   */
  toggleGodMode(currentGodMode: boolean): { isGodMode: boolean } {
    return {
      isGodMode: !currentGodMode
    };
  }
};
