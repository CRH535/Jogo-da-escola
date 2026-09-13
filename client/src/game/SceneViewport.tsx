import { useEffect, useRef } from 'react';
import type { FoundationScene } from './rendering/createFoundationScene';
import type { Preferences } from '../settings/preferences';

export type RendererStatus = 'loading' | 'ready' | 'failed';

interface SceneViewportProps {
  onStatus: (status: RendererStatus) => void;
  video: Preferences['video'];
}

export function SceneViewport({ onStatus, video }: SceneViewportProps) {
  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<FoundationScene | null>(null);
  const videoRef = useRef(video);
  videoRef.current = video;
  useEffect(() => {
    let active = true;
    onStatus('loading');
    void import('./rendering/createFoundationScene').then(({ createFoundationScene }) => {
      if (!active || !container.current) return;
      scene.current = createFoundationScene(container.current, () => onStatus('failed'), videoRef.current);
      onStatus('ready');
    }).catch((error: unknown) => {
      if (!active) return;
      console.error('[RENDERER] Initialization failed', error);
      onStatus('failed');
    });
    return () => {
      active = false;
      scene.current?.dispose();
      scene.current = null;
    };
  }, [onStatus]);
  useEffect(() => { scene.current?.setVideo(video); }, [video]);

  return <div ref={container} className="scene-viewport" />;
}
