import React from 'react';
import { useGame, ScreenTab } from '../../context/GameContext';
import { VitalBar } from '../common/VitalBar';
import {
  HpHeartIcon,
  ManaOrbIcon,
  StaminaBoltIcon,
  ExpStarIcon,
  GoldCoinIcon,
  GemIcon,
  CompassIcon,
  SwordsCrossedIcon,
  TreasureChestIcon,
  BackpackIcon,
  WrenchDevIcon
} from '../common/SvgIcons';

export const HeaderHUD: React.FC = () => {
  const { player, activeTab, setActiveTab, isGodMode } = useGame();

  const navItems: Array<{ id: ScreenTab; label: string; icon: React.ReactNode }> = [
    { id: 'map', label: 'World Map', icon: <CompassIcon className="w-4 h-4 text-amber-400" /> },
    { id: 'combat', label: 'Battle Arena', icon: <SwordsCrossedIcon className="w-4 h-4 text-rose-400" /> },
    { id: 'dungeon', label: 'Dungeon Grid', icon: <TreasureChestIcon className="w-4 h-4 text-emerald-400" /> },
    { id: 'inventory', label: 'Inventory & Gear', icon: <BackpackIcon className="w-4 h-4 text-blue-400" /> },
    { id: 'sandbox', label: 'Dev Sandbox', icon: <WrenchDevIcon className="w-4 h-4 text-cyan-400" /> },
  ];

  return (
    <header className="sticky top-0 z-40 w-full rpg-panel border-b border-obsidian-700/80 px-3 py-2.5 backdrop-blur-md">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left: Player Profile Snippet */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-900 via-slate-800 to-obsidian-950 border border-amber-500/40 flex items-center justify-center font-fantasy font-black text-amber-300 text-lg shadow-md">
                {player.username.charAt(0)}
              </div>
              <span className="absolute -bottom-1 -right-1 bg-amber-500 text-obsidian-950 font-pixel text-[8px] font-bold px-1 py-0.5 rounded shadow">
                Lv.{player.level}
              </span>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-fantasy font-bold text-slate-100 text-sm tracking-wide">
                  {player.username}
                </span>
                {isGodMode && (
                  <span className="font-pixel text-[8px] bg-red-600 text-white px-1 rounded animate-pulse">
                    GOD
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-amber-400/90 font-medium font-fantasy text-[11px]">
                  {player.playerClass}
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400 text-[11px] truncate max-w-[120px]">
                  {player.currentZoneId.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          </div>

          {/* Currencies */}
          <div className="flex items-center gap-3 bg-obsidian-900/80 px-2.5 py-1 rounded-lg border border-obsidian-700/60 shadow-inner">
            <div className="flex items-center gap-1">
              <GoldCoinIcon className="w-4 h-4" />
              <span className="font-mono text-xs font-bold text-amber-300">
                {player.gold.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <GemIcon className="w-3.5 h-3.5" />
              <span className="font-mono text-xs font-bold text-fuchsia-300">
                {player.gems}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Vital Bars */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full md:max-w-xl">
          <VitalBar
            label="HP"
            current={player.hpCurrent}
            max={player.hpMax}
            color="hp"
            icon={<HpHeartIcon className="w-3.5 h-3.5 text-red-400" />}
          />
          <VitalBar
            label="Mana"
            current={player.manaCurrent}
            max={player.manaMax}
            color="mana"
            icon={<ManaOrbIcon className="w-3.5 h-3.5 text-cyan-400" />}
          />
          <VitalBar
            label="Stamina"
            current={player.stamina}
            max={player.staminaMax}
            color="stamina"
            icon={<StaminaBoltIcon className="w-3.5 h-3.5 text-amber-400" />}
          />
          <VitalBar
            label="Exp"
            current={player.exp}
            max={player.expToNext}
            color="exp"
            icon={<ExpStarIcon className="w-3.5 h-3.5 text-emerald-400" />}
          />
        </div>

        {/* Right: Screen Navigation Tabs */}
        <nav className="flex items-center gap-1 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-fantasy tracking-wider font-semibold transition-all whitespace-nowrap rpg-btn ${
                  isActive
                    ? 'bg-amber-500/20 text-amber-200 border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                    : 'bg-obsidian-900/60 text-slate-400 hover:text-slate-200 border-obsidian-700/50 hover:bg-obsidian-800'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
