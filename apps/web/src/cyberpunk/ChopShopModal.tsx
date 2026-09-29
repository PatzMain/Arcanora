import React from 'react';
import {
  type CyberpunkGameState,
  type WeaponId,
  canOverclockWeapon,
  overclockWeapon,
  switchWeapon,
  WEAPON_DEFINITIONS,
} from '@arcanora/core';
import { sounds } from './engine3d/SoundManager.js';

interface ChopShopModalProps {
  state: CyberpunkGameState;
  onUpdateState: (newState: CyberpunkGameState) => void;
  onClose: () => void;
}

export const ChopShopModal: React.FC<ChopShopModalProps> = ({
  state,
  onUpdateState,
  onClose,
}) => {
  const currentWeapon = state.player.equippedWeapon;
  const nextTier = (currentWeapon.tier < 3 ? currentWeapon.tier + 1 : null) as (1 | 2 | 3 | null);
  const nextStats = nextTier !== null ? WEAPON_DEFINITIONS[currentWeapon.baseId][nextTier] : null;

  const overclockCheck = canOverclockWeapon(state.player, currentWeapon);

  const handleOverclock = () => {
    const res = overclockWeapon(state);
    if (res.success) {
      sounds.playOverclock();
      onUpdateState(res.newState);
    }
  };

  const handleSwitchWeapon = (baseId: WeaponId) => {
    const res = switchWeapon(state, baseId);
    if (res.success) {
      onUpdateState(res.newState);
    }
  };

  return (
    <div className="cyber-modal-overlay">
      <div className="cyber-modal-box">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: 12 }}>
          <div>
            <span style={{ color: '#f97316', fontSize: 12, fontWeight: 'bold' }}>SECTOR 02 // MUNITIONS LATHE</span>
            <h2 style={{ margin: '4px 0 0 0', color: '#ffffff', fontSize: 22 }}>CHOP-SHOP OVERCLOCK BENCH</h2>
          </div>
          <button className="cyber-btn-secondary" onClick={onClose}>[ESC] CLOSE</button>
        </div>

        {/* Weapon Selection Tabs */}
        <div style={{ display: 'flex', gap: 8, margin: '16px 0' }}>
          {(['scrap_pistol', 'auto_shotgun', 'kinetic_smg', 'heavy_rail_rifle'] as WeaponId[]).map((baseId) => {
            const w = state.player.inventoryWeapons.find((inv) => inv.baseId === baseId);
            const isEquipped = currentWeapon.baseId === baseId;
            return (
              <button
                key={baseId}
                onClick={() => handleSwitchWeapon(baseId)}
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  background: isEquipped ? '#1e293b' : 'rgba(15, 23, 42, 0.6)',
                  border: isEquipped ? `2px solid ${w?.neonColor || '#38bdf8'}` : '1px solid #334155',
                  color: isEquipped ? '#ffffff' : '#94a3b8',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: 12,
                }}
              >
                {w?.name.split(' ')[0]} {w && w.tier > 0 ? `+${w.tier}` : ''}
              </button>
            );
          })}
        </div>

        {/* Current Weapon Stats vs Next Tier */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, margin: '16px 0', background: 'rgba(15, 23, 42, 0.7)', padding: 16, borderRadius: 4, border: '1px solid #1e293b' }}>
          <div>
            <span style={{ color: '#94a3b8', fontSize: 12 }}>CURRENT EQUIPPED</span>
            <div style={{ color: currentWeapon.neonColor, fontSize: 18, fontWeight: 'bold', margin: '4px 0' }}>
              {currentWeapon.name} [TIER {currentWeapon.tier}]
            </div>
            <div style={{ fontSize: 13, color: '#cbd5e1', lineHeight: '1.6' }}>
              <div>Damage: <b style={{ color: '#ffffff' }}>{currentWeapon.damage}</b></div>
              <div>Magazine: <b style={{ color: '#ffffff' }}>{currentWeapon.magazineSize} rounds</b></div>
              <div>Fire Rate: <b style={{ color: '#ffffff' }}>{currentWeapon.fireRate}ms</b></div>
              <div>Elemental: <b style={{ color: currentWeapon.neonColor }}>{currentWeapon.elementalEffect.toUpperCase()}</b></div>
            </div>
          </div>

          <div>
            <span style={{ color: '#f97316', fontSize: 12 }}>OVERCLOCK UPGRADE</span>
            {nextStats ? (
              <>
                <div style={{ color: nextStats.neonColor, fontSize: 18, fontWeight: 'bold', margin: '4px 0' }}>
                  {nextStats.name} [TIER {nextStats.tier}]
                </div>
                <div style={{ fontSize: 13, color: '#cbd5e1', lineHeight: '1.6' }}>
                  <div>Damage: <b style={{ color: '#4ade80' }}>{nextStats.damage} (+{nextStats.damage - currentWeapon.damage})</b></div>
                  <div>Magazine: <b style={{ color: '#4ade80' }}>{nextStats.magazineSize} rounds</b></div>
                  <div>Fire Rate: <b style={{ color: '#4ade80' }}>{nextStats.fireRate}ms</b></div>
                  <div>Elemental: <b style={{ color: nextStats.neonColor }}>{nextStats.elementalEffect.toUpperCase()}</b></div>
                </div>
              </>
            ) : (
              <div style={{ color: '#f59e0b', marginTop: 12, fontWeight: 'bold' }}>
                ✦ MAXIMUM OVERCLOCK ACHIEVED
              </div>
            )}
          </div>
        </div>

        {/* Overclock Action Button & Cost */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
          {currentWeapon.overclockCost && nextStats ? (
            <div style={{ display: 'flex', gap: 16 }}>
              <span style={{ color: state.player.credits >= (currentWeapon.overclockCost.credits || 0) ? '#38bdf8' : '#ef4444', fontWeight: 'bold' }}>
                CREDITS: {currentWeapon.overclockCost.credits || 0}
              </span>
              <span style={{ color: state.player.scrap >= (currentWeapon.overclockCost.scrap || 0) ? '#f59e0b' : '#ef4444', fontWeight: 'bold' }}>
                TECH SCRAP: {currentWeapon.overclockCost.scrap || 0}
              </span>
            </div>
          ) : (
            <div />
          )}

          {nextStats && (
            <button
              className="cyber-btn-primary"
              disabled={!overclockCheck.canOverclock}
              onClick={handleOverclock}
              style={{
                opacity: overclockCheck.canOverclock ? 1 : 0.5,
                cursor: overclockCheck.canOverclock ? 'pointer' : 'not-allowed',
                background: '#f97316',
                color: '#ffffff',
              }}
            >
              ⚡ PACK-A-PUNCH OVERCLOCK
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
