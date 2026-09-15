# Etapa 10 - combate multiplayer autoritativo

Implementada em 15/09/2026. Escopo restrito a gameplay online; sem antecipar lobby.

## Implementado

- CombatArena reutiliza fisica, equipamentos, vida, partida e selecao de spawn.
- Tres equipamentos, cadencia, municao, recarga, dispersao/alcance e raycasts
  calculados no servidor. Paredes bloqueiam dano. Nenhum HP/alvo/dano e aceito
  como resultado enviado pelo cliente.
- 100 HP, eliminacao unica, +100 pontos, feed, respawn em 180 ticks e reposicao
  de equipamentos. Spawn escolhido por distancia/visibilidade dos adversarios.
- WAITING com um participante; dois conectados iniciam COUNTDOWN de tres segundos.
  FFA de dez minutos ou 30 eliminacoes, resultados imutaveis e nova rodada apos
  15 segundos. Menus nao pausam servidor nem concedem invulnerabilidade.
- Vida/municao/placar/tempo/resultados compartilhados. HUD existente adaptado para
  LAN; TAB ordena por pontos. Efeitos/sons sinteticos existentes, sem novos assets
  externos, bibliotecas ou conteudo protegido.
- Protocolo 2 com lifeId: comandos antigos de respawn/rodada nao movem ou disparam.
  Retomada preserva estado de combate, renova epoch e nao recaptura o mouse.
- Previsao descarta vida antiga, preservando sequencias de transporte. Avatares
  mortos desaparecem e respawn nao interpola entre extremos do mapa.
- NetworkCombatPresentation recebe snapshots validados, deduplica eventos e
  reutiliza ParticleManager/WeaponView/AudioManager. Welcome nao repete sons antigos.
- Sem simulacao de combate no React; publicacao do HUD ate 10 Hz, snapshots 20 Hz,
  comandos agrupados a 30 pacotes/s e simulacao autoritativa a 60 Hz.

## Validacao

Concluida em 15/09/2026: **225 testes distintos aprovados**, em lotes.
Playwright usa Chrome instalado (`PLAYWRIGHT_CHANNEL=chrome`), sem dependencias novas.

| Verificacao | Resultado |
| --- | --- |
| Build/TypeScript dos tres pacotes | Aprovado, inclusive build final |
| Testes Node completos | 132/132 aprovados |
| Regressao completa de navegador | 86/87 inicialmente; um caso interrompido por HMR |
| Reexecucao isolada de `match.spec.ts` | 5/5 aprovados, incluindo o caso interrompido |
| Layout LAN final, desktop/390px/320px | 3/3 aprovados apos ajustar debug |
| `npm run test:build` final | 6/6 aprovados, offline e multiplayer compilados |
| `git diff --check` | Sem erros de whitespace; avisos LF/CRLF habituais |
| Servico dev real 5173/3000 | HTTP 200, dois sockets reais, PLAYING e disparo confirmado no outro cliente |

Os 87 casos distintos de navegador foram aprovados combinando a regressao e
as reexecucoes, nao em uma unica execucao limpa. O trace do caso offline afetado
mostrou atualizacoes HMR de PlayerScreen enquanto outro comando recompilava
shared. Repetido o bloco inteiro sem recompilacao simultanea: cinco aprovados.
Executar build e testes do Vite sequencialmente, pois ambos usam shared/dist.

Capturas desktop/mobile, resultado online e efeitos inspecionados. O painel de
debug online foi movido acima do HUD, com assercao de nao sobreposicao. Um teste
de rede anterior foi estabilizado aguardando ack=60 com prazo limitado, sem
reduzir a exigencia de confirmacao. Nao restou falha conhecida nestes testes.

Logs locais: `.runtime/stage-10-node-final.log`, `stage-10-browser-final.log`,
`stage-10-match-recheck.log`, `stage-10-layout-final.log` e `stage-10-build-final.log`.
Capturas: `test-results/browser`, `test-results/stage-10-match-recheck`,
`test-results/stage-10-layout-final` e `test-results/build` (ignorados pelo Git).
Dev disponivel em http://localhost:5173; backend em 3000. Nesta verificacao,
Ethernet do host: 192.168.18.252. Confirmar o IP novamente em outra rede/sessao.

Cobertura acrescentada:

- Contagem congelada, municao/cadencia, todos os equipamentos, oclusao, recarga
  no menu, disparos de dois atores, vida/score, input durante morte, respawn
  seguro, reconexao, limite por tempo/eliminacoes e proxima rodada.
- Clientes Socket.IO reais recebem o mesmo dano/score/respawn e recusam HP injetado.
- Schemas rejeitam campos/valores impossiveis e eventos duplicados/desordenados.
- Dois contextos Chrome percorrem o mapa com teclado/mouse reais, trocam armas,
  miram, disparam, eliminam, recarregam e observam respawn/placar no outro cliente.
- Servidor isolado de teste com regras reduzidas exercita fim por tempo, resultados
  nos dois clientes, liberacao de Pointer Lock e nova rodada. Regras nao sao
  controladas por URL/localStorage e nao existe endpoint de debug na aplicacao.
- Build de producao testa dois clientes, disparos e placar na unica porta Express.
- Desktop/mobile: canvas, pixels, layouts, HUD sem sobreposicao entre rede/relogio,
  nomes longos, placar e menu local. Mobile continua sem controles touch.

## Arquivos criados

- `shared/src/network/validation.ts`, `shared/src/network/combat.ts`
- `server/src/game/CombatArena.ts`
- `client/src/game/network/NetworkCombatPresentation.ts`
- `server/test/combatArena.test.mjs`
- `tests/browser/network-match.spec.ts`
- `docs/STAGE-10.md`

## Arquivos alterados

- `shared/src/network/protocol.ts`, `shared/src/network/SnapshotBuffer.ts`
- `shared/src/bots/index.ts`, `shared/src/physics/createMapWorld.ts`, `shared/src/gameplay/hud.ts`
- `server/src/network/MovementArena.ts`, `server/src/network/createMovementNetwork.ts`
- `client/src/game/network/NetworkRuntime.ts`, `client/src/game/network/createRemotePlayers.ts`
- `client/src/game/player/createPlayerScene.ts`
- `client/src/game/combat/TrainingRuntime.ts`, `client/src/game/combat/WeaponView.ts`
- `client/src/ui/PlayerScreen.tsx`, `client/src/ui/CombatReadout.tsx`
- `client/src/ui/combat.css`
- `client/src/ui/hud/Scoreboard.tsx`, `client/src/ui/match/MatchResults.tsx`
- `client/src/ui/network/NetworkReadout.tsx`, `client/src/ui/network/network.css`
- `client/src/ui/network/MultiplayerScreen.tsx`
- `shared/test/network.test.mjs`, `server/test/network.test.mjs`
- `tests/browser/network.spec.ts`, `tests/build/network.spec.ts`
- `README.md`, `docs/ARCHITECTURE.md`, `docs/CHECKLIST.md`

Arquivos da Etapa 9 ja estavam no worktree sem commit. Alteracoes anteriores e
documentacao da Etapa 8 foram preservadas. Nenhum commit ou firewall modificado.

## Limites conhecidos

- Uma arena/oito vagas por servidor. Lobby, HOST, PRONTO, criar salas e encerramento
  por saida do host pertencem a Etapa 11. Nao ha bots online ou contas.
- A partida inicia ao conectar dois participantes, mesmo que um esteja no menu.
  Entrar no meio da partida e permitido; entrar no resultado aguarda outra rodada.
- Avatares nao bloqueiam movimento entre si, mas suas capsulas recebem raycasts.
- Disparos usam o estado atual do servidor, sem rewind. Feedback de disparo e
  confirmado pela rede, com atraso perceptivel sob RTT alto. Sem garantia WAN.
- Eventos recentes sao limitados a 64; sob carga/perda pode faltar um efeito
  visual, mas vida/municao/score permanecem nos snapshots autoritativos.
- Uma desconexao breve desativa a capsula e reserva identidade por dez segundos;
  nao e uma solucao anti-abandono para partidas publicas. LAN confiavel apenas.
- Capturas e testes locais nao substituem duas maquinas fisicas. Roteiro e portas
  em README; teste fisico e benchmark completo de GPU/rede continuam pendentes.
- Avisos conhecidos de chunks Three/Rapier acima de 500 kB permanecem visiveis.

A Etapa 11 nao foi iniciada.
