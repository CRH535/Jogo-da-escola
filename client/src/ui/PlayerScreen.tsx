import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, LogOut, Play, RotateCcw, Settings2 } from 'lucide-react';
import { NEON_FACILITY } from '@neon-strike/shared/maps';
import type { MapWorld } from '@neon-strike/shared/physics';
import type { PlayerDebug, PlayerScene } from '../game/player/createPlayerScene';
import type { usePreferences } from '../settings/usePreferences';
import { SettingsScreen } from './settings/SettingsScreen';
import '../game/player/player.css';

type Status = 'loading' | 'ready' | 'playing' | 'paused' | 'failed';
function Overlay({ children, settings, onCancel }: { children: ReactNode; settings: boolean; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className={`fps-overlay ${settings ? 'fps-settings' : ''}`}
    aria-label={settings ? 'Configurações da exploração' : 'Menu da exploração'} onCancel={(event) => {
      if (event.target !== event.currentTarget) return;
      event.preventDefault(); onCancel();
    }}>
    {children}
  </dialog>;
}

export function PlayerScreen({ settings, onBack, onMenu }: {
  settings: ReturnType<typeof usePreferences>; onBack: () => void; onMenu: () => void;
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
          setStatus((previous) => previous === 'failed' ? 'failed' : locked ? 'playing' : started.current ? 'paused' : 'ready');
        },
        onInputError: (message) => { if (active) setInputError(message); },
        onError: () => { if (active) setStatus('failed'); },
        onDebug: (next) => { if (active) setDebug(next); },
      });
      setStatus('ready');
    }
    void initialize().catch((error: unknown) => {
      physics?.dispose();
      if (active) { console.error('[PLAYER] Initialization failed', error); setStatus('failed'); }
    });
    return () => { active = false; scene.current?.dispose(); scene.current = null; physics?.dispose(); };
  }, []);
  useEffect(() => { scene.current?.setPreferences(settings.preferences); }, [settings.preferences]);
  useEffect(() => {
    if (status === 'ready' || status === 'paused') document.querySelector<HTMLButtonElement>('[data-player-resume]')?.focus();
  }, [status, showSettings]);
  function resume() { setInputError(''); scene.current?.resume(); }

  return <main className="fps-screen" data-player-status={status}>
    <div ref={container} className="fps-viewport" />
    <div className="fps-chrome">
      <header className="fps-location"><span>NEON FACILITY</span><span>EXPLORAÇÃO LIVRE</span></header>
      {status === 'playing' && <div className="fps-reticle" aria-hidden="true" />}
      {import.meta.env.DEV && debugEnabled && debug && <output className="fps-debug" aria-label="Diagnóstico do jogador"
        data-x={debug.x} data-y={debug.y} data-z={debug.z} data-speed={debug.speed} data-grounded={debug.grounded} data-yaw={debug.yaw} data-pitch={debug.pitch} data-camera-y={debug.cameraY} data-fov={debug.fov}>
        <span>DEBUG / {debug.fps.toFixed(0)} FPS / {debug.calls} draw calls / {debug.geometries} geometrias</span>
        <span>XYZ {debug.x.toFixed(2)} / {debug.y.toFixed(2)} / {debug.z.toFixed(2)}</span>
        <span>{debug.grounded ? 'NO CHÃO' : 'NO AR'} / {debug.speed.toFixed(2)} m/s / recuperações {debug.recoveries}</span>
        <span>FOV {debug.fov} / câmera Y {debug.cameraY.toFixed(2)}</span>
      </output>}
    </div>
    {status !== 'playing' && <Overlay settings={showSettings} onCancel={() => { if (showSettings) setShowSettings(false); else if (!started.current) onBack(); }}>
      {showSettings ? <SettingsScreen {...settings} onBack={() => setShowSettings(false)} /> : <>
        <p className="eyebrow">NEON STRIKE / EXPLORAÇÃO LIVRE</p>
        <h2>{status === 'loading' ? 'CARREGANDO MAPA...' : status === 'failed' ? 'Arena indisponível' : status === 'paused' ? 'PAUSA' : 'NEON FACILITY'}</h2>
        {status === 'failed' && <p className="fps-notice" role="alert">Não foi possível manter a cena 3D. Volte ao menu ou recarregue a página.</p>}
        {inputError && <p className="fps-notice" role="alert">{inputError}</p>}
        <div className="fps-actions">
          {(status === 'ready' || status === 'paused') && <>
            <button data-player-resume className="button primary" onClick={resume}><Play aria-hidden="true" />{status === 'paused' ? 'CONTINUAR' : 'ENTRAR NA ARENA'}</button>
            <button className="button secondary" onClick={() => setShowSettings(true)}><Settings2 aria-hidden="true" />CONFIGURAÇÕES</button>
            {started.current && <button className="button secondary" onClick={() => { scene.current?.restart(); resume(); }}><RotateCcw aria-hidden="true" />REINICIAR</button>}
          </>}
          <button className="button secondary" onClick={started.current ? onMenu : onBack}>
            {started.current ? <LogOut aria-hidden="true" /> : <ArrowLeft aria-hidden="true" />}{started.current ? 'VOLTAR AO MENU' : 'VOLTAR A JOGAR'}
          </button>
        </div>
        {import.meta.env.DEV && (status === 'ready' || status === 'paused') && <label className="fps-debug-toggle">
          <input type="checkbox" checked={debugEnabled} onChange={(event) => { setDebugEnabled(event.target.checked); scene.current?.setDebug(event.target.checked); }} />Debug do jogador
        </label>}
      </>}
    </Overlay>}
  </main>;
}
