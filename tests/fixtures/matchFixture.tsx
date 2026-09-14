import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { FFA_RULES } from '../../shared/src/match/MatchManager';
import { PlayerScreen } from '../../client/src/ui/PlayerScreen';
import { usePreferences } from '../../client/src/settings/usePreferences';
import '../../client/src/app/global.css';
import '../../client/src/app/menu.css';

// Isolated Vite-only entry point: real runtime with short rules, never imported by the app/build.
const timed = new URLSearchParams(location.search).get('finish') === 'time';
const rules = Object.freeze({ ...FFA_RULES, durationTicks: timed ? 120 : 3600, eliminationLimit: timed ? 30 : 1 });
function Fixture() {
  const settings = usePreferences();
  const [menu, setMenu] = useState(false);
  if (menu) return <h1>MENU DA FIXTURE</h1>;
  return <PlayerScreen bots rules={rules} settings={settings} onMenu={() => setMenu(true)} onBack={() => setMenu(true)} />;
}
export function mountFixture() { createRoot(document.getElementById('root')!).render(<Fixture />); }
