import React from 'react';
import type { CyberpunkGameState } from '@arcanora/core';
import type { RaycastInteraction } from './engine3d/types3d.js';

interface CyberHUDProps {
  state: CyberpunkGameState;
  interaction: RaycastInteraction;
  hitmarker: { active: boolean; isHeadshot: boolean } | null;
  isLocked: boolean;
  onUnlockPointer: () => void;
}

export const CyberHUD: React.FC<CyberHUDProps> = ({
  state,
  interaction,
  hitmarker,
  isLocked,
}) => {
  const { player, raidState } = state;
  const weapon = player.equippedWeapon;

  const shieldRatio = Math.max(0, Math.min(1, player.shield / player.maxShield));
  const hpRatio = Math.max(0, Math.min(1, player.hp / player.maxHp));
  const threatRatio = Math.max(0, Math.min(1, raidState.threatLevel / 100));

  return (
    <div className="cyber-hud-overlay">
      {/* Top Left: Wave / Round Display */}
      <div className="cyber-wave-display" style={{ position: 'absolute', top: 16, left: 16 }}>
        <div style={{ color: '#ef4444', fontSize: 26, fontWeight: '900', letterSpacing: '2px', textShadow: '0 0 12px rgba(239, 68, 68, 0.6)' }}>
          ROUND {state.stats.currentWave || 1}
        </div>
        <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}>
          PLATFORM 04 // DEFENSE
        </div>
      </div>

      {/* Top Threat / Raid Status */}
      <div className="cyber-threat-bar">
        <span style={{ color: raidState.isActive ? '#ef4444' : '#94a3b8', fontSize: 13, fontWeight: 'bold' }}>
          {raidState.isActive ? 'CORPORATE BREACH RAID ACTIVE' : 'BREACH THREAT'}
        </span>
        <div className="cyber-threat-meter">
          <div
            className="cyber-threat-fill"
            style={{
              width: `${threatRatio * 100}%`,
              background: raidState.isActive ? '#ef4444' : undefined,
            }}
          />
        </div>
        <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 'bold' }}>
          {raidState.isActive ? 'DEFEND BULKHEADS' : `${Math.round(raidState.threatLevel)}%`}
        </span>
      </div>

      {/* Top Right Resources */}
      <div className="cyber-resources-panel" style={{ alignSelf: 'flex-end' }}>
        <div className="cyber-resource-item" style={{ color: '#38bdf8' }}>
          <span>CREDITS:</span>
          <span>{player.credits}</span>
        </div>
        <div className="cyber-resource-item" style={{ color: '#f59e0b' }}>
          <span>SCRAP:</span>
          <span>{player.scrap}</span>
        </div>
        <div className="cyber-resource-item" style={{ color: '#a855f7' }}>
          <span>KEYS:</span>
          <span>{player.decryptKeys}</span>
        </div>
        <div className="cyber-resource-item" style={{ color: '#10b981' }}>
          <span>STIMS:</span>
          <span>{player.medStims}</span>
        </div>
      </div>

      {/* Center Reticle & Crosshair */}
      <div className="cyber-crosshair">
        <div className="cyber-crosshair-dot" />
        <div className="cyber-crosshair-line top" />
        <div className="cyber-crosshair-line bottom" />
        <div className="cyber-crosshair-line left" />
        <div className="cyber-crosshair-line right" />
      </div>

      {/* Hitmarker Flash */}
      {hitmarker?.active && (
        <div className={`cyber-hitmarker ${hitmarker.isHeadshot ? 'headshot' : ''}`}>
          <div className="cyber-hitmarker-tick top" />
          <div className="cyber-hitmarker-tick bottom" />
          <div className="cyber-hitmarker-tick left" />
          <div className="cyber-hitmarker-tick right" />
        </div>
      )}

      {/* COD Zombies Style Interaction Prompt */}
      {interaction.type !== 'none' && (
        <div className="cyber-interact-prompt">
          {interaction.prompt}
        </div>
      )}

      {/* Weapon Quick Slots Bar */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 12 }}>
        {player.inventoryWeapons.map((w, idx) => {
          const isSelected = w.baseId === weapon.baseId;
          return (
            <div
              key={w.baseId}
              style={{
                background: isSelected ? 'rgba(6, 182, 212, 0.25)' : 'rgba(15, 23, 42, 0.75)',
                border: isSelected ? `2px solid ${w.neonColor}` : '1px solid #334155',
                padding: '4px 8px',
                borderRadius: 4,
                fontSize: 11,
                color: isSelected ? '#ffffff' : '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: isSelected ? `0 0 10px ${w.neonColor}` : undefined,
              }}
            >
              <span style={{ color: w.neonColor, fontWeight: 'bold' }}>[{idx + 1}]</span>
              <span>{w.name.split(' ')[0]}</span>
              {w.tier > 0 && <span style={{ color: '#f59e0b', fontSize: 9 }}>T{w.tier}</span>}
            </div>
          );
        })}
      </div>

      {/* Bottom Area: Left Player Bars & Right Ammo */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', width: '100%' }}>
        {/* Left: Vitals & Perks */}
        <div className="cyber-hud-left">
          {/* Kinetic Shield */}
          <div className="cyber-stat-bar-container">
            <div className="cyber-stat-header">
              <span>KINETIC SHIELD</span>
              <span style={{ color: '#00f0ff' }}>{player.shield} / {player.maxShield}</span>
            </div>
            <div className="cyber-bar-track">
              <div className="cyber-bar-shield" style={{ width: `${shieldRatio * 100}%` }} />
            </div>
          </div>

          {/* Bio Integrity HP */}
          <div className="cyber-stat-bar-container">
            <div className="cyber-stat-header">
              <span>BIO-INTEGRITY</span>
              <span style={{ color: '#ef4444' }}>{player.hp} / {player.maxHp}</span>
            </div>
            <div className="cyber-bar-track">
              <div className="cyber-bar-hp" style={{ width: `${hpRatio * 100}%` }} />
            </div>
          </div>

          {/* Active Cyber-Perks */}
          {player.activePerks.length > 0 && (
            <div className="cyber-perk-row">
              {player.activePerks.map((perkId) => (
                <div key={perkId} className="cyber-perk-badge">
                  {perkId.replace('_', ' ').toUpperCase()}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Weapon & Ammo */}
        <div className="cyber-hud-right">
          <div className="cyber-weapon-title" style={{ color: weapon.neonColor }}>
            {weapon.name} {weapon.tier > 0 ? `[TIER ${weapon.tier}]` : ''}
          </div>
          {weapon.elementalEffect !== 'none' && (
            <div style={{ color: weapon.neonColor, fontSize: 12, fontWeight: 'bold' }}>
              ✦ {weapon.elementalEffect.toUpperCase()} DAMAGE OVERCLOCK
            </div>
          )}
          <div className="cyber-ammo-counter">
            <span>{weapon.currentAmmo}</span>
            <span className="cyber-ammo-sub">/ {weapon.magazineSize}</span>
          </div>
          {weapon.currentAmmo === 0 && (
            <div style={{ color: '#ef4444', fontSize: 14, fontWeight: 'bold', animation: 'blink 0.8s infinite' }}>
              [R] RELOAD WEAPON
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
