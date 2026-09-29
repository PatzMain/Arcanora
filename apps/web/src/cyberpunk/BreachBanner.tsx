import React from 'react';
import type { CyberpunkGameState } from '@arcanora/core';

interface BreachBannerProps {
  state: CyberpunkGameState;
}

export const BreachBanner: React.FC<BreachBannerProps> = ({ state }) => {
  const { raidState } = state;
  const targetDoor = raidState.targetDoorId ? state.doors[raidState.targetDoorId] : null;

  if (!raidState.isActive && !raidState.lastReport) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 70,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 25,
        pointerEvents: 'none',
      }}
    >
      {raidState.isActive && targetDoor && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.9)',
            border: '2px solid #ffffff',
            padding: '8px 24px',
            borderRadius: 4,
            boxShadow: '0 0 20px #ef4444',
            color: '#ffffff',
            textAlign: 'center',
            fontWeight: 'bold',
            letterSpacing: '1px',
            animation: 'pulseAlert 1s infinite alternate',
          }}
        >
          <div style={{ fontSize: 16 }}>⚠️ CORPORATE BREACH IN PROGRESS ⚠️</div>
          <div style={{ fontSize: 13, marginTop: 2, color: '#fef2f2' }}>
            DROIDS ASSAULTING: {targetDoor.name.toUpperCase()} (INTEGRITY: {Math.round(targetDoor.integrity)}%)
          </div>
        </div>
      )}

      {!raidState.isActive && raidState.lastReport && (
        <div
          style={{
            background: raidState.lastReport.repelled ? 'rgba(34, 197, 94, 0.9)' : 'rgba(220, 38, 38, 0.9)',
            border: '1px solid #ffffff',
            padding: '6px 20px',
            borderRadius: 4,
            color: '#ffffff',
            fontSize: 13,
            fontWeight: 'bold',
            textAlign: 'center',
          }}
        >
          {raidState.lastReport.summary}
        </div>
      )}
    </div>
  );
};
