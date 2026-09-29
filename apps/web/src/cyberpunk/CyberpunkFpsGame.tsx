import React, { useEffect, useRef, useState } from 'react';
import {
  type CyberpunkGameState,
  createInitialCyberpunkGameState,
  processComradeTick,
  updateRaidThreatTick,
  processBreachDamageTick,
  repelRaid,
  revivePlayerAtClinic,
} from '@arcanora/core';
import { FpsScene } from './engine3d/FpsScene.js';
import type { RaycastInteraction } from './engine3d/types3d.js';
import { sounds } from './engine3d/SoundManager.js';
import { CyberHUD } from './CyberHUD.js';
import { ChopShopModal } from './ChopShopModal.js';
import { ClinicModal } from './ClinicModal.js';
import { ComradeModal } from './ComradeModal.js';
import { BreachBanner } from './BreachBanner.js';
import './cyberpunk.css';

const STORAGE_KEY = 'arcanora_cyberpunk_save_v1';

function loadSavedGame(): CyberpunkGameState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // fallback
  }
  return createInitialCyberpunkGameState();
}

function saveGame(state: CyberpunkGameState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

interface CyberpunkFpsGameProps {
  onReturnToTitle: () => void;
}

export const CyberpunkFpsGame: React.FC<CyberpunkFpsGameProps> = ({ onReturnToTitle }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fpsSceneRef = useRef<FpsScene | null>(null);

  const [state, setState] = useState<CyberpunkGameState>(loadSavedGame);
  const [isLocked, setIsLocked] = useState(false);
  const [currentInteraction, setCurrentInteraction] = useState<RaycastInteraction>({
    type: 'none',
    id: '',
    name: '',
    prompt: '',
    distance: 0,
  });
  const [hitmarker, setHitmarker] = useState<{ active: boolean; isHeadshot: boolean } | null>(null);
  const [activeModal, setActiveModal] = useState<'chop_shop' | 'clinic' | 'comrade' | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  // 1. Initialize Three.js FPS Engine
  useEffect(() => {
    if (!containerRef.current) return;

    const fpsScene = new FpsScene(containerRef.current, state, {
      onStateUpdate: (updater) => {
        setState((prev) => {
          const next = updater(prev);
          saveGame(next);
          return next;
        });
      },
      onOpenModal: (type) => {
        if (type === 'chop_shop' || type === 'clinic' || type === 'comrade') {
          if (document.pointerLockElement) {
            document.exitPointerLock();
          }
          setActiveModal(type);
        }
      },
      onPlayerHit: (isHeadshot) => {
        setHitmarker({ active: true, isHeadshot });
        setTimeout(() => setHitmarker(null), 120);
      },
    });

    fpsSceneRef.current = fpsScene;

    const checkLockInterval = setInterval(() => {
      if (fpsSceneRef.current) {
        setIsLocked(fpsSceneRef.current.controls.isLocked);
        setCurrentInteraction(fpsSceneRef.current.controls.getCurrentInteraction());
      }
    }, 50);

    return () => {
      clearInterval(checkLockInterval);
      fpsScene.destroy();
      fpsSceneRef.current = null;
    };
  }, []);

  // 2. Sync state updates back to Three.js FPS scene
  useEffect(() => {
    if (fpsSceneRef.current) {
      fpsSceneRef.current.updateGameState(state);
    }
  }, [state]);

  // 3. Tycoon & Raid Ticker (runs every 1 second)
  useEffect(() => {
    const ticker = setInterval(() => {
      setState((prev) => {
        // Comrade resource production tick
        const { newState: stateAfterComrades } = processComradeTick(prev, 1);

        // Raid Threat accumulation
        const { newState: stateAfterThreat, raidTriggered } = updateRaidThreatTick(stateAfterComrades, 1);

        // Breach door damage
        const { newState: stateAfterBreach } = processBreachDamageTick(stateAfterThreat, 1);

        // If raid is active and all droids defeated in 3D scene, repel raid
        let finalState = stateAfterBreach;
        if (
          stateAfterBreach.raidState.isActive &&
          fpsSceneRef.current &&
          fpsSceneRef.current.enemyDroids.droids.size === 0
        ) {
          const { newState: stateAfterRepel } = repelRaid(stateAfterBreach);
          finalState = stateAfterRepel;
        }

        saveGame(finalState);
        return finalState;
      });
    }, 1000);

    return () => clearInterval(ticker);
  }, []);

  // 4. Handle Player Downed Revival
  const handleDownedRevive = () => {
    const { newState } = revivePlayerAtClinic(state);
    setState(newState);
    saveGame(newState);
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    sounds.setMuted(nextMuted);
  };

  return (
    <div className="cyber-fps-container">
      {/* 3D WebGL Host Container */}
      <div ref={containerRef} className="cyber-canvas-host" />

      {/* CRT Scanline Shader Effect */}
      <div className="cyber-scanlines" />

      {/* Top Corporate Breach Alert Banner */}
      <BreachBanner state={state} />

      {/* HUD Overlays (Crosshair, Vitals, Ammo, COD-Zombies Prompt) */}
      <CyberHUD
        state={state}
        interaction={currentInteraction}
        hitmarker={hitmarker}
        isLocked={isLocked}
        onUnlockPointer={() => document.exitPointerLock()}
      />

      {/* Pointer Lock Start Overlay */}
      {!isLocked && !activeModal && !state.player.isDowned && (
        <div
          className="cyber-modal-overlay"
          style={{ background: 'rgba(5, 8, 20, 0.65)', cursor: 'pointer' }}
          onClick={() => {
            if (fpsSceneRef.current) {
              fpsSceneRef.current.renderer.domElement.requestPointerLock();
            }
          }}
        >
          <div className="cyber-modal-box" style={{ textAlign: 'center', maxWidth: 520 }}>
            <span style={{ color: '#00f0ff', fontSize: 13, fontWeight: 'bold' }}>
              PLATFORM 04 // DEFENSE STATION
            </span>
            <h1 style={{ color: '#ffffff', fontSize: 26, margin: '8px 0 16px 0' }}>
              SECTOR 0: 3D CYBERPUNK FPS
            </h1>
            <div
              style={{
                background: '#00f0ff',
                color: '#050814',
                padding: '12px 24px',
                fontWeight: 'bold',
                fontSize: 16,
                borderRadius: 4,
                display: 'inline-block',
                boxShadow: '0 0 15px #00f0ff',
              }}
            >
              CLICK TO LOCK CONTROLS
            </div>
            <div style={{ marginTop: 20, color: '#94a3b8', fontSize: 12, lineHeight: '1.6' }}>
              <b>[W, A, S, D]</b> Walk & Strafe &bull; <b>[MOUSE]</b> Look &bull; <b>[LEFT CLICK]</b> Fire Weapon<br />
              <b>[R]</b> Reload &bull; <b>[SPACE]</b> Jump &bull; <b>[SHIFT]</b> Sprint &bull; <b>[E]</b> Interact (Doors/Lathe/Comrades)
            </div>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 12 }}>
              <button
                className="cyber-btn-secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMute();
                }}
              >
                {isMuted ? '🔇 UNMUTE AUDIO' : '🔊 MUTE AUDIO'}
              </button>
              <button
                className="cyber-btn-secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  onReturnToTitle();
                }}
              >
                ← RETURN TO TITLE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Downed / Trauma Revival Screen */}
      {state.player.isDowned && (
        <div className="cyber-modal-overlay">
          <div className="cyber-modal-box" style={{ textAlign: 'center', maxWidth: 480, border: '2px solid #ef4444' }}>
            <h2 style={{ color: '#ef4444', fontSize: 24, margin: '0 0 8px 0' }}>
              ⚠️ VITAL SIGNS COLLAPSED ⚠️
            </h2>
            <p style={{ color: '#94a3b8', fontSize: 14 }}>
              Your bio-dermal layer failed. Safehouse emergency medical trauma pods stand ready in Platform 04.
            </p>
            <div style={{ margin: '20px 0' }}>
              <button
                className="cyber-btn-primary"
                onClick={handleDownedRevive}
                style={{ background: '#ef4444', color: '#ffffff', width: '100%' }}
              >
                {state.player.medStims > 0
                  ? `INJECT MED-STIM & REVIVE (${state.player.medStims} REMAINING)`
                  : 'EMERGENCY CLINIC RESUSCITATION (-10% CREDITS)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chop-Shop Lathe Modal ("Pack-a-Punch") */}
      {activeModal === 'chop_shop' && (
        <ChopShopModal
          state={state}
          onUpdateState={(next) => {
            setState(next);
            saveGame(next);
          }}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* Ripperdoc Clinic Modal ("Perk-a-Colas") */}
      {activeModal === 'clinic' && (
        <ClinicModal
          state={state}
          onUpdateState={(next) => {
            setState(next);
            saveGame(next);
          }}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* Rescued Comrades Modal */}
      {activeModal === 'comrade' && (
        <ComradeModal
          state={state}
          onUpdateState={(next) => {
            setState(next);
            saveGame(next);
          }}
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  );
};
