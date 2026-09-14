import { createRoot } from 'react-dom/client';
import { HudSummary } from '../../client/src/ui/hud/HudSummary';
import { Scoreboard } from '../../client/src/ui/hud/Scoreboard';
import type { ScoreRow } from '../../shared/src/gameplay/hud';

// Test-only renderer fixture; never imported by the app or a production entry point.
export function mountFixture() {
  const host = document.createElement('div'); host.className = 'fps-chrome'; host.dataset.testid = 'hud-fixture';
  document.querySelector<HTMLElement>('.fps-chrome')!.style.visibility = 'hidden';
  document.body.append(host);
  const players: ScoreRow[] = [0, 500, 300, 100, 0, 700, 400, 200].map((score, index) => ({
    id: `fixture-${index}`, name: index === 0 ? '<b>Chris</b>' : 'ABCDEFGHIJKLMNOPQRST', score, eliminations: score / 100,
    deaths: index, pingMs: index === 0 || index === 4 ? null : 12 + index, local: index === 0,
  }));
  createRoot(host).render(<>
    <HudSummary hud={{ clock: { kind: 'remaining', seconds: 577 }, score: 0, deaths: 0, players, feed: [] }} />
    <Scoreboard players={players} respawn={0} />
  </>);
}
