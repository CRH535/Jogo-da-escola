import { useState } from 'react';
import { APP_VERSION, GAME_NAME } from '@neon-strike/shared';
import { UserRound } from 'lucide-react';
import { SceneViewport, type RendererStatus } from '../game/SceneViewport';
import { usePreferences } from '../settings/usePreferences';
import { MainMenu } from '../ui/MainMenu';
import { PlayScreen } from '../ui/PlayScreen';
import { MapScreen } from '../ui/MapScreen';
import { PlayerScreen } from '../ui/PlayerScreen';
import { CreditsScreen, ExitScreen, MultiplayerScreen, TrainingScreen } from '../ui/InformationScreens';
import { SettingsScreen } from '../ui/settings/SettingsScreen';
import { useMenuNavigation } from './useMenuNavigation';
import { useServerStatus } from './useServerStatus';
import './menu.css';

const serverLabels = {
  connecting: 'Conectando...', online: 'Servidor online',
  unavailable: 'Servidor indisponível', incompatible: 'Versão incompatível',
};
const rendererLabels = {
  loading: 'Inicializando 3D...', ready: 'Renderização ativa', failed: '3D indisponível',
};

export function App() {
  const [rendererStatus, setRendererStatus] = useState<RendererStatus>('loading');
  const serverStatus = useServerStatus();
  const settings = usePreferences();
  const { preferences, update, saved, resetSettings } = settings;
  const { screen, navigate } = useMenuNavigation();
  const onBack = () => navigate('menu');
  if (screen === 'map') return <MapScreen video={preferences.video} onBack={() => navigate('play')} />;
  if (screen === 'arena') return <PlayerScreen settings={settings} onBack={() => navigate('play')} onMenu={onBack} />;
  return <div className="game-shell">
    <SceneViewport onStatus={setRendererStatus} video={preferences.video} />
    <div className="interface-layer">
    <header className="masthead">
      <div className="brand"><p className="eyebrow">FPS DE ARENA FUTURISTA</p><h1>{GAME_NAME}</h1></div>
      <div className="profile-label"><UserRound aria-hidden="true" /><span>{preferences.profile.name || 'Player'}</span></div>
    </header>
    {rendererStatus === 'failed' && <div className="graphics-error" role="alert">
      <strong>Renderização indisponível</strong><p>Ative a aceleração gráfica em um navegador com WebGL 2 e recarregue a página.</p>
    </div>}
    <main className={`menu-content ${screen !== 'menu' ? 'inner-screen' : ''}`}>
      {screen === 'menu' && <MainMenu navigate={navigate} />}
      {screen === 'play' && <PlayScreen preferences={preferences} update={update} onBack={onBack} onMap={() => navigate('map')} onExplore={() => navigate('arena')} />}
      {screen === 'settings' && <SettingsScreen preferences={preferences} update={update} saved={saved} resetSettings={resetSettings} onBack={onBack} />}
      {screen === 'multiplayer' && <MultiplayerScreen onBack={onBack} />}
      {screen === 'training' && <TrainingScreen onBack={onBack} />}
      {screen === 'credits' && <CreditsScreen onBack={onBack} />}
      {screen === 'exit' && <ExitScreen onBack={onBack} />}
    </main>
    <footer className="system-footer">
      <div className="build-label"><span className="build-indicator" />PRE-ALPHA <span>{APP_VERSION}</span></div>
      <div className="system-status" aria-live="polite" aria-atomic="true">
        <span className="status" data-status={rendererStatus}>{rendererLabels[rendererStatus]}</span>
        <span className="status" data-status={serverStatus}>{serverLabels[serverStatus]}</span>
      </div>
    </footer>
    </div>
  </div>;
}
