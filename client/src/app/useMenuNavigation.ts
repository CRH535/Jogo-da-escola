import { useCallback, useEffect, useRef, useState } from 'react';

const screens = ['menu', 'play', 'map', 'arena', 'range', 'bots', 'lan', 'multiplayer', 'training', 'settings', 'credits', 'exit'] as const;
export type MenuScreen = typeof screens[number];

function currentScreen(): MenuScreen {
  const hash = window.location.hash.slice(1);
  return screens.includes(hash as MenuScreen) ? hash as MenuScreen : 'menu';
}

export function useMenuNavigation() {
  const [screen, setScreen] = useState(currentScreen);
  const lastScreen = useRef<MenuScreen>('menu');
  const initialized = useRef(false);
  const navigate = useCallback((next: MenuScreen) => { window.location.hash = next; }, []);

  useEffect(() => {
    const changed = () => setScreen(currentScreen());
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  useEffect(() => {
    if (initialized.current) {
      if (screen === 'menu') document.querySelector<HTMLButtonElement>(`[data-screen="${lastScreen.current === 'arena' || lastScreen.current === 'bots' ? 'play' : lastScreen.current === 'range' ? 'training' : lastScreen.current}"]`)?.focus();
      else if (screen === 'training' && lastScreen.current === 'range') document.querySelector<HTMLButtonElement>('[data-screen="range"]')?.focus();
      else if (screen === 'play' && (lastScreen.current === 'map' || lastScreen.current === 'arena' || lastScreen.current === 'bots')) document.querySelector<HTMLButtonElement>(`[data-screen="${lastScreen.current}"]`)?.focus();
      else document.querySelector<HTMLElement>('[data-screen-title]')?.focus();
    }
    initialized.current = true;
    window.scrollTo(0, 0);
    lastScreen.current = screen;
  }, [screen]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (screen === 'arena' || screen === 'range' || screen === 'bots' || screen === 'lan') return;
      if (event.key !== 'Escape' || event.defaultPrevented || document.querySelector('dialog[open]') || document.fullscreenElement) return;
      if (screen !== 'menu') { event.preventDefault(); navigate(screen === 'map' ? 'play' : 'menu'); }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [screen, navigate]);
  return { screen, navigate };
}
