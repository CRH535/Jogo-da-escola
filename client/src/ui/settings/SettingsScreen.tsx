import { useState, type KeyboardEvent } from 'react';
import { Check, Gamepad2, Keyboard, Monitor, RotateCcw, Volume2 } from 'lucide-react';
import { ScreenHeader } from '../ScreenHeader';
import { ConfirmDialog } from '../ConfirmDialog';
import { AudioSettings, ControlsSettings, GameplaySettings, VideoSettings, type SettingsSectionProps } from './SettingsSections';

const tabs = [
  { id: 'video', label: 'VÍDEO', icon: Monitor, component: VideoSettings },
  { id: 'audio', label: 'ÁUDIO', icon: Volume2, component: AudioSettings },
  { id: 'controls', label: 'CONTROLES', icon: Keyboard, component: ControlsSettings },
  { id: 'gameplay', label: 'JOGABILIDADE', icon: Gamepad2, component: GameplaySettings },
] as const;

interface SettingsScreenProps extends SettingsSectionProps {
  onBack: () => void; resetSettings: () => void; saved: boolean | null;
}

export function SettingsScreen({ onBack, resetSettings, saved, ...sectionProps }: SettingsScreenProps) {
  const [tabIndex, setTabIndex] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);
  const [notice, setNotice] = useState('');
  const activeTab = tabs[tabIndex]!;
  const Section = activeTab.component;
  function moveTab(event: KeyboardEvent<HTMLButtonElement>, current: number) {
    let next: number;
    if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (current + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    setTabIndex(next);
    document.getElementById(`tab-${tabs[next]!.id}`)?.focus();
  }
  return <section className="screen settings-screen">
    <ScreenHeader title="CONFIGURAÇÕES" onBack={onBack} />
    <div className="settings-tabs" role="tablist" aria-label="Categorias de configurações">
      {tabs.map(({ id, label, icon: Icon }, index) => <button key={id} id={`tab-${id}`} role="tab"
        aria-selected={index === tabIndex} aria-controls={`panel-${id}`} tabIndex={index === tabIndex ? 0 : -1}
        onClick={() => setTabIndex(index)} onKeyDown={(event) => moveTab(event, index)}><Icon aria-hidden="true" /><span>{label}</span></button>)}
    </div>
    <div className="settings-panel" role="tabpanel" id={`panel-${activeTab.id}`} aria-labelledby={`tab-${activeTab.id}`}>
      <Section {...sectionProps} />
    </div>
    <div className="settings-actions">
      <span className={`save-state ${saved === false ? 'unsaved' : ''}`} role="status"><Check aria-hidden="true" />
        {saved === null ? 'Salvando...' : saved ? 'Salvo neste navegador' : 'Alterações só nesta sessão'}
      </span>
      <button className="button secondary compact" onClick={() => setConfirmReset(true)}><RotateCcw aria-hidden="true" />Restaurar padrões</button>
    </div>
    {notice && <p className="inline-notice" role="status">{notice}</p>}
    {confirmReset && <ConfirmDialog onCancel={() => setConfirmReset(false)} onConfirm={() => {
      resetSettings(); setConfirmReset(false); setNotice('Configurações restauradas.');
    }} />}
  </section>;
}
