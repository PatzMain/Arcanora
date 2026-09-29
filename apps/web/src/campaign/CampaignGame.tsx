import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CAMPAIGN_CATALOG,
  CAMPAIGN_SOURCE,
  previewCampaignAction,
  resolveCampaignAction,
  type CampaignAction,
  type CampaignPreview,
  type CampaignState,
  type CampaignEnemy,
  type HeroAction,
  type Resources,
  type WorkerRole,
} from '@arcanora/core';
import { saveCampaign } from './save.js';
import './campaign.css';

type CatalogEntry = { id: string; name?: string; label?: string; text?: string; description?: string; cost?: Partial<Resources>; risk?: string | number; reward?: string; [key: string]: unknown };
type View = 'refuge' | 'hero' | 'region' | 'journal';
type Props = { initialState: CampaignState; onTitle: () => void; onStateChange: (state: CampaignState, saveError: string | null) => void; reducedMotion: boolean; onMotionChange: (value: boolean) => void };

function catalogRows(key: string): CatalogEntry[] {
  const value = (CAMPAIGN_CATALOG as unknown as Record<string, unknown>)[key];
  const source = (CAMPAIGN_SOURCE as unknown as Record<string, unknown>)[key];
  const rows = Array.isArray(value) ? value as CatalogEntry[] : value && typeof value === 'object' ? Object.values(value as Record<string, CatalogEntry>) : [];
  const descriptions = Array.isArray(source) ? source as CatalogEntry[] : [];
  return rows.map(row => ({ ...row, ...descriptions.find(item => item.id === row.id) }));
}

function human(id: string): string {
  return id.replace(/[_-]/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function details(entry: CatalogEntry): string {
  return entry.description || entry.text || [entry.risk !== undefined && `Risk: ${entry.risk}`, entry.reward && `Reward: ${entry.reward}`].filter(Boolean).join(' · ');
}

function resourceText(resources: Partial<Resources> | undefined): string {
  if (!resources) return '';
  return (['timber', 'provisions', 'essence'] as const).filter(key => (resources[key] || 0) > 0).map(key => `${resources[key]} ${key}`).join(' · ');
}

function Preview({ value }: { value: CampaignPreview | null }) {
  if (!value) return null;
  return <div className={value.valid ? 'camp-preview' : 'camp-error'} role="status">
    {value.valid ? value.description : value.reason || 'This action is unavailable.'}
    {value.valid && <div className="camp-muted">{value.timeCost ? `${value.timeCost} turn${value.timeCost === 1 ? '' : 's'}` : 'No time passes'}{resourceText(value.cost) && ` · Costs ${resourceText(value.cost)}`}{resourceText(value.production) && ` · Next production ${resourceText(value.production)}`}</div>}
  </div>;
}

function Meter({ label, value, max, ward = false }: { label: string; value: number; max: number; ward?: boolean }) {
  return <div><div className="camp-muted">{label}: {value} / {max}</div><progress className={`camp-meter${ward ? ' ward' : ''}`} value={Math.max(0, value)} max={Math.max(1, max)} aria-label={label} /></div>;
}

function ActionButton({ action, label, description, dispatch, preview, primary = false, selected = false }: {
  action: CampaignAction; label: string; description?: string;
  dispatch: (action: CampaignAction) => void; preview: (action: CampaignAction) => CampaignPreview;
  primary?: boolean; selected?: boolean;
}) {
  const result = preview(action);
  return <button type="button" className={`camp-button${primary ? ' primary' : ''}${selected ? ' selected' : ''}`} disabled={!result.valid} title={result.valid ? result.description : result.reason} onClick={() => dispatch(action)}>
    <strong>{label}</strong>{description && <span className="camp-muted" style={{ display: 'block' }}>{description}</span>}
    <span className="camp-muted" style={{ display: 'block' }}>{result.valid ? `${result.timeCost ? `${result.timeCost} turn${result.timeCost === 1 ? '' : 's'}` : 'Free'}${resourceText(result.cost) ? ` · ${resourceText(result.cost)}` : ''}` : result.reason}</span>
  </button>;
}

export function CampaignGame({ initialState, onTitle, onStateChange, reducedMotion, onMotionChange }: Props) {
  const [state, setState] = useState(initialState);
  const current = useRef(initialState);
  const [view, setView] = useState<View>('refuge');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [targetId, setTargetId] = useState('');
  const [inspected, setInspected] = useState<CampaignAction | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const enemies = state.combat?.enemies.filter(enemy => enemy.hp > 0) || [];
  const target = enemies.some(enemy => enemy.instanceId === targetId) ? targetId : enemies[0]?.instanceId || '';

  useEffect(() => { if (inspected) confirmRef.current?.focus(); }, [inspected]);

  function closeConfirm() { setInspected(null); returnFocus.current?.focus(); }

  function confirmKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') { event.preventDefault(); closeConfirm(); }
    if (event.key === 'Tab') {
      if (event.shiftKey && document.activeElement === confirmRef.current) { event.preventDefault(); cancelRef.current?.focus(); }
      else if (!event.shiftKey && document.activeElement === cancelRef.current) { event.preventDefault(); confirmRef.current?.focus(); }
    }
  }

  function preview(action: CampaignAction): CampaignPreview {
    try { return previewCampaignAction(state, action); }
    catch { return { valid: false, reason: 'This choice is unavailable right now.', timeCost: 0, cost: { timber: 0, provisions: 0, essence: 0 }, production: { timber: 0, provisions: 0, essence: 0 }, description: '' }; }
  }

  function dispatch(action: CampaignAction) {
    if (action.type === 'endTurn') action = { ...action, expectedRevision: current.current.revision, actionId: `turn-${current.current.revision + 1}` };
    const checked = previewCampaignAction(current.current, action);
    if (!checked.valid) { setError(checked.reason || 'That action is unavailable.'); return; }
    try {
      const result = resolveCampaignAction(current.current, action);
      current.current = result.state;
      setState(result.state);
      const saveError = saveCampaign(result.state);
      setError(saveError);
      onStateChange(result.state, saveError);
      setNotice(result.events.slice(-2).join(' ') || null);
      setInspected(null);
      if (action.type === 'startExpedition') setView('region');
      if (action.type === 'claimReward' || action.type === 'retreat') setView('refuge');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The action could not be completed.');
    }
  }

  function choose(action: CampaignAction) {
    const result = preview(action);
    if (!result.valid) { setError(result.reason || 'That action is unavailable.'); return; }
    if (result.timeCost > 0 || action.type === 'beginWave' || action.type === 'startExpedition') { returnFocus.current = document.activeElement as HTMLElement; setInspected(action); }
    else dispatch(action);
  }

  const hero = state.hero;
  const refuge = state.refuge;
  const attempt = state.attempt;
  const buildingRows = useMemo(() => catalogRows('buildings'), []);
  const upgradeRows = useMemo(() => catalogRows('upgrades'), []);
  const spellRows = useMemo(() => catalogRows('spells'), []);
  const enemyRows = useMemo(() => catalogRows('enemies'), []);
  const itemRows = useMemo(() => catalogRows('items'), []);
  const locationRows = useMemo(() => catalogRows('locations'), []);
  const researchRows = useMemo(() => catalogRows('research'), []);
  const recipeRows = useMemo(() => catalogRows('recipes'), []);
  const talentRows = useMemo(() => catalogRows('talents'), []);
  const eventRows = useMemo(() => catalogRows('events'), []);
  const event = eventRows.find(row => row.id === state.pendingEventId);

  const heroActions: { action: HeroAction; label: string; description: string }[] = [
    { action: { kind: 'attack', targetId: target }, label: 'Attack', description: 'Strike a chosen enemy. Shatter Chill for extra impact.' },
    { action: { kind: 'guard' }, label: 'Guard', description: 'Brace for the enemies’ next moves.' },
    ...hero.equippedSpells.map(spellId => { const spell = spellRows.find(row => row.id === spellId); return { action: { kind: 'spell' as const, spellId, targetId: target }, label: spell?.name || human(spellId), description: `${details(spell || { id: spellId })} · ${spell?.manaCost || 0} mana · ${spell?.cooldown || 0} turn cooldown${hero.cooldowns[spellId] ? ` · ready in ${hero.cooldowns[spellId]}` : ''}` }; }),
    ...hero.consumables.filter(id => hero.inventory[id] > 0).map(itemId => ({ action: { kind: 'consumable' as const, itemId, targetId: target }, label: itemRows.find(row => row.id === itemId)?.name || human(itemId), description: `Use one · ${hero.inventory[itemId]} carried` })),
    { action: { kind: 'retreat' }, label: 'Retreat', description: 'Leave the fight and return to the refuge.' },
  ];

  return <div className="campaign-app" data-reduced-motion={reducedMotion}>
    <a className="camp-skip" href="#main-content">Skip to main content</a>
    <div className="campaign-shell">
      <header className="camp-topbar">
        <div className="camp-brand"><img src="/icons/favicon.svg" alt="" /> Arcanora</div>
        <nav className="camp-nav" aria-label="Campaign places">
          {(['refuge','hero','region','journal'] as View[]).map(place => <button key={place} type="button" aria-current={view === place ? 'page' : undefined} onClick={() => setView(place)}>{human(place)}</button>)}
          <button type="button" onClick={() => setSettingsOpen(value => !value)} aria-expanded={settingsOpen}>Settings</button>
        </nav>
      </header>
      {settingsOpen && <section className="camp-panel" aria-label="Settings"><h2>Settings</h2><label className="camp-label">Motion<select className="camp-select" value={reducedMotion ? 'reduced' : 'standard'} onChange={event => onMotionChange(event.target.value === 'reduced')}><option value="standard">Use device preference</option><option value="reduced">Reduce movement</option></select></label><div style={{ marginTop: 14 }}><button className="camp-button small" type="button" onClick={onTitle}>Return to title</button>{import.meta.env.DEV && <button className="camp-button small" type="button" onClick={() => setShowDebug(value => !value)}>Campaign details</button>}</div>{import.meta.env.DEV && showDebug && <pre style={{ overflowX: 'auto' }}>{JSON.stringify({ seed: state.seed, rngState: state.rngState, phase: state.phase, revision: state.revision, attempt: state.attempt, combat: state.combat }, null, 2)}</pre>}</section>}
      <div className="camp-statrow" aria-label="Campaign supplies">
        <div className="camp-stat"><strong>{refuge.resources.timber}</strong><span>Banked timber</span></div>
        <div className="camp-stat"><strong>{refuge.resources.provisions}</strong><span>Banked provisions</span></div>
        <div className="camp-stat"><strong>{refuge.resources.essence}</strong><span>Banked essence</span></div>
        {attempt && <><div className="camp-stat"><strong>{attempt.resources.timber} · {attempt.resources.provisions} · {attempt.resources.essence}</strong><span>Night supplies T · P · E</span></div><div className="camp-stat"><strong>{attempt.prepRemaining}</strong><span>Preparation turns</span></div></>}
        <div className="camp-stat"><strong>{state.turn}</strong><span>World turns</span></div>
      </div>
      {error && <div className="camp-error" role="alert">{error}</div>}
      {notice && <div className="camp-notice" role="status">{notice}</div>}
      <div className="camp-grid">
        <main id="main-content">
          {view === 'refuge' && <>
            <section className={`camp-panel camp-scene${refuge.wardHp > refuge.maxWardHp * .65 ? ' ward-bright' : ''}`} aria-labelledby="scene-title">
              <div className="scene-silhouette" aria-hidden="true"/><div className="scene-ward" aria-hidden="true"/>
              <span className="scene-workshop" aria-hidden="true">⌂</span><span className="scene-barricade" aria-hidden="true">▥</span>
              {refuge.villagers.length > 2 && <span className="scene-tents" aria-hidden="true">⌂ ⌂</span>}
              <div className="scene-caption"><h2 id="scene-title">The Refuge</h2><p>{refuge.settlementLevel > 1 ? 'The stonework holds. More lights answer the ward as the settlement grows.' : 'Amber fire warms the broken stone. Beyond the barricade, the undead gather.'}</p></div>
            </section>
            {state.phase === 'opening' && <section className="camp-panel"><span className="eyebrow">First light</span><h2>Keep the flame alive</h2><p>The ward is failing. Rekindle it, set the villagers to work, and prepare for the first assault. Your choices move the world forward only when committed.</p><ActionButton action={{ type:'rekindle' }} label="Rekindle the ward" dispatch={choose} preview={preview} primary /></section>}
            {state.phase === 'preparation' && <>
              <section className="camp-panel"><span className="eyebrow">Night {state.night} · wave {attempt?.wave || 1}</span><h2>Prepare for the assault</h2><p>{attempt?.preview || 'Watch the road and make ready.'}</p>{attempt?.modifier && <p>Night condition: {attempt.modifier}</p>}{attempt?.objective && <p>Optional objective: {attempt.objective}</p>}
                <div className="camp-cards">{[ ['scavenge','Scavenge','Search nearby ruins for useful supplies.'],['rest','Rest','Recover before the next assault.'],['repair','Repair defenses','Strengthen damaged protection.'] ].map(([kind,label,description]) => <ActionButton key={kind} action={{ type:'prepare', kind: kind as 'scavenge'|'rest'|'repair' }} label={label} description={description} dispatch={choose} preview={preview} />)}</div>
                <h3>Build before the wave</h3><div className="camp-cards">{buildingRows.map(building => <div className="camp-card" key={building.id}><strong>{building.name || human(building.id)}</strong><p>{details(building)}</p><ActionButton action={{ type:'prepare',kind:'construct',targetId:building.id }} label="Construct" dispatch={choose} preview={preview} /></div>)}</div>
                <ActionButton action={{ type:'beginWave' }} label="Begin the assault" description="Unused preparation turns are forfeited." dispatch={choose} preview={preview} primary />
              </section>
              <section className="camp-panel"><h2>Villagers</h2><p>Assignments may be changed freely. Their work resolves when a world turn is committed.</p><div className="camp-cards">{refuge.villagers.map(villager => <div className="camp-card" key={villager.id}><strong>{villager.name}</strong><p>{villager.traits.join(' · ')}{villager.injury > 0 && ` · Injured (${villager.injury})`}</p><label className="camp-label">Work assignment<select className="camp-select" value={villager.role} onChange={event => dispatch({ type:'assign',villagerId:villager.id,role:event.target.value as WorkerRole })}>{(['timber','provisions','ward','repair','craft','study','scout','recover','construction'] as WorkerRole[]).map(role => <option key={role} value={role} disabled={!preview({ type:'assign',villagerId:villager.id,role }).valid}>{human(role)}</option>)}</select></label></div>)}</div></section>
            </>}
            {state.phase === 'combat' && state.combat && <section className="camp-panel"><span className="eyebrow">{state.combat.source === 'night' ? `Wave ${attempt?.wave || 1}` : state.combat.source} · round {state.combat.round}</span><h2>Defend the refuge</h2><p>Enemy intentions are set. Choose one hero action, optionally order the village, then end the turn.</p>
              <div className="camp-cards">{enemies.map((enemy: CampaignEnemy) => { const profile = enemyRows.find(row => row.id === enemy.id); return <div className={`camp-card camp-enemy${enemy.elite ? ' elite' : ''}`} key={enemy.instanceId}><strong>{enemy.name}{enemy.elite && ' · Elite'}{enemy.phase ? ` · phase ${enemy.phase}` : ''}</strong><p>{human(enemy.role)} · {enemy.hp}/{enemy.maxHp} health · {enemy.armor} armor</p><p>{details(profile || { id:enemy.id })}</p><p>Intent: {enemy.intention.label} → {human(enemy.intention.target)} ({enemy.intention.power})</p><p>{enemy.statuses.map(status => `${human(status.kind)} ${status.turns} turn${status.turns === 1 ? '' : 's'}`).join(' · ') || 'No active effects'}</p>{Boolean(profile?.resistances) && <p>Resists: {Object.entries(profile?.resistances as Record<string,number>).map(([kind,value]) => `${human(kind)} ${value}%`).join(' · ')}</p>}{Boolean(profile?.vulnerabilities) && <p>Vulnerable: {Object.entries(profile?.vulnerabilities as Record<string,number>).map(([kind,value]) => `${human(kind)} ${value}%`).join(' · ')}</p>}</div>; })}</div>
              <label className="camp-label">Target enemy<select className="camp-select" value={target} onChange={event => setTargetId(event.target.value)}>{enemies.map(enemy => <option key={enemy.instanceId} value={enemy.instanceId}>{enemy.name} · {enemy.hp} health</option>)}</select></label>
              <h3>Hero action</h3><div className="camp-choice-grid">{heroActions.map(({action,label,description}, index) => <ActionButton key={`${action.kind}-${index}`} action={{ type:'selectHeroAction',action }} label={label} description={description} dispatch={choose} preview={preview} selected={JSON.stringify(state.combat?.selectedHeroAction) === JSON.stringify(action)} />)}</div>
              <h3 style={{ marginTop: 24 }}>Village order</h3><div className="camp-choice-grid">{[null,{kind:'reinforce' as const},{kind:'support' as const}].map((order,index) => <ActionButton key={index} action={{ type:'selectVillageOrder',order }} label={order ? human(order.kind) : 'No order'} description={order ? 'Costs provisions when the turn resolves.' : 'Save provisions for later.'} dispatch={choose} preview={preview} selected={JSON.stringify(state.combat?.selectedVillageOrder) === JSON.stringify(order)} />)}</div>
              <div style={{ marginTop: 24 }}><ActionButton action={{ type:'endTurn',expectedRevision:state.revision,actionId:`turn-${state.revision+1}` }} label="End turn" description="Resolve your action, village order, enemy intentions, effects, then production." dispatch={choose} preview={preview} primary /></div>
              <h3 style={{ marginTop:24 }}>Recent combat</h3><ul className="camp-list" aria-live="polite">{state.combat.log.slice(-5).map((line,index)=><li key={`${index}-${line}`}>{line}</li>)}</ul>
            </section>}
            {state.phase === 'rewards' && <section className="camp-panel"><span className="eyebrow">Dawn</span><h2>Choose your reward</h2><p>The refuge endured. Select one of the three finds to bank for the future. At the refuge, you can invest in a lasting improvement.</p><div className="camp-cards">{state.rewardChoices.map(reward => <div className="camp-card" key={reward.id}><strong>{reward.name}</strong><p>{reward.description}</p><ActionButton action={{ type:'claimReward',rewardId:reward.id }} label="Claim reward" dispatch={choose} preview={preview} /></div>)}</div></section>}
            {state.phase === 'defeat' && <section className="camp-panel"><span className="eyebrow">The ward dims</span><h2>Return to the refuge</h2><p>The villagers carry what they can to safety. Your lasting improvements remain, and a recovery kit will help prepare another defense.</p><p>Recovery kit: {resourceText(refuge.recovery) || 'Ready for the next preparation'}</p><ActionButton action={{ type:'startNight' }} label="Prepare another night" dispatch={choose} preview={preview} primary /></section>}
            {state.phase === 'chapter_complete' && <section className="camp-panel"><span className="eyebrow">Chapter complete</span><h2>A road toward Oakhaven</h2><p>The refuge stands secure. Its light now reaches beyond the old bridge, and the road toward Oakhaven has opened.</p><ActionButton action={{ type:'startNight' }} label="Continue the campaign" dispatch={choose} preview={preview} primary /></section>}
            {state.phase === 'refuge' && <section className="camp-panel"><span className="eyebrow">Chapter {state.chapter} · settlement {refuge.settlementLevel}</span><h2>{state.flags.includes('first_upgrade_due') ? 'Make the refuge stronger' : 'Choose the next step'}</h2><p>{state.flags.includes('first_upgrade_due') ? 'Dawn’s supplies can secure one lasting improvement before the next journey.' : 'Prepare another defense, improve the settlement, or explore the nearby region. Permanent resources stay here between journeys.'}</p>{state.flags.includes('first_upgrade_due') && <div className="camp-cards">{upgradeRows.filter(upgrade => preview({type:'chooseUpgrade',upgradeId:upgrade.id}).valid).map(upgrade => <div className="camp-card" key={upgrade.id}><strong>{upgrade.name || human(upgrade.id)}</strong><p>{details(upgrade)}</p><ActionButton action={{type:'chooseUpgrade',upgradeId:upgrade.id}} label="Choose improvement" dispatch={choose} preview={preview}/></div>)}</div>}<div className="camp-choice-grid"><ActionButton action={{ type:'startNight' }} label="Prepare a night" dispatch={choose} preview={preview} primary /><ActionButton action={{ type:'startNight',boss:true }} label="Face the chapter threat" dispatch={choose} preview={preview} /></div></section>}
            {state.phase === 'expedition' && <section className="camp-panel"><span className="eyebrow">Expedition · turn {state.expedition?.turns || 0}</span><h2>{locationRows.find(row => row.id === state.expedition?.locationId)?.name || human(state.expedition?.locationId || 'The wilds')}</h2><p>{locationRows.find(row => row.id === state.expedition?.locationId)?.description || 'Choose how to proceed.'}</p><p>Secured: {resourceText(state.expedition?.secured) || 'None'} · At risk: {resourceText(state.expedition?.unbanked) || 'None'}</p>{renderExpeditionChoices()}<ActionButton action={{ type:'retreat' }} label="Return to refuge" dispatch={choose} preview={preview} /></section>}
            {event && <section className="camp-panel"><span className="eyebrow">At the refuge</span><h2>{event.name || 'Visitors at the fire'}</h2><p>{details(event)}</p><div className="camp-choice-grid">{eventChoices(event).map(choice => <ActionButton key={choice.id} action={{ type:'chooseEvent',choiceId:choice.id }} label={choice.label || choice.name || human(choice.id)} description={choice.description || resourceText(choice.cost)} dispatch={choose} preview={preview} />)}</div></section>}
          </>}
          {view === 'hero' && <section className="camp-panel"><span className="eyebrow">Keeper of the ward</span><h2>{hero.name} · level {hero.level}</h2><p>{hero.xp} experience · {hero.attack} power · {hero.spellPower} spell power · {hero.resilience} resilience</p><div className="camp-vitals"><Meter label="Health" value={hero.hp} max={hero.maxHp}/><Meter label="Mana" value={hero.mana} max={hero.maxMana}/></div>
            <h3 style={{ marginTop:24 }}>Equipment</h3><div className="camp-cards">{(['weapon','armor','focus'] as const).map(slot => <div className="camp-card" key={slot}><strong>{human(slot)}: {itemRows.find(row => row.id === hero.equipment[slot])?.name || human(hero.equipment[slot] || 'empty')}</strong><div className="button-stack">{itemRows.filter(item => (hero.inventory[item.id] || 0) > 0).map(item => <ActionButton key={item.id} action={{ type:'equip',itemId:item.id,slot }} label={item.name || human(item.id)} dispatch={choose} preview={preview} />)}</div></div>)}</div>
            <h3>Spells</h3><p>Choose the spells to carry into the next fight.</p><div className="camp-choice-grid">{hero.learnedSpells.map(id => <ActionButton key={id} action={{ type:'setSpells',spellIds: hero.equippedSpells.includes(id) ? hero.equippedSpells.filter(value => value !== id) : [...hero.equippedSpells,id] }} label={spellRows.find(row => row.id === id)?.name || human(id)} description={hero.equippedSpells.includes(id) ? 'Equipped · select to remove' : 'Select to equip'} dispatch={choose} preview={preview} selected={hero.equippedSpells.includes(id)} />)}</div>
            <h3 style={{ marginTop:24 }}>Carried supplies</h3><div className="camp-choice-grid">{itemRows.filter(item => (hero.inventory[item.id] || 0) > 0).map(item => <ActionButton key={item.id} action={{ type:'setConsumables',itemIds:hero.consumables.includes(item.id) ? hero.consumables.filter(id => id !== item.id) : [...hero.consumables,item.id] }} label={`${item.name || human(item.id)} · ${hero.inventory[item.id]}`} description={hero.consumables.includes(item.id) ? 'Carried · select to remove' : 'Select to carry'} dispatch={choose} preview={preview} selected={hero.consumables.includes(item.id)} />)}</div>
            {hero.pendingTalent && <><h3 style={{ marginTop:24 }}>Choose a talent</h3><div className="camp-cards">{talentRows.map(talent => <div className="camp-card" key={talent.id}><strong>{talent.name || human(talent.id)}</strong><p>{details(talent)}</p><ActionButton action={{ type:'chooseTalent',talentId:talent.id }} label="Learn talent" dispatch={choose} preview={preview}/></div>)}</div></>}
          </section>}
          {view === 'region' && <section className="camp-panel"><span className="eyebrow">Beyond the refuge</span><h2>Nearby places</h2><p>Scout a known route, weigh the risk, and return with supplies and discoveries.</p><div className="camp-cards">{locationRows.filter(location => state.unlockedLocations.includes(location.id)).map(location => <div className="camp-card" key={location.id}><strong>{location.name || human(location.id)}</strong><p>{details(location)}</p><ActionButton action={{ type:'startExpedition',locationId:location.id }} label="Set out" dispatch={choose} preview={preview}/></div>)}</div>{state.phase === 'expedition' && renderExpeditionChoices()}</section>}
          {view === 'journal' && <section className="camp-panel"><span className="eyebrow">The road ahead</span><h2>Chapter {state.chapter}</h2><p>Night {state.night} · {refuge.settlementLevel} settlement level · {refuge.villagers.length} survivors</p><h3>Milestones</h3><ul className="camp-list">{state.flags.map(flag => <li key={flag}>{human(flag)}</li>)}</ul><h3 style={{ marginTop:24 }}>Recent events</h3><ul className="camp-list">{state.log.slice(-12).reverse().map((entry,index)=><li key={`${entry}-${index}`}>{entry}</li>)}</ul></section>}
        </main>
        <aside aria-label="Refuge status">
          <section className="camp-panel"><h2>The watch</h2><div className="camp-vitals"><Meter label="Hero" value={hero.hp} max={hero.maxHp}/><Meter label="Ward" value={refuge.wardHp} max={refuge.maxWardHp} ward /></div><p>Night {state.night} · Chapter {state.chapter} · {human(state.phase)}</p>{attempt && <p>Coming threat: {attempt.preview}</p>}</section>
          <section className="camp-panel"><h2>Structures</h2><ul className="camp-list">{Object.values(refuge.buildings).map(building => <li key={building.id}><strong>{buildingRows.find(row => row.id === building.id)?.name || human(building.id)}</strong> · level {building.level}<br/><span className="camp-muted">{building.hp}/{building.maxHp} integrity{building.construction && ` · ${building.construction.remaining} turns to complete`}</span></li>)}</ul></section>
          {state.phase === 'refuge' && <section className="camp-panel"><h2>Develop the refuge</h2><div className="button-stack">{upgradeRows.map(upgrade => <ActionButton key={upgrade.id} action={{ type:'chooseUpgrade',upgradeId:upgrade.id }} label={upgrade.name || human(upgrade.id)} description={details(upgrade)} dispatch={choose} preview={preview}/>)}{researchRows.map(project => <ActionButton key={project.id} action={{ type:'startResearch',researchId:project.id }} label={project.name || human(project.id)} description={details(project)} dispatch={choose} preview={preview}/>)}{recipeRows.map(recipe => <ActionButton key={recipe.id} action={{ type:'craft',recipeId:recipe.id }} label={recipe.name || human(recipe.id)} description={details(recipe)} dispatch={choose} preview={preview}/>)}</div>{refuge.activeResearch && <p>Research: {human(refuge.activeResearch.id)} · {refuge.activeResearch.remaining} turns left</p>}</section>}
        </aside>
      </div>
      {inspected && <div className="camp-overlay"><section className="camp-panel camp-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onKeyDown={confirmKeyDown}><h2 id="confirm-title">Confirm your choice</h2><Preview value={preview(inspected)}/><div className="camp-choice-grid"><button ref={confirmRef} className="camp-button primary" onClick={() => dispatch(inspected)}>Commit action</button><button ref={cancelRef} className="camp-button" onClick={closeConfirm}>Change choice</button></div></section></div>}
      <footer className="camp-footer">The flame endures. Every choice shapes the refuge.</footer>
    </div>
  </div>;

  function renderExpeditionChoices() {
    if (!state.expedition) return null;
    const location = locationRows.find(row => row.id === state.expedition?.locationId);
    const steps = location?.steps;
    const step = Array.isArray(steps) ? steps[state.expedition.step] as CatalogEntry | undefined : undefined;
    const choices = eventChoices(step);
    return <><p>{step?.text || ''}</p><div className="camp-choice-grid">{choices.map(choice => <ActionButton key={choice.id} action={{ type:'expeditionChoice',choiceId:choice.id }} label={choice.label || choice.name || human(choice.id)} description={choice.description || (choice.risk !== undefined ? `Risk ${choice.risk}` : undefined)} dispatch={choose} preview={preview}/>)}</div></>;
  }
}

function eventChoices(entry: CatalogEntry | undefined): CatalogEntry[] {
  const value = entry?.choices;
  return Array.isArray(value) ? value as CatalogEntry[] : [];
}
