# Etapa 2 - menus e configuracoes

Data: 13/09/2026. Escopo autorizado: somente a Etapa 2.
Status: implementada e validada. Etapa 3 nao iniciada.

## Implementado

- Menu principal com JOGAR, MULTIPLAYER, TREINAMENTO, CONFIGURACOES, CREDITOS e SAIR.
- Telas separadas, retorno ao menu, Escape, historico voltar/avancar e foco restaurado.
- Jogar: nome do jogador, NEON FACILITY, 1-7 bots e dificuldade Facil/Normal/Dificil.
- Multiplayer e treinamento com estados claros de indisponibilidade.
- Sair abre uma tela informativa; nao tenta fechar abas nem interrompe o servidor.
- Creditos com tecnologias e licencas, incluindo Lucide (ISC).
- Configuracoes divididas em VIDEO, AUDIO, CONTROLES e JOGABILIDADE.
- Resolucao interna, qualidade e limite de FPS aplicados ao renderer sem recria-lo.
- Fullscreen real por gesto, acompanhamento do estado e tratamento de recusa.
- FOV, sombras, volumes, sensibilidade, head bob e tutorial persistidos para os sistemas futuros.
- Dados locais versionados e normalizados: limites numericos, opcoes validas e nomes.
- Fallback para JSON corrompido, schema desconhecido e localStorage bloqueado.
- Restauracao com confirmacao e cancelamento, preservando nome e configuracao de partida.
- Abas navegaveis por teclado, controles rotulados e dialog com foco e Escape independentes.
- Cena da fundacao preservada, enquadrada para menu e carregada por import dinamico.
- Interface em uma camada de composicao acima do WebGL para manter textos nas transicoes.

## O que funciona agora e o que esta preparado

| Controle | Efeito nesta etapa |
| --- | --- |
| Resolucao / qualidade | Modificam o buffer de renderizacao, mantendo aspecto e teto de pixels |
| FPS maximo | Limita os frames renderizados da cena, independente de React |
| Tela cheia | Entra/sai pelo navegador; nao e ativada automaticamente apos reload |
| Sombras | Preferencia e estado do renderer; cena ainda sem objetos que projetem sombras |
| FOV / sensibilidade / head bob | Preferencias salvas para o futuro controlador FPS |
| Volumes | Preferencias salvas para o futuro AudioManager; ainda nao existe audio |
| Tutorial novamente | Reagenda a preferencia; tutorial visual vira com o fluxo jogavel |
| Nome / mapa / bots / dificuldade | Configuracao local salva; iniciar partida permanece bloqueado |

Nao ha mapa jogavel, movimento, disparos, bots, sockets ou lobby nesta entrega.
Os valores de FFA exibidos correspondem ao planejamento (10 minutos / 30 eliminacoes).
As telas nao simulam partidas nem conexoes inexistentes.

## Validacao

Ambiente: Windows, Node 24.15.0, npm 12.0.2 e Google Chrome.

| Comando / verificacao | Resultado |
| --- | --- |
| `npm install` | Lucide 1.45.0 instalado; 146 pacotes auditados, 0 vulnerabilidades reportadas |
| `npm run check` | Build TypeScript/Vite e 6 testes HTTP/configuracao/contrato aprovados |
| `npm run test:e2e` com PLAYWRIGHT_CHANNEL=chrome | 21 testes aprovados |
| `npm run test:build` com PLAYWRIGHT_CHANNEL=chrome | Build e 1 teste pelo Express aprovados |
| Inspecao visual | Capturas desktop 1440x900, 390x844 e 320x640; formularios e botoes sem overflow |
| Verificacao de pixels | Cena nao vazia, animacao, enquadramento e titulo desenhado tambem apos navegar |
| Identidade do canvas | Mantida ao trocar telas e alterar configuracoes de video |
| Health e proxy | Fundacao HTTP preservada; desenvolvimento continua em localhost:5173 |

Total: 28 testes (6 Node + 21 navegador + 1 build).
Capturas em `test-results/browser/`; artefatos de build em `test-results/build/`.
O teste de build tambem altera qualidade, recarrega a pagina e confirma persistencia
nas telas servidas por Express, sem Vite.

A suite cobre seis destinos, Escape/foco/historico, opcoes de bots, nomes vazios,
persistencia de video/audio/controles/jogabilidade, resolucao real do canvas,
confirmacao/cancelamento de reset, dados corrompidos, storage bloqueado, fullscreen
aceito/recusado, agendamento de tutorial e bloqueio de modos ainda nao implementados.

## Ajustes da validacao

- A simulacao de recusa de fullscreen tentava acessar o elemento HTML antes de
  sua criacao. Corrigida para substituir a API no prototipo de Element no teste.
  A API real ja passava no teste de entrar e sair de tela cheia.
- Capturas apos navegacao revelaram cabecalho/rodape ausentes em alguns quadros.
  A UI recebeu uma camada de composicao propria; testes de pixels do titulo nas
  telas internas verificam o resultado visual, alem da presenca do elemento no DOM.
- Artefatos de navegador e build separados para um comando nao apagar as capturas do outro.

## Arquivos criados

```text
client/src/app/menu.css
client/src/app/useMenuNavigation.ts
client/src/settings/preferences.ts
client/src/settings/usePreferences.ts
client/src/settings/useFullscreen.ts
client/src/ui/MainMenu.tsx
client/src/ui/ScreenHeader.tsx
client/src/ui/PlayScreen.tsx
client/src/ui/InformationScreens.tsx
client/src/ui/controls.tsx
client/src/ui/ConfirmDialog.tsx
client/src/ui/settings/SettingsScreen.tsx
client/src/ui/settings/SettingsSections.tsx
tests/browser/menu.spec.ts
docs/STAGE-2.md
```

## Arquivos alterados

```text
client/package.json
package-lock.json
client/src/app/App.tsx
client/src/app/global.css
client/src/game/SceneViewport.tsx
client/src/game/rendering/createFoundationScene.ts
playwright.config.ts
playwright.build.config.ts
tests/build/smoke.spec.ts
README.md
THIRD_PARTY_NOTICES.md
docs/ARCHITECTURE.md
docs/CHECKLIST.md
```

Fontes do servidor, contratos compartilhados e testes de fundacao foram preservados.
Saidas geradas (dist, cache, logs, node_modules e capturas) nao fazem parte dos fontes.

## Limites restantes

- UI aproximadamente 250 kB minificados / 79 kB gzip; motor separado aproximadamente
  536 kB / 134 kB gzip. O aviso do Vite para o chunk do motor acima de 500 kB permanece
  visivel. Nao representa falha do build; orcamentos e medicao estao na Etapa 13.
- Chromium headless nao comprova FPS/memoria em todas as GPUs ou comportamento em
  todos os navegadores. Nao houve teste de multiplayer em duas maquinas.
- Nenhum audio, gameplay, captura do mouse, firewall ou publicacao externa foi adicionado.
- Persistencia e por origem/porta, conforme localStorage do navegador.
- Proximo passo: Etapa 3, mapa basico com piso, paredes, rampas, colisores e spawns.
