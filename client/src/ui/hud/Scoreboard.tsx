import { sortScoreboard, type ScoreRow } from '@neon-strike/shared/hud';

const columns = [['ELIMINAÇÕES', 'ELIM.'], ['DERROTAS', 'DER.'], ['PONTUAÇÃO', 'PTS.'], ['PING', 'PING']] as const;
export function Scoreboard({ players, respawn, mode = 'training' }: { players: readonly ScoreRow[]; respawn: number; mode?: 'training' | 'bots' }) {
  return <section className="hud-scoreboard" role="region" aria-label="Placar">
    <header><div><span className="eyebrow">NEON FACILITY / {mode === 'bots' ? 'BOTS' : 'TREINAMENTO'}</span><h2>PLACAR</h2></div>
      <span className="scoreboard-status">{respawn > 0 ? `RESPAWN EM ${respawn}` : 'SESSÃO LOCAL'}</span></header>
    <ScoreTable players={players} mode={mode} />
  </section>;
}

export function ScoreTable({ players, mode = 'training' }: { players: readonly ScoreRow[]; mode?: 'training' | 'bots' }) {
  return <table className="score-table">
      <caption className="sr-only">Pontuação {mode === 'bots' ? 'da arena' : 'do treinamento'}, ordenada da maior para a menor.</caption>
      <colgroup><col className="score-player-col" /><col span={4} /></colgroup>
      <thead><tr><th scope="col">JOGADOR</th>{columns.map(([name, short]) =>
        <th key={name} scope="col" aria-label={name} aria-sort={name === 'PONTUAÇÃO' ? 'descending' : undefined}>
          <span className="score-label-long">{name}</span><abbr className="score-label-short" title={name}>{short}</abbr>
        </th>)}</tr></thead>
      <tbody>{sortScoreboard(players).map((player, index) => <tr key={player.id} data-player-id={player.id} data-local={player.local}>
        <th scope="row"><span className="score-player"><span className="score-rank">{index + 1}</span><span className="score-name">{player.name}</span></span></th>
        <td>{player.eliminations}</td><td>{player.deaths}</td><td className="score-points">{player.score}</td>
        <td className="score-ping">{player.bot ? 'BOT' : player.pingMs === null ? player.local ? 'LOCAL' : '--' : `${Math.round(player.pingMs)} ms`}</td>
      </tr>)}</tbody>
    </table>;
}
