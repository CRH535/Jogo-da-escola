# Etapa 5 - gameplay local

Concluida e verificada em 13/09/2026. Escopo: somente Etapa 5.
Sem dependencias novas, sem alteracao dos solidos/spawns de NEON FACILITY,
sem alteracao no backend HTTP. Etapa 6 nao iniciada.

## Implementado

- TREINAMENTO > INICIAR TREINAMENTO abre a arena com equipamento inicial.
  JOGAR > EXPLORAR ARENA continua sem dano, armas ou alvos de treinamento.
- NX-7 Pulse automatico, VX Scatter de curto alcance e ARC-9 de precisao.
  Clique esquerdo, R, seletores 1/2/3 e mira secundaria no botao direito da ARC.
- Cadencia limitada, municao por equipamento, reserva finita, recarga com
  transferencia ao terminar e troca sem contornar cooldown ou criar municao.
- Disparos por raycast Rapier a partir dos olhos. Paredes/coberturas bloqueiam
  alvos; dispersao, alcance e queda de dano sao regras ficticias de gameplay.
- Quatro hologramas estaticos com 100 HP, barra de vida, eliminacao em cubos
  digitais e reaparecimento apos 3 s. Sensores nao bloqueiam o jogador.
- Jogador com 100 HP. Campo ambiental de energia marcado no CORE causa
  25 HP a cada 0.5 s de exposicao. Eliminacao bloqueia comandos; respawn em
  3 s no SPAWN 08, fora do campo, com vida e equipamentos restaurados.
- Indicadores minimos de vida, carga/reserva, equipamento, recarga, acerto,
  dano e respawn. Nao sao o HUD completo, placar ou feed da Etapa 6.
- Pausa congela movimento, combate, recarga e respawn. Reiniciar restaura a
  sessao inteira. Entrada/saida, blur e morte limpam os inputs pendentes.
- Modelos originais simples, recuo visual, flash, 24 tracers e 160 particulas
  em pools. Materiais, geometrias, texturas e sensores possuem descarte explicito.
- Audio sintetico original provisorio, ativado por gesto e limitado a 12 vozes.
  Geral/Efeitos funcionam; mute, pausa e saida interrompem sons corretamente.
  Falha de Web Audio nao impede o treinamento.
- Regras em shared sem DOM/Three; apresentacao no cliente; snapshots para
  React em no maximo 10 Hz durante simulacao. Sem setInterval de gameplay.

## Arquivos criados

| Arquivo | Responsabilidade |
| --- | --- |
| `shared/src/gameplay/weapons.ts` | Catalogo, inventario, recarga, cadencia, queda de dano |
| `shared/src/gameplay/Life.ts` | Vida, eliminacao e contador de respawn |
| `shared/src/gameplay/trainingLayout.ts` | Posicoes/dimensoes dos alvos e campo ambiental |
| `shared/src/gameplay/TrainingSession.ts` | Executor local, raycasts, alvos e eventos |
| `shared/src/gameplay/index.ts` | API publica do subpath gameplay |
| `shared/test/gameplay.test.mjs` | 18 testes de regras e integracao com Rapier |
| `client/src/audio/AudioManager.ts` | Sintese, volumes, limite de vozes e descarte |
| `client/src/game/combat/TrainingRuntime.ts` | Adaptador da simulacao para audio, cena e UI |
| `client/src/game/combat/WeaponView.ts` | Modelos de equipamentos, flash e recuo |
| `client/src/game/combat/ParticleManager.ts` | Pools de cubos digitais e tracers |
| `client/src/game/combat/createTrainingObjects.ts` | Hologramas, barras, labels e campo visivel |
| `client/src/ui/CombatReadout.tsx` | Indicadores minimos de combate e respawn |
| `client/src/ui/combat.css` | Apresentacao responsiva dos indicadores |
| `tests/browser/gameplay.spec.ts` | Nove testes de treinamento no Chrome |
| `docs/STAGE-5.md` | Este registro |

## Arquivos alterados

| Arquivo | Alteracao |
| --- | --- |
| `shared/package.json` | Exportacao isolada de gameplay |
| `shared/src/simulation/player/movement.ts` | Filtro explicito para sensores nao bloquearem movimento |
| `client/src/game/player/InputManager.ts` | Disparo, mira, recarga, troca e limpeza de entradas |
| `client/src/game/player/createPlayerScene.ts` | Modo treinamento opcional, pausa, reinicio e ciclo de vida |
| `client/src/ui/PlayerScreen.tsx` | Composicao dos indicadores e entrada de treinamento |
| `client/src/ui/InformationScreens.tsx` | Treinamento habilitado e creditos de audio atualizados |
| `client/src/app/App.tsx` | Rota range com cena exclusiva |
| `client/src/app/useMenuNavigation.ts` | Navegacao, ESC e foco de retorno do treinamento |
| `tests/browser/menu.spec.ts` | Treinamento habilitado sem habilitar multiplayer |
| `tests/browser/player.spec.ts` | Repeticao de tecla apos pausa nao reativa movimento |
| `tests/build/smoke.spec.ts` | Combate real no build servido pelo Express |
| `README.md` | Como jogar, equipamentos, audio e limites atuais |
| `THIRD_PARTY_NOTICES.md` | Origem dos modelos e audio sintetico |
| `docs/ARCHITECTURE.md` | Separacao das regras, apresentacao e recursos |
| `docs/CHECKLIST.md` | Escopo e acompanhamento da Etapa 5 |

`package-lock.json`, scripts npm e fontes do servidor nao precisaram mudar.
Saidas geradas ficam em `dist`, `test-results` e `.runtime`, ja ignorados.

## Validacao

| Comando | Resultado |
| --- | --- |
| `npm run check`, antes | Build e 53 testes da base aprovados |
| `npm run typecheck` | Tres workspaces aprovados |
| `node --test shared/test/gameplay.test.mjs` | 18 testes novos aprovados |
| `npm run check`, depois | Build e 71 testes Node aprovados |
| `npm run test:e2e`, Chrome | 48 testes aprovados (39 anteriores + 9 gameplay) |
| `npm run test:build`, Chrome | 3 testes aprovados, incluindo combate no build |
| Subsuite final de pixels e repeticao de tecla | 4 testes reaprovados apos fortalecer as assercoes |
| HTTP 5173, 5173/api/health e 3000/api/health | 200 com frontend/backend de desenvolvimento ativos |

122 testes distintos aprovados: 71 Node, 48 navegador e 3 build.
Os quatro testes da subsuite final sao repeticoes, nao entram novamente no total.
Dev iniciado em segundo plano com `npm run dev`; logs em
`.runtime/stage5-dev.stdout.log` e `.runtime/stage5-dev.stderr.log`.
Entrada local de treinamento tambem capturada em `.runtime/stage5-local-entry.png`.

Testes de regras cobrem cadencia, disparo semiautomatico, municao esgotada,
recarga parcial, reserva vazia, troca durante cooldown/recarga, selecao invalida,
acoes de jogador morto, mira exclusiva, alcance e queda de dano, vida e respawn
exato. Integracao Rapier confere oclusao por parede, primeiro impacto, capsula
propria excluida, quantidade de pulsos, eliminacao unica, reaparecimento de
sensores, passagem real por hologramas, campo de dano e reinicio.

Playwright usa Pointer Lock real, mouse/teclado, tres equipamentos, recarga,
mira e mudanca de FOV. Testa morte provocada pelo campo com movimento real,
pausa de recarga e de respawn, descarte de entrada durante morte, posicao segura
de retorno, limpeza de contadores e ausencia de combate na exploracao livre.
Audio e instrumentado no navegador para confirmar ativacao por gesto, mute e
fechamento de contextos. Tres entradas/saidas conservam apenas um contexto
WebGL vivo, sem contextos de audio deixados abertos ao retornar ao menu.

Capturas/pixels em 1440x900, 390x844 e 320x640 verificam cena nao vazia,
troca visual dos equipamentos e indicadores sem overflow/sobreposicao.
Imagens desktop/mobile e eliminacao/respawn foram inspecionadas. Capturas em
`test-results/browser/gameplay-*`; nao foram adicionados controles touch.

Correcoes durante validacao:
- A flag EXCLUDE_SENSORS isolada do Rapier 0.12 nao bastou no teste do
  character controller. Predicado explicito `!candidate.isSensor()` corrigiu
  a passagem, mantendo aprovados os testes anteriores de colisao.
- Equipamentos receberam escala e posicao dependente do aspecto para nao
  ocupar excessivamente a cena em viewports estreitos.
- Repeticao de uma tecla ja descartada pela pausa/morte nao a reativa.

## Limites

- Treinamento local nao e uma partida completa. Sem bots, pontuacao competitiva,
  placar TAB, feed, relogio, countdown de inicio, resultados ou multiplayer.
- Indicadores basicos atendem a verificacao do combate; HUD completo permanece
  na Etapa 6. Nenhuma conexao falsa ou sistema autoritativo remoto foi criado.
- Spawn 08 e seguro para este campo estatico. Selecao por adversarios/linha
  de visao sera implementada quando houver combate contra outros atores.
- Geometria e efeitos sao provisorios. Equipamento proximo de paredes ainda
  usa a profundidade da cena; apresentacao refinada fica para o polimento.
- Musica, passos, sons de interface e tutorial automatico continuam pendentes.
  Audio atual e sintese provisoria, sem arquivos externos ou conteudo protegido.
- Pools e descarte foram exercitados; ainda nao ha perfil completo de heap,
  benchmark em PCs intermediarios ou prova de performance em todas as GPUs.
- Bundle UI: 262 kB / 82 kB gzip; executor FPS/combat: 24.4 kB / 9.1 kB gzip;
  Three: 550 kB / 137 kB gzip; Rapier/WASM: 2047 kB / 762 kB gzip.
  Motores carregam sob demanda. Aviso Vite sobre chunks >500 kB permanece.
- Nenhum firewall foi alterado; nenhum teste em dois computadores foi feito.

Proxima etapa, mediante autorizacao: Etapa 6, HUD completo, preservando estes sistemas.
