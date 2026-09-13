import { useEffect, useState } from 'react';

export function useFullscreen() {
  const [active, setActive] = useState(Boolean(document.fullscreenElement));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const changed = () => setActive(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', changed);
    return () => document.removeEventListener('fullscreenchange', changed);
  }, []);
  async function toggle() {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setError('Tela cheia indisponível neste navegador.');
    } finally {
      setPending(false);
      setActive(Boolean(document.fullscreenElement));
    }
  }
  return { active, pending, error, toggle, supported: Boolean(document.fullscreenEnabled) };
}
