import React, { useState, useEffect, useCallback } from 'react';
import { useGame } from '../../context/GameContext';
import { generateDungeonMap, type DungeonMap, type DungeonNode } from '@arcanora/core';
import {
  CampsiteFireIcon,
  TreasureChestIcon,
  StairsDownIcon,
  MerchantIcon,
  BossSkullIcon,
  SwordsCrossedIcon
} from '../common/SvgIcons';
import confetti from 'canvas-confetti';

export const DungeonCrawler: React.FC = () => {
  const { player, setPlayer, setActiveTab, isGodMode } = useGame();

  const [floor, setFloor] = useState(1);
  const [dungeon, setDungeon] = useState<DungeonMap>(() => {
    return generateDungeonMap(player.currentZoneId, player.level, 1);
  });

  const [currentCoord, setCurrentCoord] = useState<{ x: number; y: number }>(() => {
    const startNode = dungeon.nodes[dungeon.startNodeId];
    return { x: startNode?.x ?? 0, y: startNode?.y ?? 0 };
  });

  const [eventModal, setEventModal] = useState<{ title: string; content: string; actions: Array<{ label: string; onClick: () => void }> } | null>(null);
  const [dungeonLog, setDungeonLog] = useState<string[]>([
    `Entered ${dungeon.name} — Floor ${floor}. Move using WASD or the D-Pad.`
  ]);

  // Reveal adjacent nodes around player (line-of-sight fog-of-war)
  useEffect(() => {
    setDungeon(prev => {
      const updatedNodes = { ...prev.nodes };
      const currentId = `${currentCoord.x}_${currentCoord.y}`;

      if (updatedNodes[currentId]) {
        updatedNodes[currentId].status = 'visited';
      }

      // Reveal adjacent cells
      const adjCoords = [
        `${currentCoord.x}_${currentCoord.y - 1}`,
        `${currentCoord.x}_${currentCoord.y + 1}`,
        `${currentCoord.x - 1}_${currentCoord.y}`,
        `${currentCoord.x + 1}_${currentCoord.y}`
      ];

      for (const adjId of adjCoords) {
        if (updatedNodes[adjId] && updatedNodes[adjId].status === 'hidden') {
          updatedNodes[adjId].status = 'revealed';
        }
      }

      return { ...prev, nodes: updatedNodes };
    });
  }, [currentCoord]);

  // Movement handler
  const movePlayer = useCallback((dx: number, dy: number) => {
    const newX = currentCoord.x + dx;
    const newY = currentCoord.y + dy;
    const targetId = `${newX}_${newY}`;
    const targetNode = dungeon.nodes[targetId];

    if (!targetNode) {
      setDungeonLog(prev => ['A solid cavern wall blocks your passage.', ...prev.slice(0, 8)]);
      return;
    }

    setCurrentCoord({ x: newX, y: newY });
    handleNodeInteraction(targetNode);
  }, [currentCoord, dungeon]);

  // Keyboard navigation (WASD + Arrow keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (eventModal) return;
      if (['ArrowUp', 'KeyW'].includes(e.code)) movePlayer(0, -1);
      if (['ArrowDown', 'KeyS'].includes(e.code)) movePlayer(0, 1);
      if (['ArrowLeft', 'KeyA'].includes(e.code)) movePlayer(-1, 0);
      if (['ArrowRight', 'KeyD'].includes(e.code)) movePlayer(1, 0);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [movePlayer, eventModal]);

  const handleNodeInteraction = (node: DungeonNode) => {
    if (node.type === 'campsite') {
      setDungeonLog(prev => ['🏕️ You rest at a warm campfire. Health and stamina restored!', ...prev.slice(0, 8)]);
      setPlayer(p => ({
        ...p,
        hpCurrent: p.hpMax,
        stamina: p.staminaMax
      }));
    } else if (node.type === 'treasure' && node.status !== 'cleared') {
      const goldFound = Math.floor(Math.random() * 80) + 40;
      confetti({ particleCount: 40, spread: 50 });
      setEventModal({
        title: '🎁 Gilded Dungeon Chest',
        content: `You unlocked an ancient coffer containing ${goldFound} Gold and rare crafting catalysts!`,
        actions: [{
          label: 'Collect Spoils',
          onClick: () => {
            setPlayer(p => ({ ...p, gold: p.gold + goldFound }));
            node.status = 'cleared';
            setEventModal(null);
          }
        }]
      });
    } else if (node.type === 'stairs') {
      setEventModal({
        title: '🪜 Descent Staircase',
        content: `You found a deep spiral staircase leading down to Floor ${floor + 1}.`,
        actions: [
          {
            label: 'Descend to Next Floor',
            onClick: () => {
              const nextFloor = floor + 1;
              setFloor(nextFloor);
              const nextDungeon = generateDungeonMap(player.currentZoneId, player.level, nextFloor);
              setDungeon(nextDungeon);
              const start = nextDungeon.nodes[nextDungeon.startNodeId];
              setCurrentCoord({ x: start?.x ?? 0, y: start?.y ?? 0 });
              setDungeonLog(prev => [`Descended into Floor ${nextFloor}!`, ...prev.slice(0, 8)]);
              setEventModal(null);
            }
          },
          {
            label: 'Stay on Current Floor',
            onClick: () => setEventModal(null)
          }
        ]
      });
    } else if (['room', 'elite', 'boss'].includes(node.type) && node.status !== 'cleared') {
      setEventModal({
        title: node.type === 'boss' ? '☠️ Boss Lair Unsealed!' : '⚔️ Hostile Lurker Ambush!',
        content: `A menacing creature springs from the shadows to bar your path!`,
        actions: [
          {
            label: 'Engage in Battle Arena',
            onClick: () => {
              node.status = 'cleared';
              setEventModal(null);
              setActiveTab('combat');
            }
          },
          {
            label: 'Strike Quick Attack',
            onClick: () => {
              node.status = 'cleared';
              const xpGained = node.type === 'boss' ? 300 : 75;
              setPlayer(p => ({ ...p, exp: p.exp + xpGained }));
              setDungeonLog(prev => [`Defeated dungeon monster! +${xpGained} EXP`, ...prev.slice(0, 8)]);
              setEventModal(null);
            }
          }
        ]
      });
    }
  };

  // 6x6 Grid Render
  const gridCells = [];
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 6; x++) {
      const id = `${x}_${y}`;
      const node = dungeon.nodes[id];
      const isPlayerHere = currentCoord.x === x && currentCoord.y === y;

      gridCells.push({ x, y, id, node, isPlayerHere });
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 w-full">
      {/* 6x6 Grid Viewport */}
      <div className="flex-1 rpg-panel rounded-xl p-4 flex flex-col items-center shadow-2xl relative overflow-hidden">
        <div className="w-full flex items-center justify-between pb-3 mb-3 border-b border-obsidian-700/60">
          <div className="flex items-center gap-2">
            <TreasureChestIcon className="w-5 h-5 text-amber-400" />
            <h2 className="font-fantasy font-bold text-base text-slate-100 tracking-wide">
              {dungeon.name} — Floor {floor}
            </h2>
          </div>
          <span className="font-pixel text-[9px] text-emerald-400 bg-emerald-950/40 px-2 py-1 rounded border border-emerald-800/40">
            Grid Crawler
          </span>
        </div>

        {/* 6x6 Graphical Board */}
        <div className="grid grid-cols-6 gap-2 w-full max-w-[480px] aspect-square bg-obsidian-950 p-3 rounded-xl border border-obsidian-800/80 shadow-inner">
          {gridCells.map(({ x, y, id, node, isPlayerHere }) => {
            if (!node) {
              // Cavern Wall Cell
              return (
                <div
                  key={id}
                  className="w-full h-full rounded-lg bg-obsidian-900/40 border border-obsidian-900/30 flex items-center justify-center opacity-40"
                />
              );
            }

            const isVisited = node.status === 'visited' || node.status === 'cleared';
            const isRevealed = node.status === 'revealed';

            return (
              <div
                key={id}
                onClick={() => {
                  const dist = Math.abs(currentCoord.x - x) + Math.abs(currentCoord.y - y);
                  if (dist === 1) movePlayer(x - currentCoord.x, y - currentCoord.y);
                }}
                className={`w-full h-full rounded-lg relative flex items-center justify-center cursor-pointer transition-all duration-200 border ${
                  isPlayerHere
                    ? 'bg-amber-500/20 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.5)] z-10'
                    : isVisited
                    ? 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-700/50'
                    : isRevealed
                    ? 'bg-slate-900/80 border-slate-800/60 opacity-60'
                    : 'bg-obsidian-950 border-obsidian-900 opacity-20'
                }`}
              >
                {/* Node Icons */}
                {isVisited && (
                  <>
                    {node.type === 'campsite' && <CampsiteFireIcon className="w-5 h-5 text-orange-400" />}
                    {node.type === 'treasure' && <TreasureChestIcon className="w-5 h-5 text-amber-400" />}
                    {node.type === 'stairs' && <StairsDownIcon className="w-5 h-5 text-slate-300" />}
                    {node.type === 'merchant' && <MerchantIcon className="w-5 h-5 text-emerald-400" />}
                    {node.type === 'boss' && <BossSkullIcon className="w-5 h-5 text-red-500" />}
                    {['room', 'elite'].includes(node.type) && (
                      node.status === 'cleared'
                        ? <span className="w-2 h-2 rounded-full bg-slate-600" />
                        : <SwordsCrossedIcon className="w-4 h-4 text-rose-400" />
                    )}
                  </>
                )}

                {/* Player Token */}
                {isPlayerHere && (
                  <div className="absolute inset-0 m-auto w-6 h-6 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center font-fantasy font-black text-obsidian-950 text-xs shadow-lg animate-pulse ring-2 ring-white">
                    {player.username.charAt(0)}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* On-screen Directional Pad (D-Pad) for Touch / Fast Navigation */}
        <div className="flex flex-col items-center gap-1.5 mt-4">
          <button
            onClick={() => movePlayer(0, -1)}
            className="w-12 h-10 bg-obsidian-800 hover:bg-obsidian-700 text-slate-200 font-pixel text-xs rounded-lg rpg-btn border border-obsidian-600 flex items-center justify-center shadow"
          >
            ▲
          </button>
          <div className="flex gap-1.5">
            <button
              onClick={() => movePlayer(-1, 0)}
              className="w-12 h-10 bg-obsidian-800 hover:bg-obsidian-700 text-slate-200 font-pixel text-xs rounded-lg rpg-btn border border-obsidian-600 flex items-center justify-center shadow"
            >
              ◀
            </button>
            <button
              onClick={() => movePlayer(0, 1)}
              className="w-12 h-10 bg-obsidian-800 hover:bg-obsidian-700 text-slate-200 font-pixel text-xs rounded-lg rpg-btn border border-obsidian-600 flex items-center justify-center shadow"
            >
              ▼
            </button>
            <button
              onClick={() => movePlayer(1, 0)}
              className="w-12 h-10 bg-obsidian-800 hover:bg-obsidian-700 text-slate-200 font-pixel text-xs rounded-lg rpg-btn border border-obsidian-600 flex items-center justify-center shadow"
            >
              ▶
            </button>
          </div>
          <span className="text-[10px] text-slate-500 font-fantasy mt-1">Use WASD, Arrow Keys, or D-Pad to move</span>
        </div>
      </div>

      {/* Right Column: Exploration Log & Room Details */}
      <div className="w-full lg:w-80 flex flex-col gap-4 shrink-0">
        <div className="rpg-panel rounded-xl p-4 flex flex-col shadow-xl border border-obsidian-700/70">
          <h3 className="font-fantasy font-bold text-sm text-slate-200 uppercase tracking-wider pb-2 border-b border-obsidian-700/60 mb-2">
            Exploration Log
          </h3>
          <div className="font-mono text-xs text-slate-300 space-y-1.5 max-h-56 overflow-y-auto scrollbar-thin">
            {dungeonLog.map((log, i) => (
              <div key={i} className="border-b border-obsidian-800/40 pb-1">
                {log}
              </div>
            ))}
          </div>
        </div>

        {/* Current Node Details */}
        <div className="rpg-panel rounded-xl p-4 flex flex-col shadow-xl border border-obsidian-700/70">
          <span className="font-fantasy uppercase text-[10px] text-amber-400 font-bold">
            Current Chamber
          </span>
          <h4 className="font-fantasy font-bold text-base text-slate-100 capitalize">
            {dungeon.nodes[`${currentCoord.x}_${currentCoord.y}`]?.name || 'Cavern Corridor'}
          </h4>
          <p className="text-xs text-slate-400 mt-1 italic">
            Floor {floor} of the ancient subterranean labyrinth.
          </p>
        </div>
      </div>

      {/* Interactive Room Encounter Modal */}
      {eventModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
          <div className="rpg-panel rounded-2xl p-6 max-w-md w-full border border-amber-500/50 shadow-2xl flex flex-col gap-4">
            <h3 className="font-fantasy font-bold text-lg text-amber-300 tracking-wide border-b border-obsidian-700 pb-2">
              {eventModal.title}
            </h3>
            <p className="text-xs text-slate-200 leading-relaxed font-sans">
              {eventModal.content}
            </p>
            <div className="flex flex-col gap-2 mt-2">
              {eventModal.actions.map((act, idx) => (
                <button
                  key={idx}
                  onClick={act.onClick}
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-obsidian-950 font-fantasy text-xs font-bold rounded-lg rpg-btn shadow"
                >
                  {act.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
