# Etapa 9 - base multiplayer LAN

Implementacao iniciada em 14/09/2026, continuada em 15/09/2026.
Escopo: dois ou mais clientes, visibilidade e movimentacao compartilhada.
Nao iniciar combate online (Etapa 10) nem lobby (Etapa 11).

## Implementado

- Socket.IO 4.8.3 no Node separado e Socket.IO Client 4.8.3 na camada de rede.
- Uma arena NEON FACILITY por servidor, com oito vagas e UUIDs gerados no servidor.
- Nome/endereco/CONECTAR no menu; estado real da conexao e retorno funcional.
- Mesmo Rapier/controlador no servidor e na previsao local: WASD, giro, corrida,
  pulo, rampas, gravidade e colisoes estaticas. Sem posicoes aceitas do cliente.
- Simulacao 60 Hz; comandos agrupados a 30 Hz; snapshots 20 Hz; UI ate 10 Hz.
- Checkpoint/ack/replay, correcao visual limitada, interpolacao de 100 ms e
  extrapolacao remota de no maximo dois ticks. Buffers e modelos limitados.
- Avatares originais sem equipamentos, identificacao por nome e cores por vaga.
- Ping real de ida e volta, contador de conectados, TAB com nomes/status/ping.
- ESC/blur abre menu local, sem pausar outros jogadores ou o servidor.
- Credencial de retomada privada em memoria, janela de dez segundos, epoch
  renovado e quatro tentativas. Sem recaptura automatica de Pointer Lock.
- Saida explicita libera a vaga; dispose libera sockets, listeners, fisica,
  texturas, geometrias e contexto. Nenhuma preferencia sensivel persistida.
- Validacao de versao/nome/comandos, limites por IP/conexao, fila de 12 inputs,
  lote de quatro e 8 KiB por payload. Sequencias repetidas e acoes online de
  combate sao recusadas; o servidor calcula deslocamento a cada tick.
- Vite faz proxy de WebSocket e API; Express serve build e socket em uma porta.
  Nenhuma regra de firewall foi alterada.

## Validacao

Validacao concluida em 15/09/2026: **212 testes distintos aprovados**.

| Comando | Resultado |
| --- | --- |
| `npm run typecheck` | Cliente, servidor e compartilhado aprovados |
| `npm run check` | Build completo e 121 testes Node aprovados |
| `npm run test:e2e` | Regressao completa executada; 74 casos anteriores aprovados |
| `npm run test:e2e -- tests/browser/network.spec.ts` | Bloco LAN final ampliado: 11/11 aprovados |
| `npm run test:build` | Build e seis testes do Express/cliente compilado aprovados |
| `git diff --check` | Sem erro de whitespace; avisos normais de conversao LF/CRLF |

Os 85 testes distintos de navegador foram validados em lotes: a primeira
regressao de 84 casos encontrou uma falha de isolamento no simulador de latencia.
Ela foi corrigida, foi incluido o caso de transporte antigo ainda ativo e todo
o bloco LAN de 11 casos foi reexecutado, incluindo checks de pixels/layout.
Os 74 testes anteriores passaram na regressao; os cinco smokes anteriores de
producao tambem passaram com o codigo final. Nenhuma falha conhecida pendente.

PowerShell neste ambiente: `$env:PLAYWRIGHT_CHANNEL = 'chrome'` antes dos testes
de navegador. Logs locais ignorados pelo Git em `.runtime/stage-9-check.log`,
`.runtime/stage-9-browser.log`, `.runtime/stage-9-network-final.log` e
`.runtime/stage-9-build.log`. Capturas em `test-results/browser` e `test-results/build`.
As capturas desktop/mobile e o avatar remoto foram inspecionados visualmente.

Build: UI 274.63 kB / 85.63 kB gzip; executor FPS 100.65 kB / 33.63 kB gzip;
CSS 22.46 kB / 5.65 kB gzip. Three e Rapier mantem os avisos de chunks acima
de 500 kB, sem esconder warnings e sem erro de build. Isso nao e benchmark de GPU.

Testes acrescentados cobrem:

- Clientes Socket.IO reais: IDs distintos, world comum, capacidade, liberar vaga,
  ping, movimento confirmado, pausa local, reconexao e epoch antigo.
- Abuso: nome/versao invalidos, posicao/HP injetados, comando duplicado,
  lote excessivo, eventos desconhecidos e spam.
- Expiracao e descarte de reservas, velocidade por tick e fila limitada.
- Preservar pulo segurado ao faltar pacote, checkpoint/replay com colisao,
  schemas, interpolacao angular, extrapolacao e memoria limitada.
- Dois contextos Chrome: movimento de cada cliente observado pelo outro,
  Pointer Lock real, pulo, TAB/ping, desconexao e retomada do mesmo ID.
- Transporte antigo ainda ativo: esperar seu timeout com ate tres novas
  tentativas de retomada, mantendo a identidade e o mouse liberado.
- Capturas antes/depois de remover avatar remoto com comparacao de pixels
  na regiao central da cena, sem teletransportar o jogador por debug.
- WebSocket real com atraso artificial de 75 ms por sentido: colisao na parede,
  convergencia de previsao, taxas de pacotes e volume limitado de snapshots.
- Endereco invalido/inexistente, versao incompatível na UI, ciclos repetidos
  de entrada/saida com um unico socket e contexto WebGL vivo.
- Telas 1440x900, 390x844 e 320x640; build sem ferramentas/dados de debug.

Correcoes durante a validacao: import do modulo de fisica no teste; pre-bundle
do Socket.IO Client para evitar reload do Vite no primeiro acesso; preservar
a borda de pulo durante ticks sem comando; seletor de status do teste distinguido
do output de debug; fechamento do proxy de latencia depois de encaminhar os
pacotes ja agendados, evitando reserva indevida de vaga entre testes;
retentativa limitada quando o transporte antigo ainda nao expirou.
Playwright usa Chrome instalado neste ambiente, pois o
Chromium dedicado nao esta instalado. Nenhuma dependencia extra para os testes.

## Arquivos criados

- `shared/src/network/protocol.ts`
- `shared/src/network/SnapshotBuffer.ts`
- `shared/test/network.test.mjs`
- `server/src/network/MovementArena.ts`
- `server/src/network/createMovementNetwork.ts`
- `server/src/network/RateLimit.ts`
- `server/test/network.test.mjs`
- `server/test/movementArena.test.mjs`
- `client/src/network/NetworkManager.ts`
- `client/src/network/serverAddress.ts`
- `client/src/game/network/NetworkRuntime.ts`
- `client/src/game/network/createRemotePlayers.ts`
- `client/src/ui/network/MultiplayerScreen.tsx`
- `client/src/ui/network/NetworkReadout.tsx`
- `client/src/ui/network/network.css`
- `tests/browser/network.spec.ts`
- `tests/build/network.spec.ts`
- `docs/STAGE-9.md`

## Arquivos alterados

- `client/package.json`, `server/package.json`, `shared/package.json`, `package-lock.json`
- `client/vite.config.ts`
- `client/src/app/App.tsx`, `client/src/app/useMenuNavigation.ts`
- `client/src/game/player/createPlayerScene.ts`
- `client/src/ui/PlayerScreen.tsx`, `client/src/ui/InformationScreens.tsx`
- `shared/src/simulation/index.ts`, `shared/src/simulation/player/movement.ts`
- `server/src/index.ts`
- `tests/browser/menu.spec.ts`
- `README.md`, `THIRD_PARTY_NOTICES.md`, `docs/ARCHITECTURE.md`, `docs/CHECKLIST.md`

As alteracoes preexistentes no registro da Etapa 8 foram preservadas.

## Limites e proxima etapa

Nao existe combate online, placar competitivo, tempo de partida, host de sala,
pronto ou varias salas. CRIAR PARTIDA segue desabilitado. Sem contas/TLS; LAN
confiavel apenas, sem encaminhamento de porta do roteador para a Internet.
Avatares nao bloqueiam outros jogadores nesta etapa; o mapa continua solido.
Modelos iniciais e snapshots JSON completos sao adequados ao limite atual de
oito participantes, mas ainda exigem medicao na Etapa 13 antes de escalar.
Sob latencia extrema/CPU saturada pode haver correcao ou recusa da fila.

Dois navegadores locais nao substituem dois computadores fisicos. O roteiro
reproduzivel e as portas estao em README, secao Acesso pela rede local agora.
Esse teste fisico continua pendente. A Etapa 10 nao foi iniciada.
