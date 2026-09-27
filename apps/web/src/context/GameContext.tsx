import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  itemsCatalog,
  zonesCatalog,
  enemiesCatalog,
  classesCatalog,
  getItemById,
  getZoneById,
  getEnemyById
} from '@arcanora/core';
import {
  initDatabase,
  getDb
} from '@arcanora/database';
import { devCheats } from '@arcanora/core';

export interface PlayerEquipmentSlots {
  weapon?: any;
  shield?: any;
  helm?: any;
  armor?: any;
  boots?: any;
  accessory1?: any;
  accessory2?: any;
}

export interface InventoryItemEntry {
  id: string;
  itemId: string;
  quantity: number;
  itemDef?: any;
}

export interface PlayerData {
  id: string;
  username: string;
  playerClass: string;
  level: number;
  exp: number;
  expToNext: number;
  gold: number;
  gems: number;
  hpCurrent: number;
  hpMax: number;
  manaCurrent: number;
  manaMax: number;
  stamina: number;
  staminaMax: number;
  currentZoneId: string;
  attack: number;
  defense: number;
  speed: number;
  critChance: number;
  critDmg: number;
  luck: number;
  equipment: PlayerEquipmentSlots;
  inventory: InventoryItemEntry[];
  discoveredZones: string[];
}

export type ScreenTab = 'map' | 'combat' | 'dungeon' | 'inventory' | 'profile' | 'sandbox';

interface GameContextType {
  player: PlayerData;
  activeTab: ScreenTab;
  setActiveTab: (tab: ScreenTab) => void;
  isDbReady: boolean;
  travelToZone: (zoneId: string) => boolean;
  equipItem: (invId: string) => void;
  unequipItem: (slot: keyof PlayerEquipmentSlots) => void;
  usePotion: (invId: string) => void;
  refillVitals: () => void;
  grantWealth: (gold?: number, gems?: number) => void;
  jumpLevel: (level: number) => void;
  teleportZone: (zoneId: string) => void;
  toggleGodMode: () => void;
  isGodMode: boolean;
  setPlayer: React.Dispatch<React.SetStateAction<PlayerData>>;
}

const defaultPlayer: PlayerData = {
  id: 'local_hero_01',
  username: 'Aiden Swiftblade',
  playerClass: 'Warrior',
  level: 5,
  exp: 420,
  expToNext: 1000,
  gold: 1250,
  gems: 45,
  hpCurrent: 140,
  hpMax: 140,
  manaCurrent: 60,
  manaMax: 60,
  stamina: 85,
  staminaMax: 100,
  currentZoneId: 'oakhaven',
  attack: 32,
  defense: 18,
  speed: 15,
  critChance: 8.5,
  critDmg: 150,
  luck: 7,
  equipment: {
    weapon: itemsCatalog.find(i => i.id === 'iron_sword') || {
      id: 'iron_sword',
      name: 'Iron Broadsword',
      type: 'weapon',
      rarity: 'common',
      stats: { attack: 12 }
    },
    shield: itemsCatalog.find(i => i.id === 'wooden_shield') || {
      id: 'wooden_shield',
      name: 'Oak Kite Shield',
      type: 'shield',
      rarity: 'common',
      stats: { defense: 6 }
    },
    armor: itemsCatalog.find(i => i.id === 'iron_armor') || {
      id: 'iron_armor',
      name: 'Reinforced Hauberk',
      type: 'armor',
      rarity: 'uncommon',
      stats: { defense: 14, hpMax: 20 }
    },
  },
  inventory: [
    {
      id: 'inv_1',
      itemId: 'potion_health_small',
      quantity: 5,
      itemDef: itemsCatalog.find(i => i.id === 'potion_health_small') || {
        id: 'potion_health_small',
        name: 'Minor Health Flask',
        rarity: 'common',
        type: 'consumable',
        description: 'Restores 50 HP immediately.'
      }
    },
    {
      id: 'inv_2',
      itemId: 'potion_mana_small',
      quantity: 3,
      itemDef: itemsCatalog.find(i => i.id === 'potion_mana_small') || {
        id: 'potion_mana_small',
        name: 'Minor Mana Flask',
        rarity: 'common',
        type: 'consumable',
        description: 'Restores 30 Mana.'
      }
    },
    {
      id: 'inv_3',
      itemId: 'potion_stamina_small',
      quantity: 2,
      itemDef: itemsCatalog.find(i => i.id === 'potion_stamina_small') || {
        id: 'potion_stamina_small',
        name: 'Vigor Tonic',
        rarity: 'uncommon',
        type: 'consumable',
        description: 'Restores 40 Stamina.'
      }
    },
    {
      id: 'inv_4',
      itemId: 'steel_longsword',
      quantity: 1,
      itemDef: itemsCatalog.find(i => i.id === 'steel_longsword') || {
        id: 'steel_longsword',
        name: 'Forged Steel Longsword',
        rarity: 'rare',
        type: 'weapon',
        stats: { attack: 28, critChance: 5 },
        description: 'A finely tempered blade with keen edge.'
      }
    }
  ],
  discoveredZones: ['oakhaven', 'forgotten_ironmine', 'verdant_meadows', 'whispering_woods']
};

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [player, setPlayer] = useState<PlayerData>(() => {
    const saved = localStorage.getItem('arcanora_local_player');
    return saved ? JSON.parse(saved) : defaultPlayer;
  });

  const [activeTab, setActiveTab] = useState<ScreenTab>('map');
  const [isDbReady, setIsDbReady] = useState(false);
  const [isGodMode, setIsGodMode] = useState(false);

  // Initialize PGlite database
  useEffect(() => {
    let isMounted = true;
    initDatabase({ driver: 'pglite', autoMigrate: true })
      .then(() => {
        if (isMounted) setIsDbReady(true);
      })
      .catch((err) => {
        console.warn('PGlite async init fallback to in-memory store:', err);
        if (isMounted) setIsDbReady(true);
      });

    return () => { isMounted = false; };
  }, []);

  // Save player state to localStorage for instant local-first persistence
  useEffect(() => {
    try {
      localStorage.setItem('arcanora_local_player', JSON.stringify(player));
    } catch (e) {
      console.warn('Failed saving state to local storage:', e);
    }
  }, [player]);

  const travelToZone = useCallback((zoneId: string): boolean => {
    if (player.stamina < 15) {
      alert('Not enough Stamina! Rest at a campsite or drink a Vigor Tonic.');
      return false;
    }

    setPlayer(prev => {
      const discovered = prev.discoveredZones.includes(zoneId)
        ? prev.discoveredZones
        : [...prev.discoveredZones, zoneId];

      return {
        ...prev,
        currentZoneId: zoneId,
        stamina: Math.max(0, prev.stamina - 15),
        discoveredZones: discovered
      };
    });
    return true;
  }, [player.stamina]);

  const equipItem = useCallback((invId: string) => {
    setPlayer(prev => {
      const invItem = prev.inventory.find(i => i.id === invId);
      if (!invItem || !invItem.itemDef) return prev;

      const type = invItem.itemDef.type as string;
      const targetSlot: keyof PlayerEquipmentSlots = type === 'weapon' ? 'weapon'
        : type === 'shield' ? 'shield'
        : type === 'armor' ? 'armor'
        : (type === 'helmet' || type === 'helm') ? 'helm'
        : type === 'boots' ? 'boots'
        : 'accessory1';

      const oldEquip = prev.equipment[targetSlot];
      const updatedEquipment = { ...prev.equipment, [targetSlot]: invItem.itemDef };

      let updatedInventory = prev.inventory.filter(i => i.id !== invId);
      if (oldEquip) {
        updatedInventory.push({
          id: `inv_${Date.now()}`,
          itemId: oldEquip.id,
          quantity: 1,
          itemDef: oldEquip
        });
      }

      return {
        ...prev,
        equipment: updatedEquipment,
        inventory: updatedInventory,
        attack: prev.attack + (invItem.itemDef.stats?.attack || 0) - (oldEquip?.stats?.attack || 0),
        defense: prev.defense + (invItem.itemDef.stats?.defense || 0) - (oldEquip?.stats?.defense || 0),
      };
    });
  }, []);

  const unequipItem = useCallback((slot: keyof PlayerEquipmentSlots) => {
    setPlayer(prev => {
      const item = prev.equipment[slot];
      if (!item) return prev;

      const updatedEquipment = { ...prev.equipment };
      delete updatedEquipment[slot];

      const updatedInventory = [
        ...prev.inventory,
        {
          id: `inv_${Date.now()}`,
          itemId: item.id,
          quantity: 1,
          itemDef: item
        }
      ];

      return {
        ...prev,
        equipment: updatedEquipment,
        inventory: updatedInventory,
        attack: Math.max(5, prev.attack - (item.stats?.attack || 0)),
        defense: Math.max(5, prev.defense - (item.stats?.defense || 0))
      };
    });
  }, []);

  const usePotion = useCallback((invId: string) => {
    setPlayer(prev => {
      const item = prev.inventory.find(i => i.id === invId);
      if (!item) return prev;

      let newHp = prev.hpCurrent;
      let newMana = prev.manaCurrent;
      let newStamina = prev.stamina;

      if (item.itemId.includes('health')) {
        newHp = Math.min(prev.hpMax, prev.hpCurrent + 60);
      } else if (item.itemId.includes('mana')) {
        newMana = Math.min(prev.manaMax, prev.manaCurrent + 40);
      } else if (item.itemId.includes('stamina')) {
        newStamina = Math.min(prev.staminaMax, prev.stamina + 50);
      }

      const updatedInventory = prev.inventory.map(i => {
        if (i.id === invId) {
          return { ...i, quantity: i.quantity - 1 };
        }
        return i;
      }).filter(i => i.quantity > 0);

      return {
        ...prev,
        hpCurrent: newHp,
        manaCurrent: newMana,
        stamina: newStamina,
        inventory: updatedInventory
      };
    });
  }, []);

  // Sandbox Cheats
  const refillVitals = useCallback(() => {
    setPlayer(prev => ({
      ...prev,
      ...devCheats.refillVitals(prev.hpMax, prev.manaMax, prev.staminaMax)
    }));
  }, []);

  const grantWealth = useCallback((gold = 10000, gems = 500) => {
    setPlayer(prev => ({
      ...prev,
      ...devCheats.grantWealth(prev.gold, prev.gems, gold, gems)
    }));
  }, []);

  const jumpLevel = useCallback((level: number) => {
    setPlayer(prev => {
      const target = Math.max(1, level);
      return {
        ...prev,
        level: target,
        hpMax: 100 + target * 15,
        hpCurrent: 100 + target * 15,
        manaMax: 50 + target * 8,
        manaCurrent: 50 + target * 8,
        attack: 20 + target * 5,
        defense: 10 + target * 3
      };
    });
  }, []);

  const teleportZone = useCallback((zoneId: string) => {
    setPlayer(prev => ({
      ...prev,
      ...devCheats.teleport(zoneId),
      discoveredZones: prev.discoveredZones.includes(zoneId) ? prev.discoveredZones : [...prev.discoveredZones, zoneId]
    }));
  }, []);

  const toggleGodMode = useCallback(() => {
    setIsGodMode(prev => !prev);
  }, []);

  return (
    <GameContext.Provider value={{
      player,
      activeTab,
      setActiveTab,
      isDbReady,
      travelToZone,
      equipItem,
      unequipItem,
      usePotion,
      refillVitals,
      grantWealth,
      jumpLevel,
      teleportZone,
      toggleGodMode,
      isGodMode,
      setPlayer
    }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
