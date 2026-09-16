import { LogOut, RotateCcw, Trophy } from 'lucide-react';
import { accuracyPercent, type MatchResult } from '@neon-strike/shared/match';
import { formatDuration } from '@neon-strike/shared/hud';
import { ScoreTable } from '../hud/Scoreboard';
import './match.css';

export function MatchResults({ result, onAgain, onMenu, nextRoundSeconds, onLobby }: { result: Readonly<MatchResult>; onAgain: () => void; onMenu: () => void; nextRoundSeconds?: number | undefined; onLobby?: () => void }) {
  const position = result.players.findIndex((row) => row.local);
  const player = result.players[position] ?? { id: '', eliminations: 0, deaths: 0, score: 0, hits: 0, projectiles: 0 };
  const won = result.winnerId === player.id;
  return <section className="match-results" aria-label="Resultado da partida" data-outcome={position < 0 ? 'spectator' : won ? 'victory' : 'defeat'}>
    <header><p className="eyebrow">NEON FACILITY / FREE FOR ALL</p>
      <h2><Trophy aria-hidden="true" />{position < 0 ? 'PARTIDA ENCERRADA' : won ? 'VITÓRIA' : 'DERROTA'}</h2>
      <p className="match-winner">{result.players[0]?.name} <span>{result.reason === 'time' ? 'TEMPO ESGOTADO' : 'LIMITE DE ELIMINAÇÕES'}</span></p>
    </header>
    <dl className="match-metrics">
      {[
        ['POSIÇÃO', position < 0 ? '--' : `${position + 1} / ${result.players.length}`], ['ELIMINAÇÕES', player.eliminations],
        ['DERROTAS', player.deaths], ['PONTUAÇÃO', player.score],
        ['PRECISÃO', `${accuracyPercent(player.hits, player.projectiles)}%`], ['TEMPO', formatDuration(result.elapsedSeconds)],
      ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl>
    <ScoreTable players={result.players} mode={nextRoundSeconds === undefined ? 'bots' : 'network'} />
    <div className="match-actions">
      <button className="button primary" autoFocus disabled={!onLobby && nextRoundSeconds !== undefined} onClick={onLobby ?? onAgain}><RotateCcw aria-hidden="true" />{onLobby ? 'VOLTAR AO LOBBY' : nextRoundSeconds === undefined ? 'JOGAR NOVAMENTE' : `PRÓXIMA PARTIDA: ${nextRoundSeconds}`}</button>
      <button className="button secondary" onClick={onMenu}><LogOut aria-hidden="true" />MENU PRINCIPAL</button>
    </div>
  </section>;
}
