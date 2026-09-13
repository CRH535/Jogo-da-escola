import { ArrowLeft } from 'lucide-react';

export function ScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return <header className="screen-header">
    <button className="icon-button" onClick={onBack} aria-label="Voltar ao menu" title="Voltar ao menu"><ArrowLeft aria-hidden="true" /></button>
    <h2 tabIndex={-1} data-screen-title>{title}</h2>
  </header>;
}
