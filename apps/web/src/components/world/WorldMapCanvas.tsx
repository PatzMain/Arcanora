import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useGame } from '../../context/GameContext';
import { zonesCatalog, mapConfig } from '@arcanora/core';
import {
  CompassIcon,
  SwordsCrossedIcon,
  TreasureChestIcon,
  StaminaBoltIcon
} from '../common/SvgIcons';

export const WorldMapCanvas: React.FC = () => {
  const { player, travelToZone, setActiveTab } = useGame();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(player.currentZoneId);
  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);
  const [travelMessage, setTravelMessage] = useState<string | null>(null);

  const locations = mapConfig.locations as Record<string, { x: number; y: number; type: string }>;

  // Animation frame loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let offset = 0;
    const mapImg = new Image();
    mapImg.src = '/maps/world_map.png';

    const render = () => {
      offset = (offset + 0.5) % 24;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Draw base pixel art map
      if (mapImg.complete && mapImg.naturalWidth > 0) {
        ctx.drawImage(mapImg, 0, 0, canvas.width, canvas.height);
      } else {
        // Fallback procedural background
        ctx.fillStyle = '#0b1324';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // 2. Draw connecting paths with animated marching dashes
      ctx.save();
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -offset;

      const locKeys = Object.keys(locations);
      for (let i = 0; i < locKeys.length; i++) {
        for (let j = i + 1; j < locKeys.length; j++) {
          const locA = locations[locKeys[i]];
          const locB = locations[locKeys[j]];
          const dist = Math.hypot(locA.x - locB.x, locA.y - locB.y);
          // Connect nearby zones (<= 140px)
          if (dist <= 140) {
            ctx.beginPath();
            ctx.moveTo(locA.x, locA.y);
            ctx.lineTo(locB.x, locB.y);
            ctx.stroke();
          }
        }
      }
      ctx.restore();

      // 3. Draw location markers
      for (const [id, loc] of Object.entries(locations)) {
        const isDiscovered = player.discoveredZones.includes(id) || id === player.currentZoneId;
        const isCurrent = id === player.currentZoneId;
        const isSelected = id === selectedZoneId;
        const isHovered = id === hoveredZoneId;

        ctx.save();

        if (!isDiscovered) {
          // Fog of war obscured node
          ctx.fillStyle = 'rgba(30, 41, 59, 0.7)';
          ctx.beginPath();
          ctx.arc(loc.x, loc.y, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else {
          // Discovered node
          const color = loc.type === 'dungeon' ? '#EF4444' : (loc.type === 'settlement' ? '#3B82F6' : '#10B981');

          // Highlight halo
          if (isSelected || isHovered) {
            ctx.beginPath();
            ctx.arc(loc.x, loc.y, 16, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(250, 204, 21, 0.25)';
            ctx.fill();
            ctx.strokeStyle = '#FACC15';
            ctx.lineWidth = 2;
            ctx.stroke();
          }

          // Inner marker node
          ctx.beginPath();
          ctx.arc(loc.x, loc.y, 9, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Label
          ctx.font = "9px 'Press Start 2P', monospace";
          ctx.textAlign = 'center';
          ctx.fillStyle = '#000000';
          const label = id.replace(/_/g, ' ');
          ctx.fillText(label, loc.x + 1, loc.y - 13);
          ctx.fillStyle = isCurrent ? '#FDE047' : '#FFFFFF';
          ctx.fillText(label, loc.x, loc.y - 14);
        }

        // 4. Animated player beacon at current zone
        if (isCurrent) {
          const pulse = (Math.sin(Date.now() / 250) + 1) / 2; // 0 to 1
          const radius = 12 + pulse * 14;
          const alpha = 0.8 - pulse * 0.7;

          ctx.beginPath();
          ctx.arc(loc.x, loc.y, radius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(234, 179, 8, ${alpha})`;
          ctx.lineWidth = 3;
          ctx.stroke();

          // Center golden diamond core
          ctx.save();
          ctx.translate(loc.x, loc.y);
          ctx.rotate(Math.PI / 4);
          ctx.fillStyle = '#FBBF24';
          ctx.fillRect(-5, -5, 10, 10);
          ctx.restore();
        }

        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [locations, player.currentZoneId, player.discoveredZones, selectedZoneId, hoveredZoneId]);

  // Click detection
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    for (const [id, loc] of Object.entries(locations)) {
      const dist = Math.hypot(clickX - loc.x, clickY - loc.y);
      if (dist <= 20) {
        setSelectedZoneId(id);
        break;
      }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const moveX = (e.clientX - rect.left) * scaleX;
    const moveY = (e.clientY - rect.top) * scaleY;

    let found: string | null = null;
    for (const [id, loc] of Object.entries(locations)) {
      const dist = Math.hypot(moveX - loc.x, moveY - loc.y);
      if (dist <= 20) {
        found = id;
        break;
      }
    }
    setHoveredZoneId(found);
  };

  const selectedZoneDef = zonesCatalog.find(z => z.id === selectedZoneId);
  const isSelectedCurrent = selectedZoneId === player.currentZoneId;

  const handleTravel = () => {
    if (!selectedZoneId) return;
    const success = travelToZone(selectedZoneId);
    if (success) {
      setTravelMessage(`Traveled to ${selectedZoneId.replace(/_/g, ' ')}! -15 Stamina`);
      setTimeout(() => setTravelMessage(null), 3000);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 w-full">
      {/* Interactive Map Viewport */}
      <div className="flex-1 rpg-panel rounded-xl p-3 flex flex-col items-center relative overflow-hidden shadow-2xl">
        <div className="w-full flex items-center justify-between pb-2 mb-2 border-b border-obsidian-700/60">
          <div className="flex items-center gap-2">
            <CompassIcon className="w-5 h-5 text-amber-400" />
            <h2 className="font-fantasy font-bold text-base text-slate-100 tracking-wide">
              Realm of Arcanora — World Map
            </h2>
          </div>
          <span className="font-pixel text-[9px] text-amber-400/80 bg-amber-950/40 px-2 py-1 rounded border border-amber-800/40">
            Interactive Canvas
          </span>
        </div>

        {/* Travel toast */}
        {travelMessage && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 bg-emerald-950/90 text-emerald-200 border border-emerald-500/60 font-fantasy text-xs font-semibold px-4 py-2 rounded-lg shadow-lg animate-bounce">
            {travelMessage}
          </div>
        )}

        {/* Canvas Element */}
        <div className="relative w-full max-w-[800px] aspect-[800/500] rounded-lg overflow-hidden border border-obsidian-700/80 shadow-inner bg-obsidian-950">
          <canvas
            ref={canvasRef}
            width={800}
            height={500}
            onClick={handleCanvasClick}
            onMouseMove={handleCanvasMouseMove}
            className="w-full h-full cursor-pointer object-cover"
          />
        </div>

        <div className="w-full flex items-center justify-between text-[11px] text-slate-400 mt-2 px-1">
          <span>Click any zone to inspect and travel</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Settlement</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Wilderness</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Dungeon</span>
          </div>
        </div>
      </div>

      {/* Selected Zone Inspector Card */}
      <div className="w-full lg:w-80 rpg-panel rounded-xl p-4 flex flex-col justify-between shrink-0 shadow-xl border border-obsidian-700/70">
        <div className="flex flex-col gap-3">
          <div className="border-b border-obsidian-700/60 pb-2">
            <span className="font-fantasy uppercase text-[10px] text-amber-400/80 font-bold tracking-wider">
              Selected Territory
            </span>
            <h3 className="font-fantasy font-bold text-lg text-slate-100 capitalize">
              {selectedZoneId ? selectedZoneId.replace(/_/g, ' ') : 'Select a Location'}
            </h3>
            <span className="text-xs text-slate-400">
              {selectedZoneDef?.levelReq ? `Recommended Lv. ${selectedZoneDef.levelReq}+` : 'Starter Sanctuary'}
            </span>
          </div>

          {selectedZoneDef ? (
            <div className="flex flex-col gap-2.5 text-xs text-slate-300">
              <p className="italic text-slate-400 leading-relaxed">
                {selectedZoneDef.description || 'A mysterious realm waiting for seasoned adventurers to uncover its lost relics and perils.'}
              </p>

              <div className="bg-obsidian-900/80 p-2.5 rounded-lg border border-obsidian-700/50 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Territory Type:</span>
                  <span className="font-fantasy font-semibold text-slate-200 capitalize">
                    {locations[selectedZoneId || '']?.type || 'Wilderness'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Danger Tier:</span>
                  <span className="font-semibold text-amber-400">
                    {selectedZoneDef.levelReq && selectedZoneDef.levelReq > 10 ? 'High' : 'Moderate'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Enemies Sighted:</span>
                  <span className="font-mono text-slate-300">
                    {selectedZoneDef.enemies ? selectedZoneDef.enemies.length : 3} Types
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">
              Select any node on the map to inspect terrain details.
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 mt-4 pt-3 border-t border-obsidian-700/60">
          {isSelectedCurrent ? (
            <div className="flex flex-col gap-2">
              <div className="bg-amber-950/30 text-amber-300 border border-amber-800/40 text-xs py-2 px-3 rounded text-center font-fantasy font-semibold">
                📍 You are currently here
              </div>
              <button
                onClick={() => setActiveTab('dungeon')}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-fantasy text-xs font-bold tracking-wider flex items-center justify-center gap-2 rpg-btn shadow-lg"
              >
                <TreasureChestIcon className="w-4 h-4" />
                <span>Enter Zone Dungeon</span>
              </button>
              <button
                onClick={() => setActiveTab('combat')}
                className="w-full py-2 bg-rose-700 hover:bg-rose-600 text-white rounded-lg font-fantasy text-xs font-bold tracking-wider flex items-center justify-center gap-2 rpg-btn"
              >
                <SwordsCrossedIcon className="w-4 h-4" />
                <span>Engage Hostile Patrol</span>
              </button>
            </div>
          ) : (
            <button
              onClick={handleTravel}
              disabled={!selectedZoneId}
              className="w-full py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-obsidian-950 rounded-lg font-fantasy text-xs font-bold tracking-wider flex items-center justify-center gap-2 rpg-btn shadow-lg"
            >
              <StaminaBoltIcon className="w-4 h-4 text-obsidian-950" />
              <span>Travel Here (15 Stamina)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
