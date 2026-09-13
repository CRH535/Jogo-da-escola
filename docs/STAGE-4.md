# Etapa 4 - controlador FPS

Concluida e verificada em 13/09/2026. Escopo: somente Etapa 4. Etapa 5 nao iniciada.
Sem novas dependencias, sem alteracao no layout do mapa ou no backend HTTP.

## Implementado

- JOGAR > EXPLORAR ARENA abre NEON FACILITY em primeira pessoa. VER MAPA
  continua disponivel; INICIAR PARTIDA permanece desabilitado sem bots/combate.
- Mouse com Pointer Lock iniciado por gesto, WASD, Shift para correr e Espaco
  para pular. Movimento somente apos a confirmacao real da captura pelo navegador.
- Capsula Rapier, aceleracao/frenagem, velocidade diagonal normalizada, gravidade,
  limite de velocidade, chao validado, pulo por pressionamento e colisao com teto.
- Rampas, plataformas, paredes e coberturas usam os colisores ja existentes.
  Recuperacao de queda/saida dos limites para o spawn, sem sistema de vida.
- Simulacao compartilhada a 60 Hz, camera interpolada e limite de seis passos
  de recuperacao por frame. FPS visual independente da velocidade do jogador.
- FOV, sensibilidade e head bob existentes aplicados a camera FPS. Head bob
  discreto, desativavel e respeitando a preferencia de movimento reduzido.
- ESC libera o cursor e pausa; continuar, configuracoes, reiniciar e voltar
  ao menu. Configuracoes alteradas sem recriar renderer ou reposicionar jogador.
- Blur/aba oculta limpam inputs e pausam; retomar exige novo clique. Recusa de
  Pointer Lock e perda de WebGL possuem mensagens e uma saida funcional.
- Entrada no SPAWN 08, ponto central simples e debug opcional apenas no dev.
  Nenhum equipamento, disparo, audio, vida, bot, placar ou multiplayer adicionado.
- Geometria e iluminacao reutilizadas pela inspecao e pelo FPS. Uma cena ativa
  por vez, com descarte de corpo/colisor/controlador, renderer, texturas, luz,
  listeners, ResizeObserver e contexto WebGL.

## Arquivos criados

| Arquivo | Responsabilidade |
| --- | --- |
| `shared/src/simulation/player/movement.ts` | Modelo de movimento, limites, capsula e colisao |
| `shared/src/simulation/fixedStep.ts` | Acumulador fixo e limite de recuperacao por frame |
| `shared/src/simulation/index.ts` | Exportacoes compartilhadas da simulacao |
| `shared/test/player.test.mjs` | 23 testes do controlador e do passo fixo |
| `client/src/game/player/InputManager.ts` | Pointer Lock, teclas, mouse e perda de foco |
| `client/src/game/player/createPlayerScene.ts` | Executor offline, camera e renderer |
| `client/src/game/player/player.css` | Cena, pausa, entrada e debug responsivos |
| `client/src/maps/createArenaEnvironment.ts` | Ambiente visual reutilizado sem duplicacao |
| `client/src/ui/PlayerScreen.tsx` | Fluxo de entrada, pausa, configuracoes e erro |
| `tests/browser/player.spec.ts` | 10 testes de integracao do FPS no navegador |
| `docs/STAGE-4.md` | Este registro |

## Arquivos alterados

| Arquivo | Alteracao |
| --- | --- |
| `shared/package.json` | Subpath publico simulation |
| `client/src/app/App.tsx` | Composicao da rota arena e preferencias |
| `client/src/app/useMenuNavigation.ts` | Rota, foco de retorno e ESC isolado do FPS |
| `client/src/ui/PlayScreen.tsx` | Comando EXPLORAR ARENA |
| `client/src/maps/createMapScene.ts` | Ambiente visual comum e API de sombras atual |
| `tests/build/smoke.spec.ts` | Segundo teste: FPS real no build, sem ferramentas dev |
| `README.md` | Uso da exploracao, controles e limites atuais |
| `docs/ARCHITECTURE.md` | Contrato do controlador, ciclo de vida e executor |
| `docs/CHECKLIST.md` | Escopo e acompanhamento da Etapa 4 |

`package-lock.json`, configuracoes e fontes de servidor nao precisaram mudar.
Arquivos gerados permanecem em `dist`, `test-results` e `.runtime`, ignorados
pelos padroes do projeto. Logs do dev: `.runtime/stage4-dev.stdout.log` e stderr.

## Validacao

| Comando | Resultado |
| --- | --- |
| `npm run check`, antes da alteracao | Base preservada, build e 30 testes aprovados |
| `npm run typecheck` | Tres workspaces aprovados |
| `npm test` e `npm run check`, depois | 53 testes Node aprovados (6 HTTP + 24 mapa + 23 movimento) |
| `npm run test:e2e`, Chrome | 39 testes aprovados (29 anteriores + 10 controlador) |
| `npm run test:build`, Chrome | 2 testes aprovados no build servido pelo Express |
| HTTP 5173, 5173/api/health e 3000/api/health | 200 com frontend/backend de desenvolvimento ativos |

94 testes distintos aprovados. Tambem repetida a subsuite do jogador depois
de verificar ESC na confirmacao de restauracao dentro das configuracoes da pausa.

Os testes do controlador real cobrem aceleracao, desaceleracao, corrida,
diagonais, inputs nao finitos, orientacao, pulo segurado, novas tentativas de
pulo no ar, teto, rampas nos dois sentidos, corredores, queda de plataforma,
quatro limites externos, quinas, coberturas, reset e recuperacao de queda.
Movimento equivalente comprovado em 30/60/120/144 frames por segundo simulados;
tempo invalido e travamento longo nao causam uma explosao de passos de fisica.

Playwright usa captura real do mouse no Chrome, percorre a arena com teclado,
desce rampa, corre, pula, olha e pausa. Confere camera FOV, head bob desligado,
resolucao interna, preferencias persistidas e ausencia de remontagem ao configurar.
Testa recusa de Pointer Lock, blur, evento de visibilidade, perda de contexto,
cancelamento do carregamento e tres ciclos de entrada/saida com um unico
contexto WebGL ativo. Casos de recusa/visibilidade sao provocados pelo teste;
nao equivalem a uma bateria manual de Alt+Tab em todos os sistemas operacionais.

Capturas com verificacao de pixels em 1440x900, 390x844 e 320x640 mostram
geometria renderizada e menus sem overflow. Imagens desktop e mobile foram
inspecionadas. Viewports estreitos usam mouse/teclado de teste: nao ha suporte touch.
O teste compilado tambem verifica mudanca dos pixels durante o movimento e
ausencia de controles de debug.

Correcoes feitas na verificacao: diagnostico agora publica a posicao exata
ao pausar, sem esperar a proxima amostra de 250 ms; cancelamento de confirmacao
nao fecha o painel pai; uso de PCFShadowMap evita o aviso de API de sombras
removida da versao instalada do Three.js, mantendo seu resultado anterior.

## Limites

- Exploracao funcional nao e uma partida completa. Vida, combate, bots, HUD
  de combate, placar e cronometro continuam para as proximas etapas.
- Agachamento, remapeamento de teclas e tutorial de primeira partida ainda
  nao implementados. Controles podem ser consultados no README e configuracoes.
- Nao existe trafego multiplayer nem validacao de um servidor autoritativo
  rodando partidas. O movimento foi separado para permitir esse trabalho depois.
- As capturas e o contador de FPS nao sao benchmark de computadores intermediarios.
  O debug observado na vista inicial apresentou cerca de 49 draw calls e cinco
  geometrias; valores variam com enquadramento. Perfil de heap continua na Etapa 13.
- UI aproximada: 261 kB / 81 kB gzip; executor FPS: 8.4 kB / 3.5 kB gzip;
  ambiente comum: 2.7 kB / 1.4 kB gzip. Three.js: 538 kB / 134 kB gzip;
  Rapier/WASM: 2047 kB / 762 kB gzip. Motores carregam sob demanda. Avisos
  de chunks maiores que 500 kB permanecem visiveis, sem impedir o build.
- Nenhum firewall foi modificado e nenhum teste em duas maquinas fisicas foi feito.

Proxima etapa, mediante autorizacao: equipamento inicial e gameplay da Etapa 5,
preservando controlador, mapa e testes atuais.
