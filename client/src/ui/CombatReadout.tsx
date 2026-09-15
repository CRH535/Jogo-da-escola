import type { TrainingReadout } from '../game/combat/TrainingRuntime';
import { EventFeed } from './hud/EventFeed';
import { HudSummary } from './hud/HudSummary';
import { Scoreboard } from './hud/Scoreboard';
import './combat.css';
import './hud/hud.css';

export function CombatReadout({ state, playing, scoreboard }: { state: TrainingReadout; playing: boolean; scoreboard: boolean }) {
  const lowAmmo = state.magazine <= Math.ceil(state.capacity * 0.2);
  return <div className="combat-readout" aria-label={state.hud.mode === 'network' ? 'Estado do combate online' : state.hud.mode === 'bots' ? 'Estado do combate' : 'Estado do treinamento'} data-hp={state.hp} data-magazine={state.magazine}
    data-reserve={state.reserve} data-selected={state.selected} data-hits={state.hits} data-eliminations={state.eliminations} data-reload={state.reload} data-aiming={state.aiming}
    data-score={state.hud.score} data-deaths={state.hud.deaths} data-time={state.hud.clock.seconds} data-match-state={state.match?.state}>
    {playing && <>
      <HudSummary hud={state.hud} />
      {state.waiting && !scoreboard && <div className="match-countdown" role="status"><span>AGUARDANDO ADVERSÁRIO</span></div>}
      {!scoreboard && state.match && (state.match.countdown > 0 || state.match.go) && <div className="match-countdown" role="status" aria-label="Contagem inicial">
        <span>FREE FOR ALL</span><strong>{state.match.countdown || 'GO!'}</strong>
      </div>}
      {!scoreboard && <EventFeed events={state.hud.feed} />}
      <div className="combat-bottom">
        <div className="combat-health" data-low={state.hp <= 25}><span>VIDA</span><strong>{state.hp}<small> HP</small></strong><meter min={0} max={100} value={state.hp} aria-label="Vida" /></div>
        <div className="combat-weapon" data-low={lowAmmo}><span>{state.name}</span><strong>{state.magazine.toString().padStart(2, '0')}<small> / {state.reserve}</small></strong>
          <span className="combat-reload" role="status">{state.reload > 0 ? 'RECARREGANDO...' : state.magazine === 0 ? 'SEM CARGA' : lowAmmo ? 'CARGA BAIXA' : '\u00a0'}</span>
          <div className="combat-reload-track">{state.reload > 0 && <progress aria-label="Progresso da recarga" max={1} value={state.reloadProgress} />}</div>
        </div>
      </div>
      {!scoreboard && state.hit && <div className="combat-hit" aria-label="Acerto" />}
      {state.damaged && <div className="combat-damage" aria-hidden="true" />}
      {state.hp === 0 && !scoreboard && <div className="combat-death" role="status"><h2>VOCÊ FOI ELIMINADO</h2><p>RESPAWN EM <strong>{state.respawn}</strong></p></div>}
      {scoreboard && <Scoreboard players={state.hud.players} respawn={state.hp === 0 ? state.respawn : 0} mode={state.hud.mode ?? 'training'} />}
    </>}
  </div>;
}
