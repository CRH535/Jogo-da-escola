import { Signal, Users } from 'lucide-react';
import type { NetworkReadout as Readout } from '../../network/NetworkManager';
import './network.css';

export function NetworkReadout({ state, scoreboard, combat = false }: { state: Readout; scoreboard: boolean; combat?: boolean }) {
  const players = state.snapshot?.players ?? [];
  const local = players.find((player) => player.id === state.id);
  return <div className="network-readout" data-combat={combat} aria-label="Estado da rede" data-state={state.state} data-id={state.id}
    data-tick={import.meta.env.DEV ? state.snapshot?.tick : undefined} data-players={import.meta.env.DEV ? JSON.stringify(players) : undefined}>
    <section className="network-summary" aria-label="Resumo da rede"><span><Users aria-hidden="true" /><strong aria-label="Jogadores conectados">{players.filter((p) => p.connected).length}</strong></span>
      <span><Signal aria-hidden="true" /><strong aria-label="Ping">{local?.pingMs === null || local?.pingMs === undefined ? '--' : `${local.pingMs} ms`}</strong></span></section>
    {scoreboard && <section className="hud-scoreboard network-board" aria-label="Jogadores LAN"><header><div><p className="eyebrow">NEON FACILITY / LAN</p><h2>JOGADORES</h2></div><span className="scoreboard-status">MOVIMENTAÇÃO</span></header>
      <table className="score-table"><thead><tr><th scope="col">JOGADOR</th><th scope="col">STATUS</th><th scope="col">PING</th></tr></thead>
        <tbody>{players.map((p) => <tr key={p.id} data-local={p.id === state.id}><th scope="row">{p.name}</th>
          <td>{!p.connected ? 'RECONECTANDO' : p.active ? 'NA ARENA' : 'MENU'}</td><td>{p.pingMs === null ? '--' : `${p.pingMs} ms`}</td></tr>)}</tbody></table>
    </section>}
  </div>;
}
