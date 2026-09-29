import React from 'react';
import {
  type ComradeRole,
  type CyberpunkGameState,
  assignComradeRole,
  healComrade,
} from '@arcanora/core';

interface ComradeModalProps {
  state: CyberpunkGameState;
  onUpdateState: (newState: CyberpunkGameState) => void;
  onClose: () => void;
}

export const ComradeModal: React.FC<ComradeModalProps> = ({
  state,
  onUpdateState,
  onClose,
}) => {
  const handleRoleChange = (comradeId: string, newRole: ComradeRole) => {
    const comrade = state.comrades.find((c) => c.id === comradeId);
    if (!comrade) return;

    const res = assignComradeRole(state, comradeId, newRole, comrade.assignedSector);
    if (res.success) {
      onUpdateState(res.newState);
    }
  };

  const handleHeal = (comradeId: string) => {
    const res = healComrade(state, comradeId);
    if (res.success) {
      onUpdateState(res.newState);
    }
  };

  return (
    <div className="cyber-modal-overlay">
      <div className="cyber-modal-box" style={{ maxWidth: 760 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: 12 }}>
          <div>
            <span style={{ color: '#38bdf8', fontSize: 12, fontWeight: 'bold' }}>BASE COMRADES & WORKSTATIONS</span>
            <h2 style={{ margin: '4px 0 0 0', color: '#ffffff', fontSize: 22 }}>RESCUED SURVIVORS ROSTER</h2>
          </div>
          <button className="cyber-btn-secondary" onClick={onClose}>[ESC] CLOSE</button>
        </div>

        {/* Comrades Roster */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: '16px 0', maxHeight: 380, overflowY: 'auto' }}>
          {state.comrades.map((comrade) => {
            const isInjured = comrade.status === 'injured';

            return (
              <div
                key={comrade.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: isInjured ? 'rgba(239, 68, 68, 0.1)' : 'rgba(15, 23, 42, 0.7)',
                  border: isInjured ? '1px solid #ef4444' : '1px solid #334155',
                  padding: 14,
                  borderRadius: 4,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#ffffff', fontSize: 16, fontWeight: 'bold' }}>
                      {comrade.name}
                    </span>
                    <span style={{ color: '#00f0ff', fontSize: 12 }}>"{comrade.handle}"</span>
                    {isInjured && (
                      <span style={{ color: '#ef4444', fontSize: 11, fontWeight: 'bold', background: 'rgba(239, 68, 68, 0.2)', padding: '2px 6px', borderRadius: 2 }}>
                        INJURED
                      </span>
                    )}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>
                    {comrade.specialty}
                  </div>
                  <div style={{ color: '#64748b', fontSize: 11, fontStyle: 'italic', marginTop: 2 }}>
                    "{comrade.quote}"
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {isInjured ? (
                    <button
                      className="cyber-btn-primary"
                      onClick={() => handleHeal(comrade.id)}
                      disabled={state.player.medStims < 1}
                      style={{ background: '#ef4444', color: '#ffffff' }}
                    >
                      HEAL (1 MED-STIM)
                    </button>
                  ) : (
                    <select
                      value={comrade.role}
                      onChange={(e) => handleRoleChange(comrade.id, e.target.value as ComradeRole)}
                      style={{
                        background: '#1e293b',
                        color: '#38bdf8',
                        border: '1px solid #00f0ff',
                        padding: '6px 12px',
                        borderRadius: 4,
                        fontWeight: 'bold',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="scrapper">Scrapper (+Scrap)</option>
                      <option value="netrunner">Netrunner (+Credits/Keys)</option>
                      <option value="ripperdoc">Ripperdoc (+Shield/Stims)</option>
                      <option value="enforcer">Enforcer (Door Defense)</option>
                      <option value="idle">Idle</option>
                    </select>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Tycoon Summary Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #334155', paddingTop: 14 }}>
          <div style={{ color: '#94a3b8', fontSize: 13 }}>
            Assigned comrades generate resources automatically every second while you defend Platform 04.
          </div>
        </div>
      </div>
    </div>
  );
};
