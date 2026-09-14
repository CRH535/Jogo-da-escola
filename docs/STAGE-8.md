# Etapa 8 - partidas locais FFA

Implementacao em 14/09/2026. Validacao final em andamento.
Escopo: Etapa 8, sem iniciar rede/multiplayer da Etapa 9.

## Implementado

- MatchManager compartilhado, sem dependencia de renderer, navegador ou fisica.
- COUNTDOWN (3/2/1), PLAYING (GO!) e MATCH_END; regras padrao imutaveis.
- Movimento, IA e combate bloqueados durante a contagem. Olhar/TAB permitidos.
- Dez minutos ativos ou 30 eliminacoes, o que acontecer primeiro; 100 pontos por
  eliminacao conservados. HUD usa tempo restante somente em partidas contra bots.
- Pausa/perda de foco congela todos os relogios; treinamento e exploracao livres.
- Fim interrompe acoes e respawns, conserva resultado e libera Pointer Lock.
- VITORIA/DERROTA, vencedor, motivo, posicao, eliminacoes, derrotas, pontos,
  precisao por projetil, duracao e tabela completa de participantes.
- JOGAR NOVAMENTE reinicia a mesma configuracao; MENU PRINCIPAL descarta a cena.
- Sem novas dependencias, sons, modos, mapa ou alteracoes nas fontes do servidor.

## Arquivos criados

| Arquivo | Responsabilidade |
| --- | --- |
| `shared/src/match/MatchManager.ts` | Regras, estados, tempo, resultado e precisao |
| `shared/test/match.test.mjs` | Nove testes de regras e integracao real de combate |
| `client/src/ui/match/MatchResults.tsx` | Resultado, metricas e comandos finais |
| `client/src/ui/match/match.css` | Contagem e layout responsivo do resultado |
| `tests/browser/match.spec.ts` | Cinco testes do ciclo de partida e layout |
| `tests/fixtures/match.html` | Entrada isolada do navegador para limites curtos |
| `tests/fixtures/matchFixture.tsx` | Mesma cena com regras de teste, fora da aplicacao |
| `docs/STAGE-8.md` | Este registro |

## Arquivos alterados

| Arquivo | Alteracao |
| --- | --- |
| `shared/package.json` | Exportacao do subpath match, sem dependencia nova |
| `shared/src/bots/BotSession.ts` | Politica opcional, bloqueios, contadores e encerramento |
| `shared/src/gameplay/TrainingStats.ts` | Consulta do lider sem alocacao de snapshot |
| `client/src/game/combat/TrainingRuntime.ts` | Regras FFA, estados e tempo restante no readout |
| `client/src/game/player/createPlayerScene.ts` | Bloqueio fisico inicial/final e liberacao do mouse |
| `client/src/ui/PlayerScreen.tsx` | Estado final, resultado e revanche |
| `client/src/ui/CombatReadout.tsx` | Contagem 3/2/1/GO e estado observavel |
| `client/src/ui/PlayScreen.tsx` | Limites reais no resumo de configuracao |
| `client/src/ui/hud/Scoreboard.tsx` | Tabela compartilhada com a tela final |
| `client/src/ui/hud/hud.css` | Estilos da tabela reutilizavel |
| `tests/browser/bots.spec.ts` | Esperar contagem inicial e verificar tempo decrescente |
| `tests/build/smoke.spec.ts` | Contagem/tempo padrao antes do combate compilado |
| `README.md` | Regras, fluxo de partida, precisao, desempate e limites |
| `docs/ARCHITECTURE.md` | Contrato de partidas e integracao com executor |
| `docs/CHECKLIST.md` | Escopo e acompanhamento da Etapa 8 |

Mudancas anteriores das Etapas 5-7 no worktree foram preservadas.

## Validacao

| Verificacao | Resultado |
| --- | --- |
| `npm run check`, base | Build e 99 testes Node aprovados |
| `npm run typecheck`, integracao | Tres workspaces aprovados |
| `node --test shared/test/match.test.mjs` | Nove testes aprovados |
| Bots + contagem no Chrome | 11 aprovados na primeira rodada; quatro falhas de carga da fixture corrigidas |
| Cinco testes novos de partidas no Chrome | Aprovados apos correcao da fixture; layout final em revisao |
| `npm run check`, final | Build e 108 testes Node aprovados (99 anteriores + nove novos) |
| Regressao completa de navegador | Em andamento, 74 casos |
| Build servido/HTTP | Pendente |

## Correcoes encontradas

- TypeScript exige omitir propriedades opcionais ausentes: readout nao envia
  `match: undefined` para treinamento, preservando exactOptionalPropertyTypes.
- HTML da fixture via /@fs nao recebe o preambulo React automatico do Vite;
  a entrada isolada o inicializa antes de importar sua arvore de componentes.
  Montagem explicita evita createRoot duplicado por reavaliacao do modulo no HMR.
- Captura mostrou que a largura de pausa sobrescrevia a tela final. Seletor
  especifico do dialogo de resultados e teste dos rotulos corrigem a precedencia.

Build atual: UI 271.55 kB / 84.78 kB gzip; executor FPS 49.94 kB / 17.64 kB gzip;
CSS 21.83 kB / 5.52 kB gzip. Three 550.00 kB / 136.88 kB gzip e Rapier/WASM
2047.08 kB / 761.94 kB gzip, carregados sob demanda. Avisos de chunks acima de
500 kB continuam sendo dos motores. Nao foram ocultados nem tratados como erro.

## Decisoes e limites

- Desempate segue TAB: pontos, eliminacoes, menos derrotas e ID estavel.
  Vale inclusive se ninguem pontuar; sem empate compartilhado ou prorrogacao.
- GO aparece por 45 ticks (0.75 s) ja com gameplay habilitado. Apenas os tres
  segundos anteriores bloqueiam inputs; acoes antigas nao sao enfileiradas.
- Tempo e de simulacao ativa, como a fisica existente; pausas nao o consomem e
  travamentos longos do frame nao geram uma rajada ilimitada de compensacao.
- Precisao = projeteis que causaram dano / projeteis emitidos; VX conta cada
  pulso. Zero disparos = 0%. Nao e porcentagem de gatilhadas acertadas.
- Roster final e congelado em profundidade nas linhas; nomes/configuracoes
  alterados depois nao reescrevem o resultado. Reinicio cria um novo resultado.
- Limites curtos existem apenas na fixture isolada para testes do mesmo runtime;
  aplicacao usa dez minutos/30 eliminacoes, sem atalhos via query/localStorage.
- Sem lobby, multiplayer, persistencia de resultados, musica ou sons de vitoria/
  contagem nesta etapa. Etapas de rede e polimento permanecem futuras.
- Permanecem limitacoes visuais/performance e avisos de bundle dos motores ja
  documentados na Etapa 7. Nao ha benchmark completo nem teste em dois PCs.
