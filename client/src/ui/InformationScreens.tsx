import { ArrowLeft, Crosshair, Play, Power } from 'lucide-react';
import { ScreenHeader } from './ScreenHeader';

export function TrainingScreen({ onBack, onStart }: { onBack: () => void; onStart: () => void }) {
  return <section className="screen">
    <ScreenHeader title="TREINAMENTO" onBack={onBack} />
    <div className="empty-state"><Crosshair className="state-icon" aria-hidden="true" /><span className="eyebrow">SESSÃO SOLO</span>
      <h3>NEON FACILITY</h3><p>NX-7 Pulse / VX Scatter / ARC-9</p>
      <button data-screen="range" className="button primary" onClick={onStart}><Play aria-hidden="true" />INICIAR TREINAMENTO</button>
    </div>
  </section>;
}

export function CreditsScreen({ onBack }: { onBack: () => void }) {
  return <section className="screen"><ScreenHeader title="CRÉDITOS" onBack={onBack} />
    <div className="credits-intro"><p className="eyebrow">NEON STRIKE</p><h3>Projeto independente.</h3>
      <p>Desenvolvido utilizando tecnologias web.</p><p>Geometria original criada em código. Áudio sintético original (provisório).</p></div>
    <table className="credits-table"><caption>Bibliotecas e licenças</caption><thead><tr><th scope="col">Biblioteca</th><th scope="col">Licença</th></tr></thead>
      <tbody>{[
        ['React / React DOM', 'MIT'], ['Three.js', 'MIT'], ['Express / Socket.IO / Socket.IO Client', 'MIT'], ['Lucide', 'ISC'],
        ['Rapier', 'Apache-2.0'], ['ngraph.graph / ngraph.events', 'BSD-3-Clause'], ['ngraph.path', 'MIT'],
        ['Vite / plugin React', 'MIT'], ['TypeScript', 'Apache-2.0'], ['tsx / concurrently', 'MIT'],
        ['Playwright', 'Apache-2.0'], ['pngjs / DefinitelyTyped', 'MIT'],
      ].map(([name, license]) => <tr key={name}><td>{name}</td><td>{license}</td></tr>)}</tbody>
    </table>
  </section>;
}

export function ExitScreen({ onBack }: { onBack: () => void }) {
  return <section className="screen"><ScreenHeader title="SAIR" onBack={onBack} />
    <div className="empty-state"><Power className="state-icon" aria-hidden="true" /><h3>Até a próxima.</h3>
      <p>Você já pode fechar esta aba.</p><button className="button secondary" onClick={onBack}><ArrowLeft aria-hidden="true" />VOLTAR AO MENU</button>
    </div>
  </section>;
}
