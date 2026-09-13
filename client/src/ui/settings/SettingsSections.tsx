import { Maximize, Minimize } from 'lucide-react';
import type { Preferences } from '../../settings/preferences';
import type { UpdatePreferences } from '../../settings/usePreferences';
import { useFullscreen } from '../../settings/useFullscreen';
import { SelectControl, Slider, Toggle } from '../controls';

export interface SettingsSectionProps { preferences: Preferences; update: UpdatePreferences }

export function VideoSettings({ preferences: { video }, update }: SettingsSectionProps) {
  const fullscreen = useFullscreen();
  return <>
    <SelectControl label="Resolução de renderização" value={video.resolution} onChange={(value) => update('video', { resolution: value as Preferences['video']['resolution'] })}>
      <option value="native">Nativa</option><option value="1920x1080">1920 × 1080</option>
      <option value="1600x900">1600 × 900</option><option value="1280x720">1280 × 720</option>
    </SelectControl>
    <div className="setting-row"><span>Tela cheia</span><button className="button secondary compact" onClick={() => { void fullscreen.toggle(); }}
      aria-pressed={fullscreen.active} disabled={fullscreen.pending || !fullscreen.supported}>
      {fullscreen.active ? <Minimize aria-hidden="true" /> : <Maximize aria-hidden="true" />}
      {fullscreen.active ? 'Sair da tela cheia' : 'Ativar tela cheia'}
    </button></div>
    {fullscreen.error && <p className="inline-notice" role="alert">{fullscreen.error}</p>}
    {!fullscreen.supported && <p className="inline-notice">Tela cheia indisponível neste navegador.</p>}
    <SelectControl label="Qualidade" value={video.quality} onChange={(value) => update('video', { quality: value as Preferences['video']['quality'] })}>
      <option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option>
    </SelectControl>
    <Toggle label="Sombras" checked={video.shadows} onChange={(shadows) => update('video', { shadows })} />
    <SelectControl label="FPS máximo" value={video.maxFps} onChange={(value) => update('video', { maxFps: Number(value) as Preferences['video']['maxFps'] })}>
      <option value="30">30</option><option value="60">60</option><option value="120">120</option><option value="0">Sem limite</option>
    </SelectControl>
    <Slider label="FOV da partida" min={60} max={110} value={video.fov} unit="°" onChange={(fov) => update('video', { fov })} />
  </>;
}

export function AudioSettings({ preferences: { audio }, update }: SettingsSectionProps) {
  return <>{([
    ['master', 'Volume geral'], ['effects', 'Efeitos'], ['music', 'Música'], ['interface', 'Interface'], ['footsteps', 'Passos'],
  ] as const).map(([key, label]) => <Slider key={key} label={label} value={audio[key]} unit="%" onChange={(value) => update('audio', { [key]: value })} />)}</>;
}

export function ControlsSettings({ preferences: { controls }, update }: SettingsSectionProps) {
  return <>
    <Slider label="Sensibilidade do mouse" min={0.1} max={3} step={0.1} value={controls.sensitivity} onChange={(sensitivity) => update('controls', { sensitivity })} />
    <dl className="key-bindings">{[
      ['Frente', 'W'], ['Trás', 'S'], ['Esquerda', 'A'], ['Direita', 'D'], ['Pular', 'Espaço'], ['Correr', 'Shift'],
      ['Disparar', 'Mouse 1'], ['Mira secundária', 'Mouse 2'], ['Recarregar', 'R'], ['Equipamentos', '1 / 2 / 3'], ['Placar', 'TAB'], ['Menu', 'ESC'],
    ].map(([action, key]) => <div key={action}><dt>{action}</dt><dd><kbd>{key}</kbd></dd></div>)}</dl>
  </>;
}

export function GameplaySettings({ preferences: { gameplay }, update }: SettingsSectionProps) {
  return <>
    <Toggle label="Head bob" checked={gameplay.headBob} onChange={(headBob) => update('gameplay', { headBob })} />
    <div className="setting-row"><span>Tutorial</span><button className="button secondary compact"
      onClick={() => update('gameplay', { tutorialCompleted: false })} disabled={!gameplay.tutorialCompleted}>MOSTRAR TUTORIAL NOVAMENTE</button></div>
    <p className="inline-notice" role="status">{gameplay.tutorialCompleted ? 'Tutorial concluído.' : 'Tutorial agendado para a primeira partida.'}</p>
  </>;
}
