import React from 'react';
import {
  type CyberPerkId,
  type CyberpunkGameState,
  buyPerk,
  canBuyPerk,
  CYBER_PERKS,
} from '@arcanora/core';
import { sounds } from './engine3d/SoundManager.js';

interface ClinicModalProps {
  state: CyberpunkGameState;
  onUpdateState: (newState: CyberpunkGameState) => void;
  onClose: () => void;
}

export const ClinicModal: React.FC<ClinicModalProps> = ({
  state,
  onUpdateState,
  onClose,
}) => {
  const handleBuyPerk = (perkId: CyberPerkId) => {
    const res = buyPerk(state, perkId);
    if (res.success) {
      sounds.playPerkAcquired();
      onUpdateState(res.newState);
    }
  };

  const handleSynthesizeStim = () => {
    if (state.player.credits >= 100 && state.player.scrap >= 5) {
      onUpdateState({
        ...state,
        player: {
          ...state.player,
          credits: state.player.credits - 100,
          scrap: state.player.scrap - 5,
          medStims: state.player.medStims + 1,
        },
      });
    }
  };

  return (
    <div className="cyber-modal-overlay">
      <div className="cyber-modal-box" style={{ maxWidth: 720 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: 12 }}>
          <div>
            <span style={{ color: '#10b981', fontSize: 12, fontWeight: 'bold' }}>SECTOR 03 // DR. VANE’S CLINIC</span>
            <h2 style={{ margin: '4px 0 0 0', color: '#ffffff', fontSize: 22 }}>BIO-SYNTHETIC PERK TERMINAL</h2>
          </div>
          <button className="cyber-btn-secondary" onClick={onClose}>[ESC] CLOSE</button>
        </div>

        {/* Perk-a-Colas Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '16px 0', maxHeight: 360, overflowY: 'auto' }}>
          {(Object.keys(CYBER_PERKS) as CyberPerkId[]).map((perkId) => {
            const perk = CYBER_PERKS[perkId];
            const isInstalled = state.player.activePerks.includes(perkId);
            const check = canBuyPerk(state.player, perkId);
            const cost = perk.cost.credits || 0;

            return (
              <div
                key={perkId}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: isInstalled ? 'rgba(16, 185, 129, 0.12)' : 'rgba(15, 23, 42, 0.7)',
                  border: isInstalled ? '1px solid #10b981' : '1px solid #334155',
                  padding: 12,
                  borderRadius: 4,
                }}
              >
                <div>
                  <div style={{ color: isInstalled ? '#10b981' : '#38bdf8', fontSize: 16, fontWeight: 'bold' }}>
                    {perk.name} {isInstalled ? '✦ [INSTALLED]' : ''}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>
                    {perk.description}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 140, justifyContent: 'flex-end' }}>
                  {!isInstalled ? (
                    <button
                      className="cyber-btn-primary"
                      disabled={!check.canBuy}
                      onClick={() => handleBuyPerk(perkId)}
                      style={{
                        background: '#10b981',
                        color: '#050814',
                        opacity: check.canBuy ? 1 : 0.5,
                        cursor: check.canBuy ? 'pointer' : 'not-allowed',
                      }}
                    >
                      GRAFT ({cost} CR)
                    </button>
                  ) : (
                    <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: 13 }}>ACTIVE</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Synthesize Med-Stim Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #334155', paddingTop: 14 }}>
          <div>
            <div style={{ color: '#ffffff', fontWeight: 'bold' }}>Trauma Med-Stim Pod</div>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Emergency adrenaline stim for healing comrades or safehouse revival.</div>
          </div>
          <button
            className="cyber-btn-secondary"
            onClick={handleSynthesizeStim}
            disabled={state.player.credits < 100 || state.player.scrap < 5}
            style={{ borderColor: '#10b981', color: '#10b981' }}
          >
            SYNTHESIZE (100 CR + 5 SCRAP)
          </button>
        </div>
      </div>
    </div>
  );
};
