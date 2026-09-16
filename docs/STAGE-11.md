# Etapa 11 - lobby LAN

## Implementacao

- Criar salas com nome, mapa NEON FACILITY, FFA, 2-8 vagas e prontidao opcional.
- Entrar por endereco e codigo, ou pelo link copiado. Quatro salas por processo.
- Lista de jogadores, HOST, PRONTO/NAO PRONTO, ping e reserva de reconexao.
- Inicio exclusivo do host, com pelo menos dois participantes conectados.
- Gameplay bloqueado no lobby; combate autoritativo existente reutilizado.
- Retorno coletivo ao lobby depois do resultado, manual ou apos 15 segundos,
  sem iniciar automaticamente outra partida. Prontidao e equipamento restaurados.
- Saida explicita do host encerra apenas sua sala; queda breve reserva o host
  por dez segundos apos deteccao. Expiracao encerra a sala, sem migracao.
- Enderecos detectados pelo servidor, selecao de interface e copia com fallback.
- Validacao de salas, versao 3, nomes, capacidade, comandos, epoch e frequencia.

O namespace `/rooms` usa um registro isolado e a mesma simulacao/loop existentes.
O namespace raiz permanece como executor de regressao das Etapas 9-10; a UI
normal usa somente salas. A fixture `network.html` injeta o modo anterior apenas
nos testes Vite, nao no build nem por preferencia/URL da aplicacao.

## Arquivos criados

- `shared/src/network/lobby.ts`: contratos e validacao de lobby.
- `server/src/rooms/RoomRegistry.ts`: ciclo de vida e isolamento de salas.
- `server/src/network/createRoomNetwork.ts`: transporte e autorizacao.
- `server/src/network/lanAddresses.ts`: enderecos candidatos de conexao.
- `client/src/network/roomAddress.ts`: validacao estruturada de links.
- `client/src/ui/network/LobbyScreen.tsx`: lista, prontidao e compartilhamento.
- `server/test/rooms.test.mjs`, `shared/test/lobby.test.mjs`: regras e contratos.
- `tests/browser/lobby.spec.ts`: fluxo real de sala e layouts.
- `tests/fixtures/network.html`, `networkFixture.tsx`, `networkUrl.ts`:
  entrada exclusiva para regressao do executor anterior.
- `docs/STAGE-11.md`: este registro.

## Arquivos alterados

- `shared/src/network/protocol.ts`: versao, eventos e snapshots.
- `server/src/game/CombatArena.ts`: inicio e retorno comandados pelo lobby.
- `server/src/network/createMovementNetwork.ts`: integracao no loop existente.
- `client/src/network/NetworkManager.ts`: comandos e retomada da sala.
- `client/src/game/network/NetworkRuntime.ts` e
  `client/src/game/player/createPlayerScene.ts`: bloqueios e transicoes.
- `client/src/app/App.tsx`, `client/src/ui/PlayerScreen.tsx`,
  `client/src/ui/network/MultiplayerScreen.tsx`,
  `client/src/ui/network/network.css`, `client/src/ui/match/MatchResults.tsx`:
  criacao, entrada, lobby e retorno do resultado.
- `tests/browser/menu.spec.ts`, `network.spec.ts`, `network-match.spec.ts` e
  `tests/build/network.spec.ts`: navegacao e regressao multiplayer.
- `README.md`, `docs/ARCHITECTURE.md`, `docs/CHECKLIST.md`: estado e instrucoes.

## Validacao

Verificado em 16/09/2026 com Node 24 e Chrome local (`PLAYWRIGHT_CHANNEL=chrome`).

- `npm run check`: build dos tres pacotes e **142/142 testes Node**.
- Bloco `network.spec.ts` + `network-match.spec.ts`: **13/13** casos passaram
  na execucao conjunta com lobby. A falha inicial de lobby foi corrigida e
  repetida no bloco completo abaixo.
- `playwright test tests/browser/lobby.spec.ts`: **9/9**, incluindo copia real,
  host/cliente, pronto/cancelar, inicio, combate, sala cheia/iniciada/incompativel,
  isolamento, reconexao, retorno do resultado e oito jogadores em 320 px.
- Bloco offline (bots, foundation, gameplay, HUD, mapa, match, menu, player):
  **74/74**, sem falhas, incluindo pixels/cena em movimento e Pointer Lock real.
- `npm run test:build`: **6/6**, incluindo duas conexoes de sala pela mesma
  porta Express, sem Vite e sem controles debug.
- **244 testes distintos**: 142 Node + 96 navegador em lotes + seis build.
- Capturas de lobby desktop/mobile conferidas; sem overflow horizontal.
  Lobby alto permite rolagem e a acao de saida permanece acessivel.
- `git diff --check`: sem erros de whitespace.
- `npm run dev` iniciado em 5173/3000; HTTP e health direto/proxy retornaram
  200. Duas conexoes reais pelo proxy validaram PRONTO, inicio ate PLAYING e
  encerramento por saida do host. Conexoes de verificacao encerradas ao final.
  IP Ethernet observado: `192.168.18.252` (pode mudar conforme a rede).

Durante a validacao foram corrigidos o preambulo React da fixture de rede e
a interceptacao de versao (instalada antes do reload). O teste de perda de WebGL
usa Chrome separado: a primeira execucao afetou a criacao da cena seguinte;
apos isolamento, os nove casos de lobby passaram juntos. Atualizacoes de lobby
nao podem mais esconder a tela de falha grafica.

Nao compilar shared em paralelo com testes Vite: HMR reinicializa a cena.
Logs locais ficam em `.runtime/stage-11-*.log`; capturas em `test-results/`.

## Limites

- Duas ou mais conexoes locais nao comprovam dois computadores fisicos em LAN.
  Esse teste permanece manual, com roteiro e portas no README.
- HTTP/WS para rede privada confiavel, sem autenticacao, senha ou criptografia.
- Salas em memoria; encerrar Node encerra todas. Nao ha migracao de host.
- FFA e NEON FACILITY sao as unicas opcoes implementadas; sem bots online.
- Sem alteracao automatica de firewall e sem novas dependencias nesta etapa.
- Etapas 12-14 permanecem pendentes.
