import { Compass, Eye, Play, MapPin } from 'lucide-react';
import { normalizeName, type Preferences } from '../settings/preferences';
import type { UpdatePreferences } from '../settings/usePreferences';
import { ScreenHeader } from './ScreenHeader';
import { SelectControl } from './controls';

export function PlayScreen({ preferences, update, onBack, onMap, onExplore, onStart }: { preferences: Preferences; update: UpdatePreferences; onBack: () => void; onMap: () => void; onExplore: () => void; onStart: () => void }) {
  return <section className="screen" aria-labelledby="play-heading">
    <ScreenHeader title="JOGAR" onBack={onBack} />
    <div className="setup-layout">
      <div>
        <h3 id="play-heading" className="section-title">PARTIDA CONTRA BOTS</h3>
        <div className="setting-row"><label htmlFor="player-name">Nome do jogador</label>
          <input id="player-name" type="text" maxLength={20} autoComplete="nickname" value={preferences.profile.name}
            onChange={(event) => update('profile', { name: event.target.value })}
            onBlur={() => update('profile', { name: normalizeName(preferences.profile.name) })} />
        </div>
        <SelectControl label="Escolher mapa" value={preferences.match.map} onChange={() => update('match', { map: 'neon-facility' })}>
          <option value="neon-facility">NEON FACILITY</option>
        </SelectControl>
        <SelectControl label="Número de bots" value={preferences.match.bots} onChange={(value) => update('match', { bots: Number(value) })}>
          {[1, 2, 3, 4, 5, 6, 7].map((count) => <option key={count} value={count}>{count}</option>)}
        </SelectControl>
        <SelectControl label="Dificuldade" value={preferences.match.difficulty} onChange={(value) => update('match', { difficulty: value as Preferences['match']['difficulty'] })}>
          <option value="easy">Fácil</option><option value="normal">Normal</option><option value="hard">Difícil</option>
        </SelectControl>
      </div>
      <aside className="match-summary">
        <MapPin aria-hidden="true" /><p className="eyebrow">ARENA 01</p><h3>NEON FACILITY</h3>
        <dl><div><dt>Modo</dt><dd>Free for All local</dd></div><div><dt>Tempo</dt><dd>10 minutos</dd></div><div><dt>Limite</dt><dd>30 eliminações</dd></div>
          <div><dt>Adversários</dt><dd>{preferences.match.bots} bots</dd></div></dl>
        <button className="button secondary map-open" data-screen="map" onClick={onMap}><Eye aria-hidden="true" />VER MAPA</button>
        <button className="button secondary arena-open" data-screen="arena" onClick={onExplore}><Compass aria-hidden="true" />EXPLORAR ARENA</button>
        <button className="button primary" data-screen="bots" onClick={onStart}><Play aria-hidden="true" />INICIAR PARTIDA</button>
      </aside>
    </div>
  </section>;
}
