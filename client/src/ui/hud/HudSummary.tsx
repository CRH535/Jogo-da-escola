import { Clock3, Trophy, Users } from 'lucide-react';
import { formatDuration, type HudSnapshot } from '@neon-strike/shared/hud';

export function HudSummary({ hud }: { hud: HudSnapshot }) {
  const time = formatDuration(hud.clock.seconds);
  return <section className="hud-summary" aria-label="Resumo da sessão">
    <div className="hud-stat hud-score"><span><Trophy aria-hidden="true" />PONTOS</span><strong aria-label="Pontuação">{hud.score}</strong></div>
    <div className="hud-stat hud-clock" data-long={time.length > 5}><span><Clock3 aria-hidden="true" />{hud.clock.kind === 'remaining' ? 'RESTANTE' : hud.mode === 'bots' ? 'TEMPO DE ARENA' : 'TEMPO DE TREINO'}</span>
      <strong aria-label={hud.clock.kind === 'remaining' ? 'Tempo restante' : hud.mode === 'bots' ? 'Tempo de arena' : 'Tempo de treino'}>{time}</strong></div>
    <div className="hud-stat hud-players"><span><Users aria-hidden="true" />JOGADORES</span><strong aria-label="Quantidade de jogadores">{hud.players.length}</strong></div>
  </section>;
}
