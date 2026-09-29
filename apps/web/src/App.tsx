import { useState } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import { HeaderHUD } from './components/layout/HeaderHUD';
import { WorldMapCanvas } from './components/world/WorldMapCanvas';
import { BattleArena } from './components/combat/BattleArena';
import { DungeonCrawler } from './components/dungeon/DungeonCrawler';
import { InventoryView } from './components/inventory/InventoryView';
import { DevSandboxToolbar } from './components/layout/DevSandboxToolbar';
import { CampaignGame } from './campaign/CampaignGame';
import { freshCampaign, loadCampaign, saveCampaign } from './campaign/save';
import type { CampaignState } from '@arcanora/core';
import { CyberpunkFpsGame } from './cyberpunk/CyberpunkFpsGame.js';
import './campaign/campaign.css';

function DemoContent() {
  const { activeTab } = useGame();
  return <main className="max-w-7xl mx-auto px-3 py-4 flex-1 flex flex-col items-center justify-center w-full">
    {activeTab === 'map' && <WorldMapCanvas />}
    {activeTab === 'combat' && <BattleArena />}
    {activeTab === 'dungeon' && <DungeonCrawler />}
    {activeTab === 'inventory' && <InventoryView />}
    {import.meta.env.DEV && activeTab === 'sandbox' && <div className="rpg-panel rounded-xl p-6 max-w-xl text-center">Developer laboratory</div>}
  </main>;
}

function ExistingAdventure({ onTitle }: { onTitle: () => void }) {
  return <GameProvider><div className="min-h-screen flex flex-col text-slate-100 bg-obsidian-950 font-sans">
    <div style={{ padding: '10px 16px', background: '#17201d' }}><button className="camp-button small" onClick={onTitle}>← Return to title</button></div>
    <HeaderHUD/><DemoContent/>{import.meta.env.DEV && <DevSandboxToolbar/>}
    <footer className="camp-footer">Existing Adventure</footer>
  </div></GameProvider>;
}

type Screen = 'title' | 'campaign' | 'demo' | 'cyberpunk_fps';
const SETTINGS_KEY = 'arcanora_display_settings_v1';

function loadMotionSetting(): boolean {
  try { return localStorage.getItem(SETTINGS_KEY) === 'reduced'; }
  catch { return false; }
}

export default function App() {
  const [loaded, setLoaded] = useState(loadCampaign);
  const [screen, setScreen] = useState<Screen>('cyberpunk_fps');
  const [name, setName] = useState('');
  const [starting, setStarting] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(loadMotionSetting);
  const [message, setMessage] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<CampaignState | null>(null);
  const [saveProblem, setSaveProblem] = useState(false);

  function begin() {
    if ((loaded.state || loaded.error) && !confirmNew) { setConfirmNew(true); return; }
    try {
      const next = freshCampaign(name);
      setCampaign(next);
      setLoaded({ state: next, error: null });
      const failure = saveCampaign(next);
      setMessage(failure);
      setSaveProblem(Boolean(failure));
      setScreen('campaign');
    } catch { setMessage('The refuge could not begin. Please try again.'); }
  }

  function continueCampaign() {
    if (saveProblem && campaign) { setMessage(null); setScreen('campaign'); return; }
    const next = loadCampaign();
    setLoaded(next);
    if (!next.state) { setMessage(next.error || 'There is no campaign to continue yet.'); return; }
    setCampaign(next.state);
    setMessage(null);
    setScreen('campaign');
  }

  function changeMotion(value: boolean) {
    setReduceMotion(value);
    try { localStorage.setItem(SETTINGS_KEY, value ? 'reduced' : 'standard'); }
    catch { setMessage('This setting could not be remembered on this device.'); }
  }

  if (screen === 'cyberpunk_fps') return <CyberpunkFpsGame onReturnToTitle={() => setScreen('title')}/>;
  if (screen === 'demo') return <ExistingAdventure onTitle={() => setScreen('title')}/>;
  if (screen === 'campaign' && campaign) return <CampaignGame key={campaign.seed} initialState={campaign} onTitle={() => { if (!saveProblem) setLoaded(loadCampaign()); setScreen('title'); }} onStateChange={(next, failure) => { setCampaign(next); setLoaded({ state:next, error:null }); setSaveProblem(Boolean(failure)); setMessage(failure); }} reducedMotion={reduceMotion} onMotionChange={changeMotion}/>;
  return <div className="campaign-app" data-reduced-motion={reduceMotion}>
    <main className="campaign-shell campaign-title">
      <div className="title-art"><img src="/icons/arcanora-emblem.svg" alt="An amber flame within a fractured teal ward beneath a stone arch"/></div>
      <div><span className="eyebrow">A refuge outside Oakhaven</span><h1>Arcanora</h1><p className="title-copy">The ward is fading. Gather the living, brace the barricade, and hold back the dead until dawn.</p>
        {(loaded.error || message) && <div className="camp-error" role="alert">{message || loaded.error}</div>}
        {!starting ? <div className="button-stack">
          <button className="camp-button primary" onClick={() => { setStarting(true); setConfirmNew(false); }}>Begin</button>
          <button className="camp-button" disabled={!loaded.state} onClick={continueCampaign}>Continue{loaded.state ? ` · ${loaded.state.hero.name}, night ${loaded.state.night}` : ''}</button>
          <button
            className="camp-button"
            style={{
              background: 'linear-gradient(90deg, #0369a1, #0891b2)',
              color: '#ffffff',
              fontWeight: 'bold',
              border: '1px solid #38bdf8',
            }}
            onClick={() => setScreen('cyberpunk_fps')}
          >
            Sector 0: 3D Cyberpunk FPS
          </button>
          <button className="camp-button" onClick={() => setScreen('demo')}>Existing Adventure</button>
          <button className="camp-button" onClick={() => setSettingsOpen(value => !value)} aria-expanded={settingsOpen}>Settings</button>
        </div> : <div className="camp-panel" style={{ marginTop: 28 }}><h2>Begin at the refuge</h2><p>Name your keeper, or leave this open and begin right away.</p><label className="camp-label">Keeper’s name<input className="camp-input" maxLength={40} value={name} onChange={event => setName(event.target.value)} placeholder="Optional" autoComplete="off"/></label>{confirmNew && <div className="camp-error" role="alert">Starting anew will replace your current campaign. Your Existing Adventure is separate.</div>}<div className="button-stack"><button className="camp-button primary" onClick={begin}>{confirmNew ? 'Replace campaign and begin' : 'Enter the refuge'}</button><button className="camp-button" onClick={() => { setStarting(false); setConfirmNew(false); }}>Back</button></div></div>}
        {settingsOpen && <section className="camp-panel" style={{ marginTop: 22 }}><h2>Settings</h2><label className="camp-label"><span>Motion</span><select className="camp-select" value={reduceMotion ? 'reduced' : 'standard'} onChange={event => changeMotion(event.target.value === 'reduced')}><option value="standard">Use device preference</option><option value="reduced">Reduce movement</option></select></label></section>}
        <p className="camp-muted" style={{ marginTop: 28 }}>A story of survival, spells, and the people who keep the light burning.</p>
      </div>
    </main>
  </div>;
}
