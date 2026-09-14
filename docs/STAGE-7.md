# Etapa 7 - bots locais

Implementacao em 14/09/2026. Escopo: somente Etapa 7.
Implementacao, execucao e validacao concluidas. Etapa 8 nao iniciada.
Treinamento, exploracao, mapa, HUD e backend das etapas anteriores preservados.

## Implementado

- JOGAR > INICIAR PARTIDA abre combate livre FFA com 1-7 bots e um humano.
  Nome, quantidade e dificuldade sao as preferencias salvas no menu.
- Bots com capsulas fisicas, modelos originais, identidade, 100 HP, inventario,
  dano real por raycast, eliminacao digital e respawn em tres segundos.
- Todos contra todos: bots escolhem outros bots ou o humano como adversarios.
  Pontuacao, derrotas, feed e TAB usam os atores reais da sessao.
- PATROL/SEARCH/CHASE/ATTACK/RESPAWN; campo de visao, alcance e oclusao por
  paredes; busca da ultima posicao vista por ate tres segundos, depois patrulha.
- Facil/Normal/Dificil alteram reacao, erro de mira, velocidade de giro,
  movimento, cadencia efetiva e strafe. Sem mira perfeita ou dano inevitavel.
- Navegacao A* sobre grade de um metro derivada dos colisores; margem para
  capsula, apoio lateral, rampas e diagonais verificadas. Sem atravessar paredes.
- Rota atual preservada ao replanejar; custo de contornar outros atores e
  recuperacao por recuo lateral quando falta progresso, sem teleporte.
- Respawn escolhe entre oito pontos por distancia e linha de visao dos vivos;
  restaura orientacao, vida, municao e collider, conservando o placar.
- Pausa interrompe todos os atores/relatorios; reinicio zera a sessao.
  Treinamento continua separado, com seus quatro hologramas e campo ambiental.
- Visual interpola poses, anima pernas e reutiliza geometria/materiais.
  Tracers/particulas reutilizam os pools existentes; sons proximos sao sinteticos.
- Percepcao a 10 Hz, revisao de destino a 2 Hz, A* somente quando necessario,
  fisica a 60 Hz, HUD ate 10 Hz. Debug de bots somente no desenvolvimento.

## Dependencias

- `ngraph.graph` 20.1.2 (BSD-3-Clause): estrutura do grafo, com tipos incluidos.
- `ngraph.path` 1.6.1 (MIT): A* com pesos/heuristica e reutilizacao interna de nos.
- `ngraph.events` e transitiva, BSD-3-Clause. Licencas verificadas nos arquivos
  LICENSE dos pacotes instalados. Nenhuma dependencia de rede nova.

Instalacao auditou 149 pacotes e informou zero vulnerabilidades. O npm avisou
que o postinstall do esbuild estava bloqueado pela politica de install scripts;
nenhuma permissao foi alterada. O build foi validado separadamente.

## Arquivos criados

| Arquivo | Responsabilidade |
| --- | --- |
| `shared/src/bots/NavigationGraph.ts` | Amostragem fisica, apoio, grafo e A* |
| `shared/src/bots/types.ts` | Atores, estados, perfis e validacao das opcoes |
| `shared/src/bots/Visibility.ts` | Alcance, campo de visao e oclusao estatica |
| `shared/src/bots/SpawnManager.ts` | Escolha de spawn por distancia/cobertura |
| `shared/src/bots/BotBrain.ts` | Estados, memoria, reacao, mira e comandos |
| `shared/src/bots/BotSession.ts` | Executor local, combate, vida e respawn |
| `shared/src/bots/index.ts` | API publica do subpath bots |
| `shared/test/navigation.test.mjs` | Grafo, 56 trajetos entre spawns e dois corredores traseiros |
| `shared/test/bots.test.mjs` | 12 testes de IA, combate, patrulha e recursos |
| `client/src/game/combat/createBotObjects.ts` | Modelos originais, labels, animacao e descarte |
| `tests/browser/bots.spec.ts` | Dez testes de bots/menu/combate/HUD no Chrome |
| `docs/STAGE-7.md` | Este registro |

## Arquivos alterados

| Arquivo | Alteracao |
| --- | --- |
| `shared/package.json` | Dependencias de navegacao e subpath bots |
| `package-lock.json` | Versoes resolvidas das bibliotecas novas |
| `shared/src/simulation/player/movement.ts` | Reset em spawn selecionado e limite de correcao horizontal |
| `shared/src/gameplay/TrainingStats.ts` | Estatisticas/feed de atores bots sem mudar o treino |
| `shared/src/gameplay/hud.ts` | Identidade BOT e contexto de HUD |
| `client/src/game/combat/TrainingRuntime.ts` | Adaptacao opcional da sessao de bots e eventos |
| `client/src/game/combat/ParticleManager.ts` | Origem de tracer como vetor estrutural |
| `client/src/game/player/createPlayerScene.ts` | Passos fisicos de bots, interpolacao e diagnostico |
| `client/src/game/player/InputManager.ts` | Mensagem de recaptura apos limitacao do navegador |
| `client/src/ui/PlayerScreen.tsx` | Entrada de bots e debug sem misturar simulacao com React |
| `client/src/app/App.tsx` | Rota bots e entrada pelo menu |
| `client/src/app/useMenuNavigation.ts` | Rota, Escape e foco de retorno |
| `client/src/ui/PlayScreen.tsx` | Inicio habilitado e resumo do combate livre |
| `client/src/ui/hud/Scoreboard.tsx` | Contexto de arena e identificacao BOT sem ping falso |
| `client/src/ui/hud/HudSummary.tsx` | Rotulo de tempo decorrido da arena |
| `client/src/ui/CombatReadout.tsx` | HUD compartilhado com contexto de combate |
| `client/src/ui/combat.css` | Debug acima de vida/municao tambem no modo bots |
| `client/src/ui/InformationScreens.tsx` | Creditos das bibliotecas de navegacao |
| `tests/browser/menu.spec.ts` | Inicio contra bots agora habilitado |
| `tests/browser/map.spec.ts` | Retorno do mapa conserva o inicio contra bots habilitado |
| `tests/build/smoke.spec.ts` | Combate contra bots no build servido pelo Express |
| `README.md` | Como jogar, dificuldades e limites atuais |
| `THIRD_PARTY_NOTICES.md` | Bibliotecas, licencas e origem dos modelos |
| `docs/ARCHITECTURE.md` | Navegacao, IA, integracao, recursos e referencias |
| `docs/CHECKLIST.md` | Acompanhamento da Etapa 7 |

Fontes do servidor, dimensoes/colisores/spawns do mapa e regras/balanceamento
dos tres equipamentos nao foram alterados. Alteracoes anteriores nao foram
revertidas. Saidas em dist, test-results e .runtime continuam ignoradas.

## Validacao

| Comando/verificacao | Resultado |
| --- | --- |
| `npm run check`, antes | Build e 84 testes da base aprovados |
| `npm run typecheck` | Tres workspaces aprovados apos integracao inicial |
| `node --test shared/test/navigation.test.mjs` | Dois testes aprovados antes de adicionar combate |
| Subsuite bots/navegacao/HUD | 26 aprovados antes de ampliar patrulha prolongada |
| Subsuite bots/navegacao/mapa/player | 61 aprovados apos correcoes de navegacao/velocidade |
| `npm run check`, final | Build e 99 testes Node aprovados (84 anteriores + 15 novos) |
| Eliminacao por disparos no Chrome, cinco repeticoes | Cinco aprovacoes consecutivas, dispersao ativa |
| `npm run test:e2e`, Chrome | 69 aprovados (59 anteriores + 10 novos), 4.6 min |
| `npm run test:build`, Chrome | Build e cinco testes aprovados (quatro anteriores + um novo), 21.7 s |
| HTTP em localhost | Frontend 5173, health via proxy 5173 e health direto 3000 retornaram 200 |
| Sessao real no dev 5173 | Sete bots, disparo/100 pontos, oito linhas, retorno ao menu e zero erros de console |
| `git diff --check` | Sem erros de whitespace |

Total: 173 testes distintos aprovados (99 Node + 69 navegador + cinco build).
Repeticoes e subsuites nao sao somadas novamente. Logs/capturas locais em
`.runtime/stage7-e2e.log`, `.runtime/stage7-build-test.log`,
`.runtime/stage7-local-bots.png`, `.runtime/stage7-local-scoreboard.png` e
`test-results/browser` / `test-results/build` (arquivos ignorados pelo Git).

Dev existente reaproveitado em http://localhost:5173 e backend em 3000.
Durante o build, recompilar shared provocou reinicios do watcher do servidor
e respostas 502 transitorias no proxy. Apos estabilizar, os tres endpoints
foram verificados novamente com sucesso; nenhuma porta ou regra de firewall
foi alterada. Logs do dev mantidos em `.runtime/stage6-dev.stdout.log` e
`.runtime/stage6-dev.stderr.log`.

Navegacao: todos os pares de spawns conectados, 56 percursos com controlador
real, sem queda ou recuperacao por teleporte. Teste de patrulha com sete bots
por dois minutos, percepcao desativada apenas no teste: todos percorrem mais
de 100 metros, sem paradas de cinco segundos e sem morte/respawn.
Teste separado com combate ativo por dois minutos: corpos estaveis, velocidades
limitadas, eliminacoes e derrotas consistentes, respawn e feed limitado.
Os dois corredores no nivel do chao atras das plataformas tambem possuem rotas
verificadas com a capsula real, sem substituir o percurso por subida da plataforma.

Playwright usa Pointer Lock, teclado e disparos reais. Testa tres configuracoes
de dificuldade/quantidade, ida/volta/foco, persistencia, eliminacao de bot,
morte do humano, pausa de respawn, reinicio, TAB sem pausa, combate entre bots
e descarte de contextos em entradas repetidas. Capturas desktop e mobile foram
inspecionadas; verificacoes de pixels e layout em 1440x900, 390x844 e 320x640.

## Correcoes durante os testes

- Um ponto de navegacao junto a lateral da rampa exigia subida impossivel.
  Amostragem de apoio em quatro lados removeu esses pontos e bordas altas.
- A grade inicial terminava antes dos corredores traseiros. Expandir a amostragem
  mantendo os testes de margem/apoio incluiu essas passagens nas rotas dos bots.
- Recalculo frequente fazia alguns bots oscilarem para o inicio do segmento.
  Preservar o trecho atual e medir progresso real corrigiu a patrulha prolongada.
- Contato entre capsulas cinematicas adicionava deslocamento acima do limite.
  Correcao horizontal agora respeita o teto de velocidade; regressao de fisica passou.
- Debug de bots usava o posicionamento da exploracao e cobria a vida.
  A regra de afastamento do HUD agora inclui bots e tem assercao de layout.
- Teste de placar nao deve assumir que o humano e o primeiro em empates;
  ele agora verifica o identificador local sem contrariar a ordenacao por ID.
- Testes antigos de menu/mapa exigiam inicio desabilitado; agora verificam
  que a entrada de bots permanece habilitada ao navegar e retornar.
- Chrome pode limitar pedidos rapidos de Pointer Lock com NotAllowedError.
  Falha permanece visivel; a recuperacao exige aguardar e um novo clique real.
  Nenhum mecanismo de seguranca foi desativado e nao ha recaptura automatica.
- Teste de disparo mirava na borda superior de um bot em movimento; agora usa
  movimento real do mouse para mirar no torso. Dispersao e dano nao foram alterados.

## Limites

- Combate livre, nao uma partida completa com fim automatico. Etapa 8 ainda
  implementara countdown, 10 minutos/30 eliminacoes, vitoria e resultados.
- Sem multiplayer, lobby, servidor autoritativo remoto ou teste LAN entre PCs.
- Mapa atual tem uma superficie caminhavel por XZ; pontes/passagens sobrepostas
  exigirao nova representacao de navegacao. Bots nao pulam nem agacham.
- Se nao houver spawn inteiramente oculto, escolhe-se o melhor disponivel.
  Sem invulnerabilidade de respawn; nao ha garantia de cobertura em toda situacao.
- IA inicial sem retirada, flanqueamento coordenado ou aprendizado. Caminhos
  de grade e desvio entre atores ainda podem parecer mecanicos.
- Inventario finito como o jogador, reabastecido no respawn/reinicio. Sem itens
  de municao no mapa nesta etapa; bots trocam equipamento se o atual esgotar.
- Audio sintetico mono e modelos provisorios; audio espacial/passos e polimento
  continuam futuros. Sem controles touch, benchmark em PCs intermediarios ou
  perfil completo de heap/GPU. Os avisos de tamanho dos motores no build permanecem.
- Build final: UI 267.89 kB / 83.61 kB gzip; executor FPS/bots 48.60 kB /
  17.23 kB gzip; CSS 20.57 kB / 5.24 kB gzip. Three 550 kB / 136.88 kB gzip
  e Rapier/WASM 2047.08 kB / 761.94 kB gzip, carregados sob demanda.

Proxima etapa, mediante autorizacao: Etapa 8, MatchManager e regras de partida.
