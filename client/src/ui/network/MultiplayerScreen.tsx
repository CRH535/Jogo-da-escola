import { useState } from 'react';
import { LogIn, Plus } from 'lucide-react';
import { validName, validRoomSettings } from '@neon-strike/shared/network';
import type { NetworkOptions } from '../../network/NetworkManager';
import { serverAddress } from '../../network/serverAddress';
import { roomAddress } from '../../network/roomAddress';
import type { Preferences } from '../../settings/preferences';
import type { UpdatePreferences } from '../../settings/usePreferences';
import { ScreenHeader } from '../ScreenHeader';
import './network.css';

export function MultiplayerScreen({ preferences, update, onBack, onConnect, rooms = true }: {
  preferences: Preferences; update: UpdatePreferences; onBack: () => void; onConnect: (options: NetworkOptions) => void; rooms?: boolean;
}) {
  const [address, setAddress] = useState(window.location.origin);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [roomName, setRoomName] = useState('Minha arena');
  const [code, setCode] = useState(new URLSearchParams(window.location.search).get('room') ?? '');
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [requireReady, setRequireReady] = useState(true);
  return <section className="screen">
    <ScreenHeader title="MULTIPLAYER" onBack={onBack} />
    <form className="network-form" onSubmit={(event) => {
      event.preventDefault();
      const name = preferences.profile.name.trim();
      const destination = roomAddress(address, creating ? '' : code);
      const origin = rooms ? destination?.address : serverAddress(address);
      if (!validName(name)) { setError('Informe um nome de 1 a 20 caracteres.'); return; }
      if (!origin) { setError('Endereço inválido. Use http://IP:porta ou https://servidor.'); return; }
      const config = { name: roomName.trim(), map: 'neon-facility' as const, mode: 'ffa' as const, maxPlayers, requireReady };
      if (creating && !validRoomSettings(config)) { setError('Informe um nome de sala de 1 a 20 caracteres.'); return; }
      update('profile', { name }); setError(''); onConnect({ name, address: origin,
        ...(rooms ? { room: creating ? { action: 'create', settings: config } : { action: 'join', id: destination!.id } } : {}) });
    }}>
      <p className="eyebrow">REDE LOCAL / LAN</p>
      <div className="network-modes" role="group" aria-label="Modo de conexão">
        <button className="button secondary" type="button" aria-pressed={!creating} onClick={() => { setCreating(false); setError(''); }}><LogIn aria-hidden="true" />ENTRAR EM PARTIDA</button>
        <button className="button secondary" type="button" aria-pressed={creating} onClick={() => { setCreating(true); setError(''); }}><Plus aria-hidden="true" />CRIAR PARTIDA</button>
      </div>
      <p>NEON FACILITY / FREE FOR ALL</p>
      <div className="setting-row"><label htmlFor="lan-name">Nome do jogador</label>
        <input id="lan-name" required maxLength={20} autoComplete="nickname" value={preferences.profile.name}
          onChange={(event) => update('profile', { name: event.target.value })} /></div>
      <div className="setting-row"><label htmlFor="lan-address">Endereço do servidor</label>
        <input id="lan-address" required autoComplete="off" spellCheck={false} placeholder="http://192.168.0.10:3000"
          value={address} onChange={(event) => setAddress(event.target.value)} /></div>
      {creating ? <>
        <div className="setting-row"><label htmlFor="room-name">Nome da sala</label><input id="room-name" required maxLength={20} value={roomName} onChange={(e) => setRoomName(e.target.value)} /></div>
        <div className="setting-row"><label htmlFor="room-map">Mapa</label><select id="room-map" value="neon-facility" onChange={() => {}}><option value="neon-facility">NEON FACILITY</option></select></div>
        <div className="setting-row"><label htmlFor="room-mode">Modo de jogo</label><select id="room-mode" value="ffa" onChange={() => {}}><option value="ffa">FREE FOR ALL</option></select></div>
        <div className="setting-row"><label htmlFor="room-max">Máximo de jogadores</label><select id="room-max" value={maxPlayers} onChange={(e) => setMaxPlayers(Number(e.target.value))}>{[2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n}>{n}</option>)}</select></div>
        <label className="room-ready-option"><input type="checkbox" checked={requireReady} onChange={(e) => setRequireReady(e.target.checked)} />Exigir jogadores prontos</label>
      </> : rooms && <div className="setting-row"><label htmlFor="room-code">Código da sala (opcional)</label><input id="room-code" maxLength={8} autoComplete="off" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} /></div>}
      {error && <p role="alert" className="network-status">{error}</p>}
      <div className="action-row"><button className="button primary" type="submit">{creating ? <Plus aria-hidden="true" /> : <LogIn aria-hidden="true" />}{creating ? 'CRIAR SERVIDOR/SALA' : 'CONECTAR'}</button></div>
    </form>
  </section>;
}
