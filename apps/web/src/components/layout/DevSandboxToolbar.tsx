import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { zonesCatalog } from '@arcanora/core';
import {
  WrenchDevIcon,
  HpHeartIcon,
  GoldCoinIcon,
  StaminaBoltIcon
} from '../common/SvgIcons';

export const DevSandboxToolbar: React.FC = () => {
  const {
    player,
    refillVitals,
    grantWealth,
    jumpLevel,
    teleportZone,
    toggleGodMode,
    isGodMode,
    isDbReady
  } = useGame();

  const [isOpen, setIsOpen] = useState(false);
  const [selectedTeleport, setSelectedTeleport] = useState('oakhaven');

  return (
    <div className="fixed bottom-3 right-3 z-50">
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="flex items-center gap-2 px-3 py-2 bg-obsidian-900/95 hover:bg-obsidian-800 text-cyan-300 border border-cyan-500/50 rounded-xl shadow-2xl backdrop-blur-md rpg-btn font-fantasy text-xs font-bold"
      >
        <WrenchDevIcon className="w-4 h-4 text-cyan-400" />
        <span>Dev Sandbox Cheats</span>
        {isOpen ? '▼' : '▲'}
      </button>

      {/* Expanded Sandbox Drawer */}
      {isOpen && (
        <div className="absolute bottom-12 right-0 w-80 sm:w-96 rpg-panel rounded-2xl p-4 border border-cyan-500/60 shadow-2xl backdrop-blur-xl flex flex-col gap-3 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-obsidian-700 pb-2">
            <div className="flex items-center gap-2">
              <WrenchDevIcon className="w-4 h-4 text-cyan-400" />
              <h4 className="font-fantasy font-bold text-sm text-cyan-300">
                Offline Sandbox Toolbar
              </h4>
            </div>
            <span className="font-pixel text-[8px] bg-emerald-950 text-emerald-300 border border-emerald-600 px-1.5 py-0.5 rounded">
              {isDbReady ? 'PGlite: WASM IDB' : 'PGlite: Init'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={refillVitals}
              className="py-2 px-2.5 bg-obsidian-900 hover:bg-obsidian-800 text-slate-100 rounded-lg border border-obsidian-700 flex items-center gap-1.5 rpg-btn font-fantasy"
            >
              <HpHeartIcon className="w-3.5 h-3.5 text-red-400" />
              <span>Full Refill</span>
            </button>

            <button
              onClick={() => grantWealth(10000, 500)}
              className="py-2 px-2.5 bg-obsidian-900 hover:bg-obsidian-800 text-slate-100 rounded-lg border border-obsidian-700 flex items-center gap-1.5 rpg-btn font-fantasy"
            >
              <GoldCoinIcon className="w-3.5 h-3.5 text-yellow-400" />
              <span>+10k Gold</span>
            </button>

            <button
              onClick={() => jumpLevel(player.level + 1)}
              className="py-2 px-2.5 bg-obsidian-900 hover:bg-obsidian-800 text-slate-100 rounded-lg border border-obsidian-700 flex items-center gap-1.5 rpg-btn font-fantasy"
            >
              <StaminaBoltIcon className="w-3.5 h-3.5 text-amber-400" />
              <span>Level +1</span>
            </button>

            <button
              onClick={() => jumpLevel(20)}
              className="py-2 px-2.5 bg-obsidian-900 hover:bg-obsidian-800 text-slate-100 rounded-lg border border-obsidian-700 flex items-center gap-1.5 rpg-btn font-fantasy"
            >
              <span className="font-pixel text-[9px] text-amber-300">20</span>
              <span>Jump to Lv.20</span>
            </button>
          </div>

          {/* God Mode Toggle */}
          <div className="flex items-center justify-between bg-obsidian-950/80 p-2.5 rounded-lg border border-obsidian-800">
            <div className="flex flex-col">
              <span className="font-fantasy font-semibold text-xs text-slate-200">
                Invulnerable God Mode
              </span>
              <span className="text-[10px] text-slate-400">
                Infinite health in tactical battles
              </span>
            </div>
            <button
              onClick={toggleGodMode}
              className={`px-3 py-1 rounded font-fantasy text-xs font-bold transition-all ${
                isGodMode
                  ? 'bg-rose-600 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]'
                  : 'bg-obsidian-800 text-slate-400'
              }`}
            >
              {isGodMode ? 'ENABLED' : 'DISABLED'}
            </button>
          </div>

          {/* Teleport Dropdown */}
          <div className="flex flex-col gap-1.5">
            <label className="font-fantasy text-[10px] uppercase text-slate-400 font-bold">
              Instant Realm Teleport:
            </label>
            <div className="flex gap-2">
              <select
                value={selectedTeleport}
                onChange={(e) => setSelectedTeleport(e.target.value)}
                className="flex-1 bg-obsidian-950 text-slate-200 text-xs rounded-lg px-2 py-1.5 border border-obsidian-700 outline-none"
              >
                {zonesCatalog.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name || zone.id}
                  </option>
                ))}
              </select>
              <button
                onClick={() => teleportZone(selectedTeleport)}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-obsidian-950 rounded-lg font-fantasy text-xs font-bold rpg-btn"
              >
                Warp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
