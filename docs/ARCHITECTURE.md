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
      weapons/                 # modelos, animacoes e feedback dos equipamentos
      effects/                 # ParticleManager com pool
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
      weapons/                 # cooldown, municao e dano ficticio
      bots/                    # estados de IA e navegacao
      match/                   # relogio, pontuacao e regras do FFA
      spawn/                   # escolha de spawn e protecao contra queda
    maps/                      # colliders, spawns e grafo de navegacao
    physics/                   # fabrica do mundo Rapier, sem renderizacao
docs/
tests/browser/
```

Somente os diretorios com responsabilidade real das Etapas 1-4 foram criados.
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

Jogar permite configurar nome, mapa, bots e dificuldade, mas iniciar permanece
desabilitado. Treinamento e multiplayer exibem indisponibilidade explicita.
Nao ha simulacao falsa de partidas, lobby ou conexao Socket.IO nesta etapa.

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

## Partidas e multiplayer (planejados, nao implementados)

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
