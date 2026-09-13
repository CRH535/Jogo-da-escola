import { ChevronRight, Crosshair, Info, LogOut, Play, Settings, Users } from 'lucide-react';
import type { MenuScreen } from '../app/useMenuNavigation';

const entries = [
  { screen: 'play', label: 'JOGAR', icon: Play },
  { screen: 'multiplayer', label: 'MULTIPLAYER', icon: Users },
  { screen: 'training', label: 'TREINAMENTO', icon: Crosshair },
  { screen: 'settings', label: 'CONFIGURAÇÕES', icon: Settings },
  { screen: 'credits', label: 'CRÉDITOS', icon: Info },
  { screen: 'exit', label: 'SAIR', icon: LogOut },
] as const;

export function MainMenu({ navigate }: { navigate: (screen: MenuScreen) => void }) {
  return <div className="home-screen">
    <nav className="main-menu" aria-label="Menu principal">
      {entries.map(({ screen, label, icon: Icon }, index) => <button key={screen} data-screen={screen}
        className={`menu-command ${index === 0 ? 'menu-command-primary' : ''}`} onClick={() => navigate(screen)}>
        <Icon aria-hidden="true" /><span>{label}</span><ChevronRight className="menu-chevron" aria-hidden="true" />
      </button>)}
    </nav>
    <div className="scene-caption" aria-hidden="true"><span>NX / 01</span><span>NEON STRIKE</span></div>
  </div>;
}
