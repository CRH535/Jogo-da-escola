import { useRef, useState } from 'react';
import { Check, Copy, LogOut, Play, X } from 'lucide-react';
import type { LobbySnapshot } from '@neon-strike/shared/network';
import type { NetworkReadout } from '../../network/NetworkManager';

export function LobbyScreen({ lobby, state, onReady, onStart, onLeave }: {
  lobby: LobbySnapshot; state: NetworkReadout; onReady: (ready: boolean) => void; onStart: () => void; onLeave: () => void;
}) {
  const [address, setAddress] = useState(lobby.addresses[0] ?? '');
  const [copied, setCopied] = useState('');
  const field = useRef<HTMLInputElement>(null);
  const local = lobby.players.find((p) => p.id === state.id);
  const host = state.id === lobby.hostId;
  const connected = state.state === 'connected';
  const canStart = connected && lobby.players.filter((p) => p.connected).length >= 2 &&
    lobby.players.every((p) => p.connected && (!lobby.settings.requireReady || p.id === lobby.hostId || p.ready));
  const link = `${address}?room=${lobby.id}`;
  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied('ENDEREÇO COPIADO'); }
    catch { field.current?.focus(); field.current?.select(); setCopied('Cópia automática indisponível. Endereço selecionado.'); }
  }
  return <section className="lobby-screen" aria-label="Lobby da sala" data-room-id={lobby.id}>
    <header><p className="eyebrow">NEON STRIKE / LOBBY LAN</p><h2>{lobby.settings.name}</h2>
      <p className="lobby-meta">NEON FACILITY / FREE FOR ALL / {lobby.players.length} DE {lobby.settings.maxPlayers}</p></header>
    <p className="network-status" role="status">{state.message}</p>
    <table className="lobby-table"><thead><tr><th>JOGADOR</th><th>STATUS</th><th>PING</th></tr></thead><tbody>
      {lobby.players.map((p) => <tr key={p.id} data-local={p.id === state.id}>
        <th scope="row">{p.name}{p.id === lobby.hostId && <small>HOST</small>}</th>
        <td>{!p.connected ? 'RECONECTANDO' : p.id === lobby.hostId || p.ready ? 'PRONTO' : 'NÃO PRONTO'}</td>
        <td>{p.pingMs === null ? '--' : `${p.pingMs} ms`}</td>
      </tr>)}
    </tbody></table>
    <div className="lobby-address">
      {lobby.addresses.length > 1 && <label>Interface de rede<select value={address} onChange={(e) => { setAddress(e.target.value); setCopied(''); }}>{lobby.addresses.map((url) => <option key={url}>{url}</option>)}</select></label>}
      <label htmlFor="room-link">Endereço para conexão</label>
      <div><input id="room-link" ref={field} readOnly value={link} /><button className="button secondary" type="button" onClick={() => void copy()} title="Copiar endereço" aria-label="COPIAR ENDEREÇO"><Copy aria-hidden="true" /></button></div>
      {copied && <p className="network-status" role="status">{copied}</p>}
    </div>
    {host && !canStart && connected && <p className="lobby-wait">{lobby.players.length < 2 ? 'AGUARDANDO OUTRO JOGADOR' : 'AGUARDANDO JOGADORES PRONTOS'}</p>}
    <div className="lobby-actions">
      {host ? <button className="button primary" disabled={!canStart} onClick={onStart}><Play aria-hidden="true" />INICIAR PARTIDA</button> :
        <button className="button primary" disabled={!connected} onClick={() => onReady(!local?.ready)}>{local?.ready ? <X aria-hidden="true" /> : <Check aria-hidden="true" />}{local?.ready ? 'CANCELAR PRONTO' : 'PRONTO'}</button>}
      <button className="button secondary" onClick={onLeave}><LogOut aria-hidden="true" />{connected ? 'SAIR DA SALA' : 'VOLTAR AO MENU'}</button>
    </div>
  </section>;
}
