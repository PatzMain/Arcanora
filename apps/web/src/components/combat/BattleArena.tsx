import React, { useState, useEffect } from 'react';
import { useGame } from '../../context/GameContext';
import {
  createCombatState,
  executeCombatTurn,
  type CombatState,
  type CombatAction,
  type ElementalAffinity,
  type CombatStats,
  type EnemyStats,
  enemiesCatalog
} from '@arcanora/core';
import { VitalBar } from '../common/VitalBar';
import {
  SwordsCrossedIcon,
  HpHeartIcon,
  ManaOrbIcon,
  ShieldIcon,
  PotionRedIcon,
  ElementFireIcon,
  ElementFrostIcon,
  ElementLightningIcon,
  ElementVoidIcon,
  ElementHolyIcon,
  ElementPhysicalIcon,
  BossSkullIcon
} from '../common/SvgIcons';
import confetti from 'canvas-confetti';

export const BattleArena: React.FC = () => {
  const { player, setPlayer, isGodMode } = useGame();

  // Find enemy suitable for player's current zone or default
  const [enemyDef, setEnemyDef] = useState<any>(() => {
    return enemiesCatalog.find(e => e.zone === player.currentZoneId) || enemiesCatalog[0] || {
      id: 'cave_bat',
      name: 'Cavern Dread Bat',
      level: 4,
      stats: { hp: 130, attack: 22, defense: 8, speed: 18 },
      abilities: [{ name: 'Vampiric Drain', chance: 40 }]
    };
  });

  const [combatState, setCombatState] = useState<CombatState>(() => {
    const pStats: CombatStats = {
      hp: player.hpCurrent,
      maxHp: player.hpMax,
      mana: player.manaCurrent,
      maxMana: player.manaMax,
      attack: player.attack,
      defense: player.defense,
      speed: player.speed,
      critChance: player.critChance,
      critDmg: player.critDmg,
      luck: player.luck,
      element: 'Physical'
    };

    const eStats: EnemyStats = {
      hp: enemyDef.stats?.hp || 130,
      attack: enemyDef.stats?.attack || 22,
      defense: enemyDef.stats?.defense || 8,
      speed: enemyDef.stats?.speed || 14
    };

    return createCombatState(pStats, eStats, enemyDef.abilities || []);
  });

  const [selectedElement, setSelectedElement] = useState<ElementalAffinity>('Physical');
  const [isShaking, setIsShaking] = useState(false);
  const [activeTabSub, setActiveTabSub] = useState<'actions' | 'skills' | 'items'>('actions');

  // Sync player vitals back when combat ends
  useEffect(() => {
    if (combatState.isOver) {
      if (combatState.playerWon) {
        confetti({ particleCount: 75, spread: 60, origin: { y: 0.6 } });
        // Grant EXP and Gold
        setPlayer(prev => ({
          ...prev,
          gold: prev.gold + (enemyDef.level * 45),
          exp: prev.exp + (enemyDef.level * 60),
          hpCurrent: isGodMode ? prev.hpMax : Math.max(1, combatState.playerHp)
        }));
      }
    }
  }, [combatState.isOver, combatState.playerWon]);

  const handlePlayerAction = (actionType: 'attack' | 'defend' | 'parry' | 'skill' | 'item' | 'flee') => {
    if (combatState.isOver) return;

    const pStats: CombatStats = {
      hp: isGodMode ? player.hpMax : combatState.playerHp,
      maxHp: player.hpMax,
      mana: combatState.playerMana,
      maxMana: player.manaMax,
      attack: player.attack,
      defense: player.defense,
      speed: player.speed,
      critChance: player.critChance,
      critDmg: player.critDmg,
      luck: player.luck,
      element: selectedElement
    };

    const eStats: EnemyStats = {
      hp: combatState.enemyHp,
      attack: enemyDef.stats?.attack || 22,
      defense: enemyDef.stats?.defense || 8,
      speed: enemyDef.stats?.speed || 14
    };

    const action: CombatAction = {
      type: actionType,
      element: selectedElement
    };

    const { state, enemyDmg } = executeCombatTurn(combatState, action, pStats, eStats, enemyDef.abilities || []);

    if (enemyDmg > 15) {
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 400);
    }

    setCombatState({ ...state });
  };

  const restartBattle = (newEnemy?: any) => {
    const targetEnemy = newEnemy || enemyDef;
    if (newEnemy) setEnemyDef(newEnemy);

    const pStats: CombatStats = {
      hp: player.hpCurrent,
      maxHp: player.hpMax,
      mana: player.manaCurrent,
      maxMana: player.manaMax,
      attack: player.attack,
      defense: player.defense,
      speed: player.speed,
      critChance: player.critChance,
      critDmg: player.critDmg,
      luck: player.luck,
      element: selectedElement
    };

    const eStats: EnemyStats = {
      hp: targetEnemy.stats?.hp || 130,
      attack: targetEnemy.stats?.attack || 22,
      defense: targetEnemy.stats?.defense || 8,
      speed: targetEnemy.stats?.speed || 14
    };

    setCombatState(createCombatState(pStats, eStats, targetEnemy.abilities || []));
  };

  return (
    <div className={`w-full max-w-5xl mx-auto flex flex-col gap-4 ${isShaking ? 'animate-shake' : ''}`}>
      {/* Tactical Telegraph Banner */}
      <div className="rpg-panel rounded-xl p-3 border border-amber-600/50 bg-gradient-to-r from-amber-950/40 via-obsidian-900 to-rose-950/40 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 shrink-0">
            <BossSkullIcon className="w-6 h-6 text-amber-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-pixel text-[9px] bg-rose-600/80 text-white px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                Enemy Telegraphed Intent
              </span>
              <span className="font-fantasy font-bold text-sm text-slate-100">
                {combatState.enemyIntent?.name || 'Preparing action...'}
              </span>
            </div>
            <p className="text-xs text-slate-300 italic mt-0.5">
              {combatState.enemyIntent?.description}
            </p>
          </div>
        </div>

        {/* Recommended Counter */}
        <div className="shrink-0 bg-obsidian-950/80 px-3 py-1.5 rounded-lg border border-obsidian-700/80 text-right">
          <span className="text-[10px] text-slate-400 font-medium block">Suggested Counter:</span>
          <span className="font-fantasy font-bold text-xs uppercase text-amber-400 tracking-wider">
            {combatState.enemyIntent?.recommendedCounter === 'parry' ? '⚡ Timing Parry' : '🛡️ Firm Guard'}
          </span>
        </div>
      </div>

      {/* Battle Stage: Hero vs Monster Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
        {/* Left: Player Card */}
        <div className="rpg-panel rounded-xl p-4 border border-blue-900/60 flex flex-col justify-between shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-obsidian-700/50">
            <div>
              <span className="font-fantasy uppercase text-[10px] text-cyan-400/80 font-bold">
                Hero of the Realm
              </span>
              <h3 className="font-fantasy font-bold text-lg text-slate-100">
                {player.username}
              </h3>
              <span className="text-xs text-slate-400 font-fantasy">
                Lv.{player.level} {player.playerClass}
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-950/80 border border-blue-500/40 flex items-center justify-center font-fantasy font-black text-xl text-blue-300 shadow-md">
              {player.username.charAt(0)}
            </div>
          </div>

          {/* Vitals */}
          <div className="py-4 space-y-3">
            <VitalBar
              label="Player Health"
              current={isGodMode ? player.hpMax : combatState.playerHp}
              max={combatState.playerMaxHp}
              color="hp"
              icon={<HpHeartIcon className="w-4 h-4 text-red-400" />}
            />
            <VitalBar
              label="Arcane Mana"
              current={combatState.playerMana}
              max={combatState.playerMaxMana}
              color="mana"
              icon={<ManaOrbIcon className="w-4 h-4 text-cyan-400" />}
            />
          </div>

          {/* Stance Indicator */}
          <div className="bg-obsidian-950/60 p-2 rounded-lg border border-obsidian-800 text-xs flex justify-between items-center text-slate-300">
            <span>Combat Stance:</span>
            <span className="font-fantasy font-semibold uppercase text-cyan-300">
              {combatState.playerStance === 'guard' ? '🛡️ Guarding (-55% Dmg)'
                : combatState.playerStance === 'parry' ? '⚡ Riposte Parry'
                : '⚔️ Neutral'}
            </span>
          </div>
        </div>

        {/* Right: Enemy Monster Card */}
        <div className="rpg-panel rounded-xl p-4 border border-rose-900/60 flex flex-col justify-between shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-obsidian-700/50">
            <div>
              <span className="font-fantasy uppercase text-[10px] text-rose-400/80 font-bold">
                Hostile Adversary
              </span>
              <h3 className="font-fantasy font-bold text-lg text-rose-200">
                {enemyDef.name}
              </h3>
              <span className="text-xs text-slate-400 font-fantasy">
                Lv.{enemyDef.level || 4} Threat
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-rose-950/80 border border-rose-500/40 flex items-center justify-center shadow-md">
              <BossSkullIcon className="w-7 h-7 text-rose-400" />
            </div>
          </div>

          {/* Vitals */}
          <div className="py-4 space-y-3">
            <VitalBar
              label="Enemy Health"
              current={combatState.enemyHp}
              max={combatState.enemyMaxHp}
              color="hp"
              icon={<HpHeartIcon className="w-4 h-4 text-red-500" />}
            />
            {/* Status effects */}
            <div className="flex items-center gap-1.5 flex-wrap min-h-[26px]">
              <span className="text-[10px] text-slate-500 uppercase font-fantasy">Afflictions:</span>
              {combatState.enemyBuffs.length === 0 ? (
                <span className="text-[11px] text-slate-500 italic">None</span>
              ) : (
                combatState.enemyBuffs.map(b => (
                  <span key={b.id} className="text-[10px] font-fantasy font-bold px-2 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-700/50">
                    {b.name} ({b.turnsRemaining}t)
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="bg-obsidian-950/60 p-2 rounded-lg border border-obsidian-800 text-xs flex justify-between items-center text-slate-300">
            <span>Threat Tier:</span>
            <span className="font-fantasy font-semibold uppercase text-rose-400">
              {enemyDef.rarity || 'Hostile Beast'}
            </span>
          </div>
        </div>

        {/* Floating Numbers Overlay */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-around z-20">
          {combatState.floatingNumbers.map(fn => (
            <div
              key={fn.id}
              className={`font-pixel font-black text-sm px-2 py-1 rounded shadow-lg animate-float-dmg ${
                fn.type === 'crit' ? 'text-amber-300 bg-amber-950/90 border border-amber-500 text-base scale-125'
                : fn.type === 'synergy' ? 'text-cyan-300 bg-cyan-950/90 border border-cyan-400 scale-110'
                : fn.type === 'parry' ? 'text-yellow-200 bg-yellow-950/90 border border-yellow-500'
                : 'text-white bg-slate-900/90 border border-slate-700'
              }`}
            >
              {fn.text}
            </div>
          ))}
        </div>
      </div>

      {/* Elemental Affinity Selection Row */}
      <div className="rpg-panel rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 border border-obsidian-700/60">
        <span className="font-fantasy uppercase text-xs text-slate-300 font-bold tracking-wider">
          Infuse Weapon Element:
        </span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['Physical', 'Fire', 'Frost', 'Lightning', 'Void', 'Holy'] as ElementalAffinity[]).map((el) => {
            const isSelected = selectedElement === el;
            return (
              <button
                key={el}
                onClick={() => setSelectedElement(el)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-fantasy font-semibold transition-all rpg-btn ${
                  isSelected
                    ? 'bg-amber-500/20 text-amber-200 border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                    : 'bg-obsidian-900 text-slate-400 border-obsidian-700 hover:text-slate-200'
                }`}
              >
                {el === 'Fire' ? <ElementFireIcon className="w-3.5 h-3.5" />
                  : el === 'Frost' ? <ElementFrostIcon className="w-3.5 h-3.5" />
                  : el === 'Lightning' ? <ElementLightningIcon className="w-3.5 h-3.5" />
                  : el === 'Void' ? <ElementVoidIcon className="w-3.5 h-3.5" />
                  : el === 'Holy' ? <ElementHolyIcon className="w-3.5 h-3.5" />
                  : <ElementPhysicalIcon className="w-3.5 h-3.5" />}
                <span>{el}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Reactive Action Controls */}
      <div className="rpg-panel rounded-xl p-4 flex flex-col gap-3 border border-obsidian-700/60">
        <div className="flex items-center justify-between border-b border-obsidian-700/50 pb-2">
          <span className="font-fantasy text-xs uppercase text-slate-400 font-bold">
            Tactical Command Deck (Round {combatState.round})
          </span>
          {combatState.lastSynergy?.name && (
            <span className="font-pixel text-[9px] bg-cyan-950 text-cyan-300 border border-cyan-500 px-2 py-0.5 rounded animate-pulse">
              {combatState.lastSynergy.name}
            </span>
          )}
        </div>

        {combatState.isOver ? (
          <div className="flex flex-col items-center justify-center p-6 gap-3 text-center">
            <h3 className={`font-fantasy font-black text-2xl tracking-wider ${
              combatState.playerWon ? 'text-amber-400' : 'text-rose-500'
            }`}>
              {combatState.playerWon ? 'VICTORY ACHIEVED!' : 'FALLEN IN BATTLE'}
            </h3>
            <p className="text-xs text-slate-300 max-w-md">
              {combatState.playerWon
                ? `You have slain the ${enemyDef.name}! Rewards have been added to your inventory.`
                : 'The darkness claimed you. Regroup and return stronger!'}
            </p>
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => restartBattle()}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-obsidian-950 font-fantasy font-bold rounded-lg rpg-btn shadow-lg text-xs"
              >
                Fight Again
              </button>
              <button
                onClick={() => {
                  const nextIdx = (enemiesCatalog.indexOf(enemyDef) + 1) % enemiesCatalog.length;
                  restartBattle(enemiesCatalog[nextIdx]);
                }}
                className="px-5 py-2.5 bg-obsidian-800 hover:bg-obsidian-700 text-slate-200 font-fantasy font-semibold rounded-lg rpg-btn text-xs border border-obsidian-600"
              >
                Next Enemy
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <button
              onClick={() => handlePlayerAction('attack')}
              className="py-3 px-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-lg font-fantasy text-xs font-bold tracking-wider flex items-center justify-center gap-2 rpg-btn shadow-lg"
            >
              <SwordsCrossedIcon className="w-4 h-4" />
              <span>Strike</span>
            </button>

            <button
              onClick={() => handlePlayerAction('defend')}
              className="py-3 px-3 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 text-white rounded-lg font-fantasy text-xs font-bold tracking-wider flex items-center justify-center gap-2 rpg-btn shadow-lg"
            >
              <ShieldIcon className="w-4 h-4" />
              <span>Guard (-55%)</span>
            </button>

            <button
              onClick={() => handlePlayerAction('parry')}
              className="py-3 px-3 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-obsidian-950 rounded-lg font-fantasy text-xs font-bold tracking-wider flex items-center justify-center gap-2 rpg-btn shadow-lg"
            >
              <ElementLightningIcon className="w-4 h-4 text-obsidian-950" />
              <span>Parry Counter</span>
            </button>

            <button
              onClick={() => {
                const potion = player.inventory.find(i => i.itemId.includes('health'));
                if (potion) {
                  setCombatState(prev => ({
                    ...prev,
                    playerHp: Math.min(prev.playerMaxHp, prev.playerHp + 60),
                    combatLog: [...prev.combatLog, '🧪 Consumed Minor Health Flask! +60 HP']
                  }));
                } else {
                  alert('No health potions in your bag! Visit the town merchant.');
                }
              }}
              className="py-3 px-3 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-600 hover:to-teal-600 text-white rounded-lg font-fantasy text-xs font-bold tracking-wider flex items-center justify-center gap-2 rpg-btn shadow-lg"
            >
              <PotionRedIcon className="w-4 h-4" />
              <span>Drink Potion</span>
            </button>
          </div>
        )}

        {/* Combat History Log */}
        <div className="bg-obsidian-950/80 rounded-lg p-3 border border-obsidian-800/80 max-h-36 overflow-y-auto font-mono text-[11px] space-y-1 scrollbar-thin">
          {combatState.combatLog.map((log, idx) => (
            <div key={idx} className="text-slate-300 leading-relaxed border-b border-obsidian-900/60 pb-0.5 last:border-0">
              {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
