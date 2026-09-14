# NEON STRIKE - arquitetura tecnica

## Analise inicial

Em 13/09/2026, a pasta `Jogo da escola` estava vazia, sem fontes, manifests,
repositorio Git ou instrucoes AGENTS.md nos diretorios ancestrais verificados.
Ambiente encontrado: Windows/PowerShell, Node 24.15.0, npm 12.0.2 e Chrome.
Nao houve codigo existente a migrar. O documento de 79 secoes define o escopo.

## Decisoes

- Monorepo com npm workspaces, um lockfile e tres pacotes privados ESM.
- TypeScript estrito em todos os pacotes; contratos compilados antes de consumidores.
- React controla navegacao, formularios e HUD. Three.js direto controla a cena
  e seu ciclo de vida. R3F nao e necessario para esta organizacao inicial.
- Express executa em processo separado; o servidor nunca importa React ou Three.js.
- `shared` nunca importa `client` ou `server`, DOM ou APIs especificas do Node.
- Desenvolvimento: Vite em 5173, Express em 3000, `/api` via proxy de mesma origem.
  O navegador usa uma URL relativa; nenhum `localhost` do host e embutido no bundle.
- Build: Express pode servir `client/dist` e a API em 3000, mantendo os fontes e
  processos de desenvolvimento separados. Isso simplifica a distribuicao futura em LAN.
- Nenhum banco, conta, servico externo, CDN ou autenticacao no escopo do MVP LAN.

## Estrutura planejada

```text
client/
  src/
    app/                       # composicao, telas e transicoes
    game/
      rendering/               # renderer, cena, camera, materiais e dispose
      player/                  # entrada local, camera e previsao visual
      combat/                  # modelos, efeitos em pool e adaptador de combate local
    ui/                        # menus, HUD, feed, placar e fim de partida
    maps/                      # meshes, materiais e inspecao da arena
    network/                   # NetworkManager, snapshots e interpolacao
    audio/                     # AudioManager e grupos de volume
    settings/                  # validacao e persistencia de preferencias
server/
  src/
    config/                    # variaveis e configuracao de inicializacao
    http/                      # API HTTP e arquivos do build
    networking/                # Socket.IO, limites, validacao e protocolos
    rooms/                     # RoomManager, lobby, pronto e host
    game/                      # executor autoritativo das salas
shared/
  src/
    protocol/                  # versao, contratos, eventos e erros
    simulation/
      player/                  # movimento, limites e colisao
      match/                   # relogio, pontuacao e regras do FFA
      spawn/                   # escolha de spawn e protecao contra queda
    gameplay/                  # equipamentos, vida e treinamento local
    bots/                      # grafo, percepcao, estados, spawn e sessao local
    maps/                      # colliders, spawns e grafo de navegacao
    physics/                   # fabrica do mundo Rapier, sem renderizacao
docs/
tests/browser/
```

Somente os diretorios com responsabilidade real das Etapas 1-7 foram criados.
Nao ha classes vazias ou sistemas de gameplay fingindo implementacao.

## Dependencias

| Pacote | Quando | Finalidade |
| --- | --- | --- |
| react, react-dom | Etapa 1 | Telas e ciclo de montagem da interface |
| three | Etapa 1 | Renderizacao WebGL 2, camera, geometria e materiais |
| express | Etapa 1 | API HTTP e entrega opcional do cliente compilado |
| vite, @vitejs/plugin-react | Etapa 1, desenvolvimento | Dev server, React HMR e bundle |
| typescript, @types/* | Etapa 1, desenvolvimento | Verificacao estatica e tipos das bibliotecas |
| tsx | Etapa 1, desenvolvimento | Executar e reiniciar o backend TypeScript |
| concurrently | Etapa 1, desenvolvimento | Iniciar e encerrar os tres processos juntos |
| @playwright/test | Etapa 1, desenvolvimento | Validar navegador e capturas de tela |
| pngjs, @types/pngjs | Etapa 1, desenvolvimento | Verificar pixels e movimento na cena capturada |
| @dimforge/rapier3d-compat | Etapas 3-4 | Fisica, shape casts e character controller |
| ngraph.graph, ngraph.path | Etapa 7 | Grafo navegavel e A* com tipos incluidos, sem Three/DOM |
| socket.io, socket.io-client | Etapa 9 | Transporte, salas e reconexao |
| zod | Etapa 9, se adequado | Schemas e validacao de payloads em runtime |
| lucide-react | Etapa 2 | Icones de controles, com nomes acessiveis e tooltips |

O test runner do Node, fetch, leitura de .env e descoberta de interfaces de rede
usam APIs nativas. Nao sao necessarios Jest, Axios, dotenv ou CORS na Etapa 1.
As versoes instaladas ficam registradas nos manifests e no package-lock.json.
Bibliotecas futuras serao adicionadas somente quando usadas.

## Menu e configuracoes (Etapa 2)

`app/useMenuNavigation` trata as rotas de menu no hash, historico do navegador,
Escape e restauracao de foco. Nao ha dependencias de roteamento ou sockets na UI.
`ui` contem telas e controles; `settings` valida/persiste as preferencias em um
documento local versionado. Falhas de JSON, formato e acesso a localStorage usam
valores padrao ou mantem alteracoes somente na sessao, sem interromper a interface.

O App compoe as telas e fornece as preferencias. A cena Three.js permanece
montada ao navegar entre menus e recebe alteracoes de video por uma API de
atualizacao. Entrar na inspecao do mapa substitui essa cena, liberando seus recursos.
O renderer agora e carregado com import dinamico, separado do bundle da interface.
Resolucao preserva o aspecto, limita pixels internos e nunca amplia a resolucao
alem da qualidade escolhida. Qualidade controla o limite de pixel ratio;
FPS limita renderizacao, independentemente do React. Sombras afetam a arena
introduzida na Etapa 3. FOV, sensibilidade e head bob sao preferencias
aplicadas ao jogador da Etapa 4; volumes sao preferencias para o futuro AudioManager.

Fullscreen usa o estado real do documento, iniciado por gesto e acompanhado
por fullscreenchange. Nao e forçado ao recarregar e recusas sao informadas.
Reset de configuracoes usa dialog nativo, preservando nome e configuracao de bots.

Na Etapa 2, JOGAR apenas salvava configuracoes. O treinamento foi habilitado
na Etapa 5 e iniciar contra bots na Etapa 7. Multiplayer continua indisponivel,
sem simulacao falsa de lobby ou conexao Socket.IO.

Referencias da implementacao:
- [Lucide React](https://lucide.dev/guide/react)
- [Fullscreen e recusas do navegador](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen)
- [Armazenamento local e excecoes](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)

## Mapa e colisores (Etapa 3)

`shared/src/maps/neonFacility` e a fonte unica das dimensoes, posicoes e rotacoes
de 19 solidos, oito spawns e nomes dos setores. Unidades em metros, eixo Y para
cima; posicao de spawn representa os pes, sem offset de camera. Caixas usam
centro geometrico; rampas usam centro da base, subindo ao longo do +Z local.
Vertices e indices da cunha ficam em `maps/geometry` e sao testados como uma
malha fechada com faces externas. Nao existem medidas duplicadas no renderer.

`@neon-strike/shared/maps` exporta dados e geometria sem carregar fisica.
`@neon-strike/shared/physics` inicializa Rapier 0.12.0 compat uma vez por processo
e cria mundos independentes, com um collider fixo por solido. Cuboides para
caixas; convex hull dos mesmos vertices visuais para rampas. Nenhum collider
depende de Three.js. O mundo pode ser criado em Node ou no navegador e possui
dispose idempotente para liberar sua memoria WASM. O backend HTTP ainda nao
cria mundos: simulacao autoritativa continua nas etapas futuras.

`client/src/maps/buildMapMeshes` cria e possui as geometrias, materiais e
texturas locais dos rotulos. Caixas compartilham uma geometria e os materiais
sao reutilizados por tipo. Faixas e marcadores nao sao solidos.
`createMapScene` possui renderer, iluminacao e OrbitControls do Three.js; limita
DPR/FPS e suspende o loop com a aba oculta. Usa uma luz direcional com sombra
1024 x 1024, recalculada apenas apos ajustes da cena estatica.

`ui/MapScreen` gerencia carregamento, erro e comandos de inspecao. Rapier/WASM
e renderer do mapa usam import dinamico, apenas nessa rota. Sair durante o
carregamento cancela a montagem tardia; sair depois descarta mundo, listeners,
ResizeObserver, controls, loop, sombras, materiais, texturas e contexto WebGL.
A tela de menu e a inspecao nunca mantem dois renderers ativos simultaneamente.

No dev, o checkbox Colisores cria linhas do `world.debugRender()` uma unica vez.
O build elimina esse controle; nao ha simulacao continua de fisica na inspecao.
Os testes usam capsula de 1.8 m de altura e 0.35 m de raio com o controlador
cinematico fornecido pelo Rapier para percorrer rampas e passagens. Isso valida
o layout, nao substitui o futuro teste do controlador FPS com inputs reais.
Waypoints, escolha de spawn por adversarios e protecao contra queda do jogador
nao foram antecipados nesta etapa.

Referencias:
- [Rapier: formas e convex hull](https://rapier.rs/docs/user_guides/javascript/colliders/)
- [Rapier: controlador cinematico e slopes](https://rapier.rs/docs/user_guides/javascript/character_controller/)

## Controlador FPS e exploracao (Etapa 4)

Nenhuma dependencia nova. Rapier fornece o controlador cinematico da capsula;
o codigo do projeto normaliza os inputs e calcula aceleracao, velocidade e
gravidade. O layout e os colisores de NEON FACILITY continuam inalterados.

`shared/src/simulation/player/movement` possui corpo, collider e controlador.
`beforeStep(input)` calcula o deslocamento permitido; o executor chama uma vez
`world.step()`, depois `afterStep()` publica o estado e verifica os limites.
Assim o movimento nao possui DOM, Three.js ou relogio do navegador, e o mesmo
contrato podera ser usado pelo executor autoritativo futuro. Nao foi criado
transporte, previsao de rede ou sincronizacao nesta etapa.

Parametros: passo fixo de 1/60 s, capsula 1.8 m x raio 0.35 m, olhos a 1.62 m,
velocidades de 6/9 m/s, aceleracao no solo 42 m/s2, frenagem 55 m/s2, controle
no ar 12 m/s2, gravidade 20 m/s2 e pulo 7.5 m/s. Inputs diagonais normalizados,
componentes nao finitos rejeitados, pulo apenas na borda de pressionamento e
quando grounded. Rapier trata slides, slopes ate 45 graus, autostep de 0.25 m
e snap-to-ground de 0.2 m; teto interrompe a velocidade ascendente.

Posicao do estado e dos spawns representa os pes; o corpo fica meia altura
acima. Sair dos limites ou cair abaixo do mapa recupera para o spawn configurado,
zerando a velocidade. Isso e protecao de movimento, nao respawn de combate.
`FixedStep` separa fisica do FPS visual: limita a recuperacao a seis passos
por frame (100 ms), descarta tempo excedente e permite interpolar os dois
ultimos estados na camera, sem extrapolacao ilimitada.

`client/src/game/player/InputManager` e o unico dono dos listeners de teclado,
mouse, foco e Pointer Lock. Somente a captura efetiva ativa o movimento.
O request parte de um clique; recusa gera mensagem; saida, blur ou aba oculta
limpam teclas e desativam o controle. ESC tambem pode ser consumido pelo proprio
navegador: o evento pointerlockchange trata esse caminho. Capturas pendentes
sao invalidadas na saida. Retomar exige um novo gesto, nunca e automatico.

`createPlayerScene` possui o executor local, camera, renderer e input. A fisica
anda a 60 Hz mesmo quando a renderizacao e limitada a 30 FPS. A camera usa FOV
e sensibilidade salvos, pitch limitado e head bob de 0.016/0.024 m no solo,
desativavel e respeitando reduced-motion. Nao existem recoil ou equipamentos.
`createArenaEnvironment` e compartilhado com a inspecao para manter os mesmos
meshes, luz, materiais e descarte, sem duplicar ou alterar o mapa existente.

`ui/PlayerScreen` apresenta loading, entrada, pausa e erro. As configuracoes
existentes sao reutilizadas em um dialogo durante a pausa, mantendo o renderer
e a posicao. Confirmacoes possuem cancelamento isolado. Reiniciar volta ao
SPAWN 08, que oferece uma vista inicial da arena. O App monta exclusivamente
a cena do menu, a inspecao ou a exploracao; sair libera seus recursos.

Debug e opcional, somente no dev: dados de renderer, estado e camera em ate
4 Hz, com atualizacao imediata nas transicoes de captura. Nao ha setState
por frame em jogo normal. Movimento, efeitos de camera e renderizacao
permanecem fora dos componentes React.

Referencias:
- [Rapier: controlador cinematico](https://rapier.rs/docs/user_guides/javascript/character_controller/)
- [Rapier: snap-to-ground](https://rapier.rs/docs/user_guides/javascript/character_controller_snap_to_ground/)
- [MDN: Pointer Lock, eventos e recusa](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API)

## Gameplay local (Etapa 5)

Sem dependencias novas. `@neon-strike/shared/gameplay` e um subpath proprio,
consumido em runtime apenas pela cena FPS carregada sob demanda. O menu nao
importa Rapier por causa dos tipos do indicador de combate.

`WeaponManager` possui catalogo, inventarios separados, cooldown global,
tempo de recarga e mira. NX-7 e automatico; VX e ARC exigem novo pressionamento.
Troca aplica no minimo 12 ticks de equipagem, preserva cooldown maior e cancela
recarga. Municao so e transferida ao final da recarga, limitada pela reserva.
`Life` valida dano finito positivo, limita HP a zero e agenda respawn em 180 ticks.
Regras avancam pelo mesmo passo fixo de 60 Hz do movimento; nao usam timers.

`TrainingSession` e o executor local desta modalidade, nao um MatchManager
ou servidor multiplayer. Possui quatro alvos com sensores Rapier e vida propria,
um campo ambiental de dano, vida do jogador e eventos de combate. Raycasts
partem dos olhos, usam orientacao normalizada em direcoes unitarias, dispersao
limitada e o primeiro impacto no mundo fisico; apenas a capsula propria e excluida.
Sensores de alvos mortos sao desabilitados e reutilizados no respawn.

O character controller usa EXCLUDE_SENSORS mais um predicado estavel que rejeita
sensores. No Rapier 0.12 instalado, o teste real de movimento ainda parava no
holograma usando apenas a flag; o predicado corrigiu o caso. Rampas, coberturas,
paredes e layout original continuam intactos e com seus testes de regressao.

O campo de raio 2 m no CORE aplica 25 HP apos 30 ticks consecutivos dentro;
saida reinicia a exposicao. O spawn 08 fica fora dele e em plataforma solida.
Nao ha adversarios, portanto o respawn fixo e seguro para este treinamento;
nao representa ainda selecao segura contra bots ou outros jogadores.

`InputManager` possui mouse esquerdo/direito, R e 1/2/3, incluindo fila para
cliques curtos. Pausa, foco perdido, morte e respawn limpam a entrada; repeticao
de tecla descartada nao reativa movimento sem um novo pressionamento.
`TrainingRuntime` liga eventos a `WeaponView`, `ParticleManager`, objetos da
arena e `AudioManager`; a UI recebe snapshots em no maximo 10 Hz em jogo.
ESC congela tambem recarga/respawn. Reiniciar limpa vida, alvo e inventarios.

Modelos de equipamentos e hologramas sao geometria original do Three.js.
Efeitos usam 160 instancias de cubos e 24 segmentos de tracer prealocados.
Recuo e flash sao visuais e moderados; a mira secundaria da ARC reduz o FOV
para 65% do configurado. Materiais, geometrias, labels, instancias e sensores
sao descartados antes do mundo fisico e renderer que os possuem.

Audio sintetico provisorio usa Web Audio API. Contexto nasce somente no gesto
de entrada, possui no maximo 12 vozes, respeita Geral/Efeitos, encerra vozes
ao pausar e fecha o contexto ao sair. Falha de audio nao impede a simulacao.
Musica, Interface e Passos permanecem preferencias sem fontes nesta etapa.

`#range` abre treinamento; `#arena` preserva exploracao sem combate. HUD completo,
placar, bots, partida, Socket.IO e autoridade remota nao foram antecipados.
Os contratos atuais sao internos tipados, nao payloads de rede validados.

Referencias e API instalada:
- [Rapier: queries e primeiro impacto](https://rapier.rs/docs/user_guides/javascript/scene_queries/)
- [Rapier: filtros](https://rapier.rs/docs/user_guides/javascript/scene_queries_filters/)
- [MDN: AudioContext.resume](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/resume)
- [MDN: encerramento de fontes](https://developer.mozilla.org/en-US/docs/Web/API/AudioScheduledSourceNode/stop)
- Tipos locais de Rapier 0.12: `castRay` retorna `toi`; nao confundir com APIs de versoes posteriores.

## HUD, estatisticas e placar (Etapa 6)

`TrainingStats` recebe somente eliminacoes confirmadas por `TrainingSession`.
Possui tempo em ticks, eliminacoes, derrotas e feed limitado; pontos sao
derivados de eliminacoes x 100, sem duplicar um contador independente.
O mesmo caminho que elimina um alvo registra o evento identificado e a
pontuacao. Dano em alvo/jogador ja eliminado nao conta novamente.

O feed mantem quatro eventos em ordem cronologica, com IDs monotonicos,
atores identificados, equipamento e expiracao apos 300 ticks. A fila muda por
substituicao, preservando snapshots anteriores. Renomear o perfil nao muda
retroativamente os nomes nos eventos; reiniciar limpa a fila sem reutilizar IDs.
Nao ha setTimeout/setInterval para expirar mensagens ou contar tempo.

Somente o jogador humano local ocupa uma linha no placar de treinamento.
Hologramas sao alvos e o campo e uma causa ambiental, nunca jogadores ficticios.
Ping local e null e a UI mostra LOCAL; ping remoto desconhecido e apresentado
como --. Ainda nao existe medicao de ping ou roster multiplayer nesta etapa.

`shared/src/gameplay/hud` e publicado no subpath `@neon-strike/shared/hud`:
contratos de resumo, atores, feed e linhas do placar; ordenacao pura sem mutar
o array recebido; formatacao de tempo limitada a 99:59:59. Esse modulo nao
importa Rapier, Three ou DOM. `HudSnapshot.clock.kind` distingue elapsed e
remaining; o treinamento fornece apenas elapsed. Fim de partida nao e inferido
pelo componente visual, sendo responsabilidade do futuro MatchManager.

`TrainingRuntime` envia dados de combate e HUD em snapshots de ate 10 Hz
durante o jogo. `CombatReadout` compoe `HudSummary`, `EventFeed` e `Scoreboard`
com vida/municao/feedback existentes. Barra de recarga recebe progresso real
do WeaponManager. A UI nao calcula dano, consome municao ou atribui pontos.

`InputManager` continua dono do teclado/Pointer Lock. TAB emite transicoes
de placar apenas ao pressionar/soltar, sem perder foco nem pausar. `clearGameplay`
separa a limpeza de acoes de combate do estado visual, permitindo consultar
o placar durante morte e respawn. `clear`, pausa, blur e perda de contexto
fecham o placar. TAB fora do Pointer Lock continua navegacao normal de foco.
Os listeners existentes sao removidos na saida, sem novo loop React ou timer.

Tabela sem controles/foco interativo, com cabecalhos semanticos, aria-sort,
linha local destacada e nomes escapados pelo React. Colunas compactas e
quebra de nomes em telas estreitas; layout mais denso para pouca altura.
O feed exibe dois eventos em telas ate 600 px, quatro nas maiores, preservando
os mais recentes. Feed, mira e diagnostico cedem lugar ao placar para evitar
sobreposicoes; durante respawn o contador fica no cabecalho do placar.

Testes de renderizacao com oito linhas e tempo restante usam um fixture em
`tests/fixtures`, importado apenas pelo Playwright via Vite. Ele nao participa
do bundle de producao, da navegacao nem da sessao real de treinamento.

Referencias:
- [MDN: teclado, foco e eventos keydown/keyup](https://developer.mozilla.org/en-US/docs/Web/API/Element/keydown_event)
- [MDN: Pointer Lock e saida da captura](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API)

## Bots locais (Etapa 7)

`shared/bots` e um subpath separado para a sessao local `BotSession`. O treino
estatico `TrainingSession` permanece independente. Ambos reutilizam Life,
WeaponManager, pontuacao/feed e o adaptador de audio/efeitos/HUD existente.
O nome TrainingRuntime foi preservado para evitar renomeacao sem necessidade;
agora ele tambem adapta BotSession, sem simular a IA no React.

NavigationGraph projeta uma grade de um metro sobre os colisores estaticos.
Aceita piso/plataforma/rampa, exige apoio em quatro pontos laterais e margem
para uma capsula. Conecta vizinhos com altura compativel, sem atalhos diagonais
por cantos ou acessos laterais altos de rampas. A* usa ngraph.path, nao uma
implementacao propria. A geometria e de uma unica camada por XZ; um futuro mapa
com passagens sobrepostas exigira outra representacao, como navmesh.

BotBrain decide visao a cada seis ticks (10 Hz), com fases deslocadas por bot.
Destino e revisto a cada 30 ticks; A* so recalcula quando necessario, mantendo
o trecho atual para evitar oscilacao. Custos adicionais contornam outros atores.
Falta de progresso medida em um segundo gera recuo lateral e replanejamento,
nunca teleporte. O mesmo controlador Rapier resolve gravidade, rampas e contatos.
Correcao horizontal de contato tambem respeita o limite de velocidade.

Estados PATROL/SEARCH/CHASE/ATTACK/RESPAWN. Percepcao exige alcance, campo de
visao e raycast sem parede; proximidade de cinco metros admite alerta por tras.
Busca usa apenas a ultima posicao vista e expira em tres segundos. Reacao minima,
velocidade angular limitada, erro de mira e cadencia variam com a dificuldade.
Nenhum perfil possui mira perfeita ou conhecimento continuo atraves de paredes.

BotSession executa beforePhysics, passo Rapier compartilhado, afterPhysics e
combate. Todos os atores possuem ID, Life, capsula e WeaponManager independentes.
Hitscan exclui apenas a propria capsula; o primeiro solido/adversario bloqueia
o disparo. Pontos e derrotas sao registrados somente apos a transicao de morte.
Corpos eliminados nao bloqueiam passagens. Respawn apos 180 ticks escolhe spawn
por distancia/oclusao e restaura capsula, orientacao, vida e equipamentos.

JOGAR abre #bots com configuracao congelada durante a sessao; #range conserva
os hologramas e o campo de dano. Bots nao sao criados no treinamento/exploracao.
HUD identifica BOT em vez de inventar ping. Na Etapa 8, passou a mostrar tempo
restante e a sessao de bots recebeu as regras de partida descritas abaixo.

createBotObjects compartilha geometria e materiais, interpola poses com o mesmo
alpha do jogador e anima passos com delta ativo. Nomes sao texturas locais com
depth test; nenhum nome e injetado como HTML. Efeitos reutilizam pools limitados,
sem crescer com o numero de disparos. Sons proximos sao placeholders mono, nao
audio espacial completo. Dispose remove corpos, grafo, texturas e materiais.
Debug exclusivo de desenvolvimento acrescenta poses/estados dos bots a 4 Hz.

Validacao: caminhos entre todos os pares de spawn com capsulas reais; patrulha
sem combate por dois minutos sem usar respawn como progresso; sete bots em
combate por dois minutos; visao, memoria, reacao, armas, morte, score e descarte.
Playwright testa configuracoes, combate/respawn reais, pausa, TAB, reinicio,
transicoes repetidas e screenshots desktop/mobile. Resultados em STAGE-7.md.

Referencias:
- [ngraph.path: A*, pesos e heuristica](https://github.com/anvaka/ngraph.path)
- [ngraph.graph: estrutura e tipos](https://github.com/anvaka/ngraph.graph)
- [Rapier: controlador de personagem](https://rapier.rs/docs/user_guides/javascript/character_controller/)

## Partidas locais (Etapa 8)

`shared/src/match/MatchManager.ts` nao depende de DOM, renderer, bots ou fisica.
Contrato atual de regras: modo FFA, 180 ticks de contagem, 36000 ticks de jogo,
30 eliminacoes. Regras sao verificadas e copiadas; padroes imutaveis.
Estados COUNTDOWN -> PLAYING -> MATCH_END; reset retorna a COUNTDOWN.
ROUND_END nao e usado porque o FFA atual tem uma unica rodada.

BotSession recebe opcionalmente uma politica de partida; testes unitarios
antigos da IA ainda podem executar o sandbox sem limite. TrainingRuntime sempre
passa FFA_RULES no modo bots da aplicacao. Sem nova opcao de URL/localStorage.
Treinamento e exploracao continuam sem limites. PlayerScene usa o mesmo passo
fixo para contar antes de habilitar fisica, IA e combate; comandos nao se acumulam.
Pause continua uma propriedade do executor local, nao um segundo relogio.

O tick de combate resolve os disparos em ordem estavel de atores. Assim que o
limite e atingido, nao aceita dano/disparos adicionais; a avaliacao ao final do
tick congela o resultado. Clock e verificacao do lider nao alocam um placar a
cada frame; o roster completo e copiado somente no encerramento ou para o HUD.
Contadores por ator registram projeteis e acertos de dano, inclusive pulsos VX.
Ordenacao igual ao TAB: pontos, eliminacoes, menos derrotas e ID estavel.
Ultimo tick com 30 eliminacoes tem precedencia sobre o motivo tempo esgotado.

MatchResults recebe apenas dados imutaveis e callbacks. A tabela foi extraida
do Scoreboard para reutilizar nomes, ordenacao e colunas sem um painel aninhado.
Ao terminar, o executor libera Pointer Lock; callback tardio de unlock nao pode
trocar a tela final por PAUSA. Revanche limpa armas/vida/IA/estatisticas/efeitos,
reinicia contagem e solicita captura por novo gesto. Saida descarta a cena.
Resultados nao possuem botao de lobby ate existir um lobby real.

Testes: regras exatas de 3 s / 10 min / 30 eliminacoes; resultado imutavel;
raycast/vida/respawn reais; contagem bloqueando inputs; pausa; fim com TAB;
revanche, descarte e layout final desktop/mobile. Fixture isolada testa limites
curtos no mesmo PlayerScreen/MatchManager e nao pertence ao bundle de producao.

## Multiplayer (planejado, nao implementado)

Offline: um executor local roda a simulacao compartilhada; pausar interrompe seu
relogio. Online: a mesma organizacao de regras roda no servidor por sala;
abrir o menu so desativa os comandos do jogador local.

Ponto de partida a medir: simulacao com passo fixo de 60 Hz, inputs agrupados em
ate 30 Hz e snapshots em 20 Hz. Renderizacao e frequencia de rede independentes.
Acumulador tera limite de passos para nao entrar em espiral apos uma aba suspensa.
O servidor calcula o tempo por relogio monotonico; nao aceita tempo informado pelo cliente.

Cliente envia sequencia, direcao de movimento, orientacao da camera e acoes.
Nunca decide dano, HP, pontuacao, IDs, respawn, municao ou posicao final.
Servidor normaliza inputs, rejeita valores nao finitos, sequencias repetidas,
excesso de eventos, acoes incompatíveis com o estado e configuracoes invalidas.

Cada snapshot inclui tick e ultima sequencia processada. Jogador local usa
previsao e reconciliacao; jogadores remotos usam buffer de interpolacao inicial
de 100 ms, ajustavel apos medicao. Extrapolacao curta e limitada, nunca infinita.
Eventos de combate levam IDs para deduplicacao; disparos sao validados por
cadencia, municao, estado e raycast do servidor. Compensacao de latencia, se
necessaria, tera historico e janela limitados, sem confiar no timestamp do cliente.

Handshake verifica versao de protocolo. Identidade de jogador sera distinta do
ID de transporte, com retomada temporaria vinculada a uma sessao criada pelo
servidor. Reconectar sempre exige ressincronizacao se a recuperacao falhar.
Saida explicita do host encerra a sala; queda breve reserva uma janela limitada
de retomada antes de encerrar e avisar os demais. Nunca migrar host silenciosamente.

Estados previstos: MENU, LOBBY, LOADING, COUNTDOWN, PLAYING, ROUND_END,
MATCH_END, PAUSED e DISCONNECTED. Apenas o servidor muda estados da partida
online; estados de tela sao locais. Modos futuros implementarao um contrato de
regras separado, sem implementar TDM/CTF/Domination/Gun Game no MVP.

## Riscos e criterios de mitigacao

| Risco | Decisao e verificacao prevista |
| --- | --- |
| Divergencia cliente/servidor | Mesmos dados de mapa e regras; reconciliar pelo tick confirmado; medir erro de posicao |
| Latencia e perda de pacotes | Buffer de snapshots, ping e inputs limitados; simular atraso/quedas antes de LAN real |
| Atravessar paredes e rampas | Rapier com capsula cinematica, shape casts, passo fixo, slope/autostep e testes de cantos |
| Queda, pulo infinito, aba suspensa | Grounded validado, limites de dt/velocidade, piso de recuperacao e spawn seguro |
| Bots presos | Grafo de waypoints derivado do mapa, caminhos bloqueados verificados e deteccao de falta de progresso |
| Frame rate baixo | Orçamento de draw calls, materiais compartilhados, instancing, sombras limitadas e DPR controlado |
| Vazamentos | Dono explicito dos recursos, dispose, remocao de listeners, loops e sockets em cada saida |
| React renderizando a cada frame | Simulacao fora do React; HUD atualizado por snapshots em frequencia limitada |
| Entradas maliciosas | Validacao em runtime, IDs no servidor, limites por conexao e testes de inputs impossiveis |
| Varias placas/VPN/firewall | Exibir enderecos candidatos e permitir configurar URL; nao alterar firewall automaticamente |
| Contexto do navegador | Verificar WebGL 2; Pointer Lock e audio dependem de gesto; fullscreen/clipboard com fallback |
| Reconexao parece sucesso, estado e antigo | Revalidar sessao/sala, recuperar snapshot completo e informar falha claramente |

## Referencias tecnicas consultadas

- [Vite: requisitos e instalacao](https://vite.dev/guide/)
- [Vite: host, portas e proxy](https://vite.dev/config/server-options/)
- [Rapier: character controller](https://rapier.rs/docs/user_guides/javascript/character_controller/)
- [Socket.IO: recuperacao e necessidade de ressincronizacao](https://socket.io/docs/v4/connection-state-recovery/)
- [Three.js: liberacao explicita de recursos](https://threejs.org/manual/en/how-to-dispose-of-objects.html)
