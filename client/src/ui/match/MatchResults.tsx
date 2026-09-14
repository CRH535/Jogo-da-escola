import { LogOut, RotateCcw, Trophy } from 'lucide-react';
import { accuracyPercent, type MatchResult } from '@neon-strike/shared/match';
import { formatDuration } from '@neon-strike/shared/hud';
import { ScoreTable } from '../hud/Scoreboard';
import './match.css';

export function MatchResults({ result, onAgain, onMenu }: { result: Readonly<MatchResult>; onAgain: () => void; onMenu: () => void }) {
  const position = result.players.findIndex((row) => row.local);
  const player = result.players[position]!;
  const won = result.winnerId === player.id;
  return <section className="match-results" aria-label="Resultado da partida" data-outcome={won ? 'victory' : 'defeat'}>
    <header><p className="eyebrow">NEON FACILITY / FREE FOR ALL</p>
      <h2><Trophy aria-hidden="true" />{won ? 'VITÓRIA' : 'DERROTA'}</h2>
      <p className="match-winner">{result.players[0]?.name} <span>{result.reason === 'time' ? 'TEMPO ESGOTADO' : 'LIMITE DE ELIMINAÇÕES'}</span></p>
    </header>
    <dl className="match-metrics">
      {[
        ['POSIÇÃO', `${position + 1} / ${result.players.length}`], ['ELIMINAÇÕES', player.eliminations],
        ['DERROTAS', player.deaths], ['PONTUAÇÃO', player.score],
        ['PRECISÃO', `${accuracyPercent(player.hits, player.projectiles)}%`], ['TEMPO', formatDuration(result.elapsedSeconds)],
      ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl>
    <ScoreTable players={result.players} mode="bots" />
    <div className="match-actions">
      <button className="button primary" autoFocus onClick={onAgain}><RotateCcw aria-hidden="true" />JOGAR NOVAMENTE</button>
      <button className="button secondary" onClick={onMenu}><LogOut aria-hidden="true" />MENU PRINCIPAL</button>
    </div>
  </section>;
}
