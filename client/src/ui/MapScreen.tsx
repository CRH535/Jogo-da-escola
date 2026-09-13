import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { NEON_FACILITY } from '@neon-strike/shared/maps';
import type { MapWorld } from '@neon-strike/shared/physics';
import type { MapScene } from '../maps/createMapScene';
import { MAP_VIEWS } from '../maps/mapViews';
import type { Preferences } from '../settings/preferences';
import '../maps/map.css';

export function MapScreen({ video, onBack }: { video: Preferences['video']; onBack: () => void }) {
  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<MapScene | null>(null);
  const videoRef = useRef(video);
  videoRef.current = video;
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [view, setView] = useState('overview');
  const [spawns, setSpawns] = useState(true);
  const [debug, setDebug] = useState(false);
  useEffect(() => {
    let active = true;
    let physics: MapWorld | undefined;
    async function initialize() {
      const { createMapScene } = await import('../maps/createMapScene');
      const { createMapWorld } = await import('@neon-strike/shared/physics');
      if (!active || !container.current) return;
      const world = await createMapWorld(NEON_FACILITY);
      if (!active || !container.current) { world.dispose(); return; }
      physics = world;
      scene.current = createMapScene(container.current, world, () => { if (active) setStatus('failed'); }, videoRef.current);
      setStatus('ready');
    }
    void initialize().catch((error: unknown) => {
      physics?.dispose();
      if (!active) return;
      console.error('[MAP] Initialization failed', error);
      setStatus('failed');
    });
    return () => {
      active = false;
      scene.current?.dispose(); scene.current = null;
      physics?.dispose();
    };
  }, []);
  useEffect(() => { scene.current?.setVideo(video); }, [video]);
  function selectView(id: string) { setView(id); scene.current?.setView(id); }

  return <main className="map-screen">
    <div className="map-viewport" ref={container} />
    <div className="map-overlay">
      <header className="map-header">
        <button className="icon-button" title="Voltar a JOGAR" aria-label="Voltar a JOGAR" onClick={onBack}><ArrowLeft aria-hidden="true" /></button>
        <div><p className="eyebrow">NEON STRIKE / ARENA 01</p><h1 data-screen-title tabIndex={-1}>NEON FACILITY</h1></div>
        <span className="map-dimensions">48 x 40 m</span>
      </header>
      {status === 'loading' && <div className="map-message" role="status">CARREGANDO MAPA...</div>}
      {status === 'failed' && <div className="map-message" role="alert"><h2>Mapa indisponível</h2><p>Não foi possível carregar o mapa. Recarregue a página ou volte ao menu.</p></div>}
      <footer className="map-toolbar">
        <div className="map-view-control"><label htmlFor="map-view">Vista</label>
          <select id="map-view" value={view} disabled={status !== 'ready'} onChange={(event) => selectView(event.target.value)}>
            {MAP_VIEWS.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
          </select>
          <button className="icon-button" disabled={status !== 'ready'} title="Restaurar vista" aria-label="Restaurar vista" onClick={() => selectView(view)}><RotateCcw aria-hidden="true" /></button>
        </div>
        <label className="map-toggle"><input type="checkbox" checked={spawns} disabled={status !== 'ready'} onChange={(event) => { setSpawns(event.target.checked); scene.current?.setSpawns(event.target.checked); }} />Spawns</label>
        {import.meta.env.DEV && <label className="map-toggle"><input type="checkbox" checked={debug} disabled={status !== 'ready'} onChange={(event) => { setDebug(event.target.checked); scene.current?.setDebug(event.target.checked); }} />Colisores</label>}
        <output className="map-status" aria-live="polite">{status === 'ready' ? 'Mapa carregado' : status === 'failed' ? 'Falha no mapa' : 'Carregando...'}</output>
        {debug && import.meta.env.DEV && <output className="map-debug">DEBUG / {NEON_FACILITY.solids.length} colisores / {NEON_FACILITY.spawns.length} spawns</output>}
      </footer>
    </div>
  </main>;
}
