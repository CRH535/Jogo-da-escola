import { ArrowLeft, Crosshair, LockKeyhole, LogIn, Plus, Power } from 'lucide-react';
import { ScreenHeader } from './ScreenHeader';

export function MultiplayerScreen({ onBack }: { onBack: () => void }) {
  return <section className="screen">
    <ScreenHeader title="MULTIPLAYER" onBack={onBack} />
    <div className="empty-state"><LockKeyhole className="state-icon" aria-hidden="true" /><span className="eyebrow">REDE LOCAL / LAN</span>
      <h3>Multiplayer em preparação</h3><p id="network-availability">Salas e conexão entre jogadores indisponíveis nesta versão.</p>
      <div className="action-row"><button className="button primary" disabled aria-describedby="network-availability"><Plus aria-hidden="true" />CRIAR PARTIDA</button>
        <button className="button secondary" disabled aria-describedby="network-availability"><LogIn aria-hidden="true" />ENTRAR EM PARTIDA</button></div>
    </div>
  </section>;
}

export function TrainingScreen({ onBack }: { onBack: () => void }) {
  return <section className="screen">
    <ScreenHeader title="TREINAMENTO" onBack={onBack} />
    <div className="empty-state"><Crosshair className="state-icon" aria-hidden="true" /><span className="eyebrow">SESSÃO SOLO</span>
      <h3>Área de treinamento</h3><p id="training-availability">Treinamento indisponível nesta versão.</p>
      <button className="button primary" disabled aria-describedby="training-availability"><LockKeyhole aria-hidden="true" />INICIAR TREINAMENTO</button>
    </div>
  </section>;
}

export function CreditsScreen({ onBack }: { onBack: () => void }) {
  return <section className="screen"><ScreenHeader title="CRÉDITOS" onBack={onBack} />
    <div className="credits-intro"><p className="eyebrow">NEON STRIKE</p><h3>Projeto independente.</h3>
      <p>Desenvolvido utilizando tecnologias web.</p><p>Geometria original criada em código. Sem áudio nesta versão.</p></div>
    <table className="credits-table"><caption>Bibliotecas e licenças</caption><thead><tr><th scope="col">Biblioteca</th><th scope="col">Licença</th></tr></thead>
      <tbody>{[
        ['React / React DOM', 'MIT'], ['Three.js', 'MIT'], ['Express', 'MIT'], ['Lucide', 'ISC'],
        ['Rapier', 'Apache-2.0'],
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
