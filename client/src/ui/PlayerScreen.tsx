import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, LogOut, Play, RotateCcw, Settings2 } from 'lucide-react';
import { NEON_FACILITY } from '@neon-strike/shared/maps';
import type { MapWorld } from '@neon-strike/shared/physics';
import type { PlayerDebug, PlayerScene } from '../game/player/createPlayerScene';
import type { usePreferences } from '../settings/usePreferences';
import { SettingsScreen } from './settings/SettingsScreen';
import { CombatReadout } from './CombatReadout';
import type { TrainingReadout } from '../game/combat/TrainingRuntime';
import type { MatchRules } from '@neon-strike/shared/match';
import { MatchResults } from './match/MatchResults';
import type { NetworkOptions, NetworkReadout as NetworkState } from '../network/NetworkManager';
import { NetworkReadout } from './network/NetworkReadout';
import './hud/hud.css';
import '../game/player/player.css';

type Status = 'loading' | 'ready' | 'playing' | 'paused' | 'ended' | 'failed';
function Overlay({ children, settings, results, onCancel }: { children: ReactNode; settings: boolean; results?: boolean; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className={`fps-overlay ${settings ? 'fps-settings' : results ? 'fps-results' : ''}`}
    aria-label={settings ? 'Configurações da arena' : results ? 'Fim da partida' : 'Menu da arena'} onCancel={(event) => {
      if (event.target !== event.currentTarget) return;
      event.preventDefault(); onCancel();
    }}>
    {children}
  </dialog>;
}

export function PlayerScreen({ settings, onBack, onMenu, training = false, bots = false, rules, network }: {
  settings: ReturnType<typeof usePreferences>; onBack: () => void; onMenu: () => void; training?: boolean; bots?: boolean; rules?: Readonly<MatchRules>; network?: NetworkOptions;
}) {
  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<PlayerScene | null>(null);
  const preferencesRef = useRef(settings.preferences);
  preferencesRef.current = settings.preferences;
  const [status, setStatus] = useState<Status>('loading');
  const [showSettings, setShowSettings] = useState(false);
  const [inputError, setInputError] = useState('');
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [debug, setDebug] = useState<PlayerDebug | null>(null);
  const [combat, setCombat] = useState<TrainingReadout | null>(null);
  const [scoreboardOpen, setScoreboardOpen] = useState(false);
  const [networkState, setNetworkState] = useState<NetworkState | null>(null);
  const started = useRef(false);
  useEffect(() => {
    let active = true;
    let physics: MapWorld | undefined;
    async function initialize() {
      const { createPlayerScene } = await import('../game/player/createPlayerScene');
      const { createMapWorld } = await import('@neon-strike/shared/physics');
      if (!active || !container.current) return;
      const world = await createMapWorld(NEON_FACILITY);
      if (!active || !container.current) { world.dispose(); return; }
      physics = world;
      scene.current = createPlayerScene(container.current, world, preferencesRef.current, {
        onLock(locked) {
          if (!active) return;
          if (locked) { started.current = true; setInputError(''); setShowSettings(false); }
          setStatus((previous) => previous === 'failed' || previous === 'ended' ? previous : locked ? 'playing' : started.current ? 'paused' : 'ready');
        },
        onInputError: (message) => { if (active) setInputError(message); },
        onError: () => { if (active) setStatus('failed'); },
        onDebug: (next) => { if (active) setDebug(next); },
        onCombat: (next) => {
          if (!active) return;
          setCombat(next);
          if (next.match?.state === 'MATCH_END') { setStatus('ended'); setShowSettings(false); setScoreboardOpen(false); }
          else if (network) setStatus((previous) => previous === 'ended' ? 'ready' : previous);
        },
        onScoreboard: (open) => { if (active) setScoreboardOpen(open); },
        onNetwork: (next) => { if (active) setNetworkState(next); },
      }, training, bots ? { count: preferencesRef.current.match.bots, difficulty: preferencesRef.current.match.difficulty } : undefined, rules, network);
      setStatus('ready');
    }
    void initialize().catch((error: unknown) => {
      physics?.dispose();
      if (active) { console.error('[PLAYER] Initialization failed', error); setStatus('failed'); }
    });
    return () => { active = false; scene.current?.dispose(); scene.current = null; physics?.dispose(); };
  }, [training, bots, rules, network]);
  useEffect(() => { scene.current?.setPreferences(settings.preferences); }, [settings.preferences]);
  useEffect(() => {
    if (status === 'ready' || status === 'paused') document.querySelector<HTMLButtonElement>('[data-player-resume]')?.focus();
  }, [status, showSettings]);
  function resume() { setInputError(''); scene.current?.resume(); }

  const modeLabel = network ? 'FREE FOR ALL LAN' : bots ? 'COMBATE CONTRA BOTS' : training ? 'TREINAMENTO' : 'EXPLORAÇÃO LIVRE';
  return <main className="fps-screen" data-player-status={status} data-training={training} data-bots={bots} data-network={Boolean(network)}>
    <div ref={container} className="fps-viewport" />
    <div className="fps-chrome">
      <header className="fps-location"><span>NEON FACILITY</span><span>{modeLabel}</span></header>
      {status === 'playing' && !scoreboardOpen && (!combat || combat.hp > 0 && combat.match?.state !== 'COUNTDOWN') && <div className="fps-reticle" aria-hidden="true" />}
      {(training || bots || network) && combat && <CombatReadout state={combat} playing={status === 'playing'} scoreboard={scoreboardOpen} />}
      {networkState && <NetworkReadout state={networkState} combat={Boolean(combat)} scoreboard={!combat && status === 'playing' && scoreboardOpen} />}
      {import.meta.env.DEV && debugEnabled && debug && <output className="fps-debug" hidden={status === 'ended' || status === 'playing' && scoreboardOpen} aria-label="Diagnóstico do jogador"
        data-x={debug.x} data-y={debug.y} data-z={debug.z} data-speed={debug.speed} data-grounded={debug.grounded} data-yaw={debug.yaw} data-pitch={debug.pitch} data-camera-y={debug.cameraY} data-fov={debug.fov} data-bots={JSON.stringify(debug.bots)}>
        <span>DEBUG / {debug.fps.toFixed(0)} FPS / {debug.calls} draw calls / {debug.geometries} geometrias</span>
        <span>XYZ {debug.x.toFixed(2)} / {debug.y.toFixed(2)} / {debug.z.toFixed(2)}</span>
        <span>{debug.grounded ? 'NO CHÃO' : 'NO AR'} / {debug.speed.toFixed(2)} m/s / recuperações {debug.recoveries}</span>
        <span>FOV {debug.fov} / câmera Y {debug.cameraY.toFixed(2)}</span>
        {bots && <span>BOTS {debug.bots.length} / ATACANDO {debug.bots.filter((bot) => bot.state === 'ATTACK').length} / RESPAWN {debug.bots.filter((bot) => bot.state === 'RESPAWN').length}</span>}
      </output>}
    </div>
    {status !== 'playing' && <Overlay settings={showSettings} results={status === 'ended'} onCancel={() => { if (showSettings) setShowSettings(false); else if (!started.current) onBack(); }}>
      {status === 'ended' && combat?.match?.result ? <MatchResults result={combat.match.result} nextRoundSeconds={network ? combat.nextRoundSeconds : undefined} onMenu={onMenu} onAgain={() => {
        started.current = false; setStatus('ready'); scene.current?.restart(); resume();
      }} /> : showSettings ? <SettingsScreen {...settings} onBack={() => setShowSettings(false)} /> : <>
        <p className="eyebrow">NEON STRIKE / {modeLabel}</p>
        <h2>{status === 'loading' ? 'CARREGANDO MAPA...' : status === 'failed' ? 'Arena indisponível' : status === 'paused' ? network ? 'MENU LOCAL' : 'PAUSA' : 'NEON FACILITY'}</h2>
        {networkState && <p className="network-status" role="status">{networkState.message}</p>}
        {status === 'failed' && <p className="fps-notice" role="alert">Não foi possível manter a cena 3D. Volte ao menu ou recarregue a página.</p>}
        {inputError && <p className="fps-notice" role="alert">{inputError}</p>}
        <div className="fps-actions">
          {(status === 'ready' || status === 'paused') && <>
            <button data-player-resume className="button primary" disabled={Boolean(network && networkState?.state !== 'connected')} onClick={resume}><Play aria-hidden="true" />{status === 'paused' ? 'CONTINUAR' : 'ENTRAR NA ARENA'}</button>
            <button className="button secondary" onClick={() => setShowSettings(true)}><Settings2 aria-hidden="true" />CONFIGURAÇÕES</button>
            {started.current && !network && <button className="button secondary" onClick={() => { scene.current?.restart(); resume(); }}><RotateCcw aria-hidden="true" />REINICIAR</button>}
          </>}
          <button className="button secondary" onClick={network ? onBack : started.current ? onMenu : onBack}>
            {network || started.current ? <LogOut aria-hidden="true" /> : <ArrowLeft aria-hidden="true" />}{network ? 'DESCONECTAR' : started.current ? 'VOLTAR AO MENU' : training ? 'VOLTAR AO TREINAMENTO' : 'VOLTAR A JOGAR'}
          </button>
        </div>
        {import.meta.env.DEV && (status === 'ready' || status === 'paused') && <label className="fps-debug-toggle">
          <input type="checkbox" checked={debugEnabled} onChange={(event) => { setDebugEnabled(event.target.checked); scene.current?.setDebug(event.target.checked); }} />Debug do jogador
        </label>}
      </>}
    </Overlay>}
  </main>;
}
