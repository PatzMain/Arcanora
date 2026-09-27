import React from 'react';
import { GameProvider, useGame } from './context/GameContext';
import { HeaderHUD } from './components/layout/HeaderHUD';
import { WorldMapCanvas } from './components/world/WorldMapCanvas';
import { BattleArena } from './components/combat/BattleArena';
import { DungeonCrawler } from './components/dungeon/DungeonCrawler';
import { InventoryView } from './components/inventory/InventoryView';
import { DevSandboxToolbar } from './components/layout/DevSandboxToolbar';

const MainContent: React.FC = () => {
  const { activeTab } = useGame();

  return (
    <main className="max-w-7xl mx-auto px-3 py-4 flex-1 flex flex-col items-center justify-center w-full">
      {activeTab === 'map' && <WorldMapCanvas />}
      {activeTab === 'combat' && <BattleArena />}
      {activeTab === 'dungeon' && <DungeonCrawler />}
      {activeTab === 'inventory' && <InventoryView />}
      {activeTab === 'sandbox' && (
        <div className="w-full flex flex-col items-center gap-4">
          <div className="rpg-panel rounded-xl p-6 max-w-xl text-center border border-cyan-500/50">
            <h2 className="font-fantasy font-black text-xl text-cyan-300 mb-2">
              Arcanora Local-First Developer Laboratory
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed font-sans mb-4">
              Arcanora runs 100% offline with zero cloud bills ($0/mo) using WebAssembly PostgreSQL (PGlite) and IndexedDB persistence. Use the Dev Sandbox Toolbar in the bottom right corner to test instant stat refills, currency grants, level jumps, and zone warps.
            </p>
          </div>
        </div>
      )}
    </main>
  );
};

export const App: React.FC = () => {
  return (
    <GameProvider>
      <div className="min-h-screen flex flex-col justify-between text-slate-100 bg-obsidian-950 font-sans selection:bg-amber-500/30">
        <HeaderHUD />
        <MainContent />
        <DevSandboxToolbar />

        {/* Global Footer */}
        <footer className="w-full border-t border-obsidian-800/80 bg-obsidian-950/90 py-2.5 px-4 text-center text-[11px] text-slate-500 font-fantasy">
          <span>Arcanora Web RPG — Turborepo Monorepo • Local-First PGlite WASM • $0/mo Host Ready</span>
        </footer>
      </div>
    </GameProvider>
  );
};

export default App;
