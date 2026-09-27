import React, { useState } from 'react';
import { useGame, PlayerEquipmentSlots } from '../../context/GameContext';
import { RarityBadge } from '../common/RarityBadge';
import {
  WeaponSwordIcon,
  ShieldIcon,
  HelmetIcon,
  ArmorPlateIcon,
  BootsIcon,
  AccessoryRingIcon,
  PotionRedIcon,
  PotionBlueIcon,
  PotionGreenIcon
} from '../common/SvgIcons';

export const InventoryView: React.FC = () => {
  const { player, equipItem, unequipItem, usePotion } = useGame();
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const equipmentSlots: Array<{ key: keyof PlayerEquipmentSlots; label: string; icon: React.ReactNode }> = [
    { key: 'helm', label: 'Helmet', icon: <HelmetIcon className="w-5 h-5 text-indigo-400" /> },
    { key: 'armor', label: 'Cuirass', icon: <ArmorPlateIcon className="w-5 h-5 text-slate-300" /> },
    { key: 'weapon', label: 'Mainhand', icon: <WeaponSwordIcon className="w-5 h-5 text-rose-400" /> },
    { key: 'shield', label: 'Offhand', icon: <ShieldIcon className="w-5 h-5 text-blue-400" /> },
    { key: 'boots', label: 'Boots', icon: <BootsIcon className="w-5 h-5 text-amber-500" /> },
    { key: 'accessory1', label: 'Ring', icon: <AccessoryRingIcon className="w-5 h-5 text-amber-300" /> }
  ];

  const getItemIcon = (item: any) => {
    if (!item) return null;
    const type = item.type || item.itemDef?.type;
    const id = item.id || item.itemId;

    if (id?.includes('health')) return <PotionRedIcon className="w-6 h-6" />;
    if (id?.includes('mana')) return <PotionBlueIcon className="w-6 h-6" />;
    if (id?.includes('stamina')) return <PotionGreenIcon className="w-6 h-6" />;
    if (type === 'weapon') return <WeaponSwordIcon className="w-6 h-6" />;
    if (type === 'shield') return <ShieldIcon className="w-6 h-6" />;
    if (type === 'armor') return <ArmorPlateIcon className="w-6 h-6" />;
    if (type === 'helmet') return <HelmetIcon className="w-6 h-6" />;
    if (type === 'boots') return <BootsIcon className="w-6 h-6" />;
    return <AccessoryRingIcon className="w-6 h-6" />;
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 w-full">
      {/* Left: Paperdoll & Stats Column */}
      <div className="w-full lg:w-96 flex flex-col gap-4 shrink-0">
        {/* Paperdoll Slots */}
        <div className="rpg-panel rounded-xl p-4 shadow-xl border border-obsidian-700/70">
          <h3 className="font-fantasy font-bold text-sm text-slate-200 uppercase tracking-wider pb-2 border-b border-obsidian-700/60 mb-3">
            Equipment Paperdoll
          </h3>

          <div className="grid grid-cols-2 gap-2.5">
            {equipmentSlots.map(({ key, label, icon }) => {
              const item = player.equipment[key];
              return (
                <div
                  key={key}
                  onClick={() => item && setSelectedItem(item)}
                  className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                    item
                      ? 'bg-obsidian-900/90 border-slate-700 hover:border-amber-400'
                      : 'bg-obsidian-950/60 border-dashed border-obsidian-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded bg-obsidian-950/80 border border-obsidian-800">
                      {getItemIcon(item) || icon}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-fantasy font-semibold text-[10px] text-slate-400 uppercase">
                        {label}
                      </span>
                      <span className="text-xs font-fantasy font-bold text-slate-100 truncate max-w-[90px]">
                        {item ? item.name : 'Empty'}
                      </span>
                    </div>
                  </div>

                  {item && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        unequipItem(key);
                      }}
                      className="text-[10px] font-pixel text-slate-500 hover:text-rose-400 p-1"
                      title="Unequip"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Computed Stats Card */}
        <div className="rpg-panel rounded-xl p-4 shadow-xl border border-obsidian-700/70">
          <h3 className="font-fantasy font-bold text-sm text-slate-200 uppercase tracking-wider pb-2 border-b border-obsidian-700/60 mb-3">
            Computed Hero Attributes
          </h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-obsidian-900/70 p-2 rounded border border-obsidian-800 flex justify-between">
              <span className="text-slate-400">⚔️ Attack:</span>
              <span className="font-mono font-bold text-rose-300">{player.attack}</span>
            </div>
            <div className="bg-obsidian-900/70 p-2 rounded border border-obsidian-800 flex justify-between">
              <span className="text-slate-400">🛡️ Defense:</span>
              <span className="font-mono font-bold text-blue-300">{player.defense}</span>
            </div>
            <div className="bg-obsidian-900/70 p-2 rounded border border-obsidian-800 flex justify-between">
              <span className="text-slate-400">⚡ Speed:</span>
              <span className="font-mono font-bold text-amber-300">{player.speed}</span>
            </div>
            <div className="bg-obsidian-900/70 p-2 rounded border border-obsidian-800 flex justify-between">
              <span className="text-slate-400">💥 Crit Rate:</span>
              <span className="font-mono font-bold text-yellow-300">{player.critChance}%</span>
            </div>
            <div className="bg-obsidian-900/70 p-2 rounded border border-obsidian-800 flex justify-between">
              <span className="text-slate-400">✨ Crit Dmg:</span>
              <span className="font-mono font-bold text-fuchsia-300">{player.critDmg}%</span>
            </div>
            <div className="bg-obsidian-900/70 p-2 rounded border border-obsidian-800 flex justify-between">
              <span className="text-slate-400">🍀 Luck:</span>
              <span className="font-mono font-bold text-emerald-300">{player.luck}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Backpack Grid & Item Inspector */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="rpg-panel rounded-xl p-4 shadow-xl border border-obsidian-700/70 flex-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-obsidian-700/60">
              <h3 className="font-fantasy font-bold text-sm text-slate-200 uppercase tracking-wider">
                Adventurer's Satchel ({player.inventory.length} / 24 Slots)
              </h3>
            </div>

            {/* 24-Slot Grid */}
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
              {player.inventory.map((invItem) => {
                const item = invItem.itemDef || {};
                const isSelected = selectedItem?.id === item.id;
                return (
                  <div
                    key={invItem.id}
                    onClick={() => setSelectedItem({ ...item, invId: invItem.id, quantity: invItem.quantity })}
                    className={`aspect-square rounded-xl p-2 flex flex-col items-center justify-between cursor-pointer border transition-all rpg-btn relative ${
                      isSelected
                        ? 'border-amber-400 bg-amber-950/40 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                        : 'bg-obsidian-900/90 border-obsidian-700/80 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex-1 flex items-center justify-center">
                      {getItemIcon(item)}
                    </div>
                    <span className="text-[10px] font-fantasy font-semibold text-slate-200 text-center truncate w-full">
                      {item.name || invItem.itemId}
                    </span>
                    {invItem.quantity > 1 && (
                      <span className="absolute top-1 right-1 font-mono text-[9px] bg-obsidian-950/90 px-1 rounded text-amber-300 font-bold border border-obsidian-700">
                        x{invItem.quantity}
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Empty placeholder slots up to 18 */}
              {Array.from({ length: Math.max(0, 18 - player.inventory.length) }).map((_, i) => (
                <div
                  key={`empty_${i}`}
                  className="aspect-square rounded-xl border border-dashed border-obsidian-800/60 bg-obsidian-950/30 flex items-center justify-center opacity-30"
                />
              ))}
            </div>
          </div>

          {/* Selected Item Inspector Panel */}
          {selectedItem && (
            <div className="mt-4 pt-3 border-t border-obsidian-700/60 bg-obsidian-950/80 p-3 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-obsidian-900 border border-slate-700">
                  {getItemIcon(selectedItem)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-fantasy font-bold text-sm text-slate-100">
                      {selectedItem.name}
                    </h4>
                    <RarityBadge rarity={selectedItem.rarity || 'common'} />
                  </div>
                  <p className="text-xs text-slate-400 italic">
                    {selectedItem.description || 'A valuable gear piece or adventurer supply.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {selectedItem.type === 'consumable' ? (
                  <button
                    onClick={() => {
                      if (selectedItem.invId) usePotion(selectedItem.invId);
                      setSelectedItem(null);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-fantasy text-xs font-bold rpg-btn"
                  >
                    Quaff Potion
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      if (selectedItem.invId) equipItem(selectedItem.invId);
                      setSelectedItem(null);
                    }}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-obsidian-950 rounded-lg font-fantasy text-xs font-bold rpg-btn"
                  >
                    Equip Gear
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
