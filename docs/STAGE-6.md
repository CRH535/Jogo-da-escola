# Etapa 6 - HUD, feed e placar

Concluida e verificada em 14/09/2026. Escopo: somente Etapa 6.
Sem dependencias novas, alteracoes no backend ou nas colisoes do mapa.
Etapa 7 nao iniciada.

## Implementado

- HUD do treinamento com vida, municao/reserva, equipamento, mira, acerto,
  dano e respawn preservados. Destaque de vida/carga baixas e progresso de recarga.
- Resumo compacto de pontuacao, tempo decorrido e quantidade real de jogadores.
  Cada holograma eliminado vale 100 pontos; cada morte conta uma derrota.
- Feed cronologico limitado a quatro eventos, com expiracao em cinco segundos
  de simulacao. Em telas de ate 600 px, aparecem apenas os dois mais recentes.
- Segurar TAB abre o placar; soltar fecha. Tabela ordenada por pontuacao,
  eliminacoes, menos derrotas e ID como desempate estavel. Colunas: jogador,
  eliminacoes, derrotas, pontuacao e ping. Jogador local destacado.
- TAB nao pausa, nao libera Pointer Lock e funciona durante eliminacao/respawn.
  ESC, perda de foco e perda do contexto WebGL fecham o placar. Nos menus,
  TAB continua sendo navegacao de teclado normal.
- Pausa congela relogio e expiracao do feed. Respawn conserva estatisticas;
  reinicio ou nova entrada zeram tempo, placar e feed.
- Contratos visuais leves em shared/hud, sem importar Rapier/Three/DOM.
  Estatisticas pertencem a simulacao; React recebe snapshots em no maximo
  10 Hz durante gameplay, sem novo loop ou temporizador independente.
- Layout responsivo, nomes longos com quebra, tabela sem overflow horizontal
  e mensagens de eliminacao que nao se sobrepoem ao placar aberto.

## Arquivos criados

| Arquivo | Responsabilidade |
| --- | --- |
| `shared/src/gameplay/hud.ts` | Contratos de HUD/feed/placar, ordenacao e formatacao de tempo |
| `shared/src/gameplay/TrainingStats.ts` | Pontos, derrotas, tempo de simulacao e feed limitado |
| `shared/test/hud.test.mjs` | 13 testes de regras e integracao |
| `client/src/ui/hud/HudSummary.tsx` | Pontuacao, relogio e quantidade de jogadores |
| `client/src/ui/hud/EventFeed.tsx` | Feed acessivel de eliminacoes |
| `client/src/ui/hud/Scoreboard.tsx` | Tabela ordenada, identidade local e estado de respawn |
| `client/src/ui/hud/hud.css` | Posicionamento e responsividade do HUD/placar |
| `tests/browser/hud.spec.ts` | 11 testes de interacao, estados e layout no Chrome |
| `tests/fixtures/hudFixture.tsx` | Dados sinteticos exclusivos dos testes de oito linhas |
| `docs/STAGE-6.md` | Este registro |

## Arquivos alterados

| Arquivo | Alteracao |
| --- | --- |
| `shared/package.json` | Exportacao leve do subpath hud |
| `shared/src/gameplay/index.ts` | Exportacao das estatisticas do treinamento |
| `shared/src/gameplay/TrainingSession.ts` | Registro de mortes/eliminacoes e progresso de recarga |
| `client/src/game/combat/TrainingRuntime.ts` | Identidade local e publicacao dos snapshots do HUD |
| `client/src/game/player/InputManager.ts` | TAB e limpeza de gameplay separada da visibilidade do placar |
| `client/src/game/player/createPlayerScene.ts` | Callback de placar e preservacao do TAB durante morte |
| `client/src/ui/PlayerScreen.tsx` | Estado do placar e composicao sem conflito com debug/mira |
| `client/src/ui/CombatReadout.tsx` | Composicao do HUD, feedback de carga/vida e recarga |
| `client/src/ui/combat.css` | Destaques e trilho de recarga com dimensao estavel |
| `tests/build/smoke.spec.ts` | HUD, feed, pontos e TAB no build servido pelo Express |
| `README.md` | Como usar o HUD e limites do treinamento atual |
| `docs/ARCHITECTURE.md` | Contratos, estatisticas, input e estrategia de testes |
| `docs/CHECKLIST.md` | Acompanhamento da Etapa 6 |

`package-lock.json`, scripts npm, fontes do servidor, fisica/layout do mapa e
balanceamento dos equipamentos nao precisaram mudar nesta etapa.
Alteracoes da Etapa 5 foram preservadas. Saidas geradas continuam ignoradas em
`dist`, `test-results` e `.runtime`.

## Validacao

| Comando | Resultado |
| --- | --- |
| `npm run check`, antes | Build e 71 testes da base aprovados |
| `npm run typecheck` | Tres workspaces aprovados |
| `node --test shared/test/hud.test.mjs shared/test/gameplay.test.mjs` | 31 testes aprovados |
| `npm run check`, depois | Build e 84 testes Node aprovados |
| Subsuite HUD e subsuite de oito linhas, Chrome | 11 testes aprovados |
| `npm run test:e2e`, Chrome | 59 testes aprovados (48 anteriores + 11 HUD) |
| `npm run test:build`, Chrome | 4 testes aprovados, incluindo HUD no build |
| HTTP 5173, 5173/api/health e 3000/api/health | 200 com frontend/backend ativos |
| Verificacao adicional em localhost:5173 | Eliminacao, 100 pontos, relogio e TAB reais, sem erros de console |

147 testes distintos aprovados: 84 Node, 59 navegador e 4 build.
As subsuites sao repeticoes, nao entram novamente no total.
Log da regressao completa em `.runtime/stage6-e2e.log`.
Dev iniciado em segundo plano com `npm run dev`; logs em
`.runtime/stage6-dev.stdout.log` e `.runtime/stage6-dev.stderr.log`, sem erros.
Captura local inspecionada em `.runtime/stage6-local-scoreboard.png`.

Os testes Node cobrem pontuacao unica, morte unica, imutabilidade dos snapshots,
nomes historicos, expiracao, limite de eventos, reset sem reciclar IDs,
formatacao de tempo, desempate estavel e progresso de recarga. Integracao com
Rapier usa eliminacoes reais da sessao, sem alterar vida artificialmente.

Playwright exercita Pointer Lock, disparos e movimento reais, TAB sem pausa,
tempo/feed congelados na pausa, morte/respawn, ESC/blur/perda de contexto,
recarga, nova sessao e nomes longos. Capturas e verificacoes de layout em
1440x900, 800x600, 390x844 e 320x640; cena 3D preservada e nao vazia.
Imagens de HUD, eliminacao e placar desktop/mobile foram inspecionadas.

A fixture de oito jogadores testa somente apresentacao, ordenacao, ping e
relogio regressivo com dados sinteticos. Ela e importada apenas pelo teste,
nao pela aplicacao, e seus identificadores nao estao no bundle de producao.
Nao representa conexoes multiplayer nem jogadores realmente conectados.
Nomes contendo markup sao renderizados como texto, sem HTML injetado.

## Limites

- O treinamento possui um jogador humano local e quatro hologramas estaticos.
  Hologramas nao aparecem como jogadores ficticios no placar. Ping mostra
  LOCAL; nenhum valor de rede foi inventado.
- O relogio atual mede tempo decorrido do treinamento, sem limite de partida.
  Contrato aceita tempo restante para a futura Etapa 8, que ainda implementara
  countdown, limite de dez minutos/30 eliminacoes, vitoria e tela final.
- Sem bots, equipes, combate entre jogadores, servidor autoritativo ou lobby.
  A exploracao livre continua sem combate ou HUD de treinamento.
- Estatisticas sao da sessao atual, nao um historico persistente. Nao ha
  penalidade de pontos por morte; pontos seguem eliminacoes multiplicadas por 100.
- Testes mobile validam menus/layout; controles touch nao foram adicionados.
- Sem benchmark em PCs intermediarios, perfil completo de heap ou teste LAN
  em dois computadores. Nenhum firewall foi alterado.
- Build: UI 267.49 kB / 83.44 kB gzip; CSS 20.53 kB / 5.23 kB gzip;
  executor FPS 26.23 kB / 9.65 kB gzip; Three 550 kB / 136.88 kB gzip;
  Rapier/WASM 2047.08 kB / 761.94 kB gzip. Motores carregam sob demanda.
  Aviso Vite sobre chunks maiores que 500 kB permanece, sem erro de build.

Proxima etapa, mediante autorizacao: Etapa 7, bots com navegacao antes de combate.
