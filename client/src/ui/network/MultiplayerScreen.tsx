import { useState } from 'react';
import { LogIn, Plus } from 'lucide-react';
import { validName } from '@neon-strike/shared/network';
import type { NetworkOptions } from '../../network/NetworkManager';
import { serverAddress } from '../../network/serverAddress';
import type { Preferences } from '../../settings/preferences';
import type { UpdatePreferences } from '../../settings/usePreferences';
import { ScreenHeader } from '../ScreenHeader';
import './network.css';

export function MultiplayerScreen({ preferences, update, onBack, onConnect }: {
  preferences: Preferences; update: UpdatePreferences; onBack: () => void; onConnect: (options: NetworkOptions) => void;
}) {
  const [address, setAddress] = useState(window.location.origin);
  const [error, setError] = useState('');
  return <section className="screen">
    <ScreenHeader title="MULTIPLAYER" onBack={onBack} />
    <form className="network-form" onSubmit={(event) => {
      event.preventDefault();
      const name = preferences.profile.name.trim();
      const origin = serverAddress(address);
      if (!validName(name)) { setError('Informe um nome de 1 a 20 caracteres.'); return; }
      if (!origin) { setError('Endereço inválido. Use http://IP:porta ou https://servidor.'); return; }
      update('profile', { name }); setError(''); onConnect({ name, address: origin });
    }}>
      <p className="eyebrow">REDE LOCAL / LAN</p><h3 className="section-title">ENTRAR EM PARTIDA</h3>
      <p>NEON FACILITY / FREE FOR ALL</p>
      <div className="setting-row"><label htmlFor="lan-name">Nome do jogador</label>
        <input id="lan-name" required maxLength={20} autoComplete="nickname" value={preferences.profile.name}
          onChange={(event) => update('profile', { name: event.target.value })} /></div>
      <div className="setting-row"><label htmlFor="lan-address">Endereço do servidor</label>
        <input id="lan-address" required autoComplete="off" spellCheck={false} placeholder="http://192.168.0.10:3000"
          value={address} onChange={(event) => setAddress(event.target.value)} /></div>
      {error && <p role="alert" className="network-status">{error}</p>}
      <div className="action-row"><button className="button primary" type="submit"><LogIn aria-hidden="true" />CONECTAR</button>
        <button className="button secondary" type="button" disabled title="Salas disponíveis na Etapa 11"><Plus aria-hidden="true" />CRIAR PARTIDA</button></div>
    </form>
  </section>;
}
