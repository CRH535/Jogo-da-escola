# Etapa 3 - mapa NEON FACILITY

Concluida e verificada em 13/09/2026. Escopo autorizado: somente Etapa 3.
Menus e backend das etapas anteriores foram preservados. Etapa 4 nao iniciada.

## Implementado

- Arena de 48 x 40 m, piso continuo, limites externos, centro aberto,
  corredores laterais com tres ligacoes transversais, seis coberturas,
  duas plataformas a 3 m e duas rampas de 8 m (inclinacao aproximada de 20.6 graus).
- Oito pontos de spawn, seis no piso e dois elevados, sem intersecao com solidos.
- Uma unica definicao compartilhada para os 19 solidos, posicoes, medidas e
  rotacoes. Rapier usa cuboides e cunhas convexas; Three.js usa a mesma geometria.
- Materiais simples, luz ambiente/direcional, sombra estatica opcional,
  faixas discretas, nomes de setores e marcadores locais, sem assets externos.
- JOGAR > VER MAPA: camera orbital, zoom, vistas de setores/spawns, restaurar
  vista, ocultar marcadores e voltar por botao/ESC com foco e escolhas preservados.
- Carregamento assincrono de renderer/fisica com estado de loading e erro.
  Falha nao bloqueia a saida; deixar a tela cancela a montagem tardia.
- Debug de colisores reais disponivel somente no dev. Sem controle no build.
- Compartilhamento de geometrias/materiais, limite de DPR/FPS, sombra calculada
  somente quando necessario e descarte de mundo WASM/Three/listeners/controls.

## Arquivos criados

| Arquivo | Responsabilidade |
| --- | --- |
| `shared/src/maps/types.ts` | Contrato do mapa, solidos e spawns |
| `shared/src/maps/neonFacility.ts` | Layout unico da arena |
| `shared/src/maps/geometry.ts` | Vertices e faces das rampas |
| `shared/src/maps/index.ts` | Exportacoes dos dados, sem carregar fisica |
| `shared/src/physics/createMapWorld.ts` | Inicializacao Rapier e mundo estatico |
| `shared/test/map.test.mjs` | 24 testes de layout, colisoes e ciclo de vida |
| `client/src/maps/buildMapMeshes.ts` | Meshes, materiais, rotulos e dispose |
| `client/src/maps/mapViews.ts` | Vistas de inspecao |
| `client/src/maps/createMapScene.ts` | Camera orbital, luz, renderer e dispose |
| `client/src/maps/map.css` | Layout full-bleed responsivo |
| `client/src/ui/MapScreen.tsx` | Tela de inspecao, loading e erro |
| `tests/browser/map.spec.ts` | 8 testes de navegador do mapa |
| `docs/STAGE-3.md` | Este registro |

## Arquivos alterados

| Arquivo | Alteracao |
| --- | --- |
| `shared/package.json` | Dependencia Rapier e subpaths maps/physics |
| `package-lock.json` | Registro da dependencia |
| `package.json` | Incluir testes compartilhados em test/check |
| `client/src/app/App.tsx` | Rota de mapa e troca de cena |
| `client/src/app/useMenuNavigation.ts` | Hash, ESC e foco de retorno a JOGAR |
| `client/src/ui/PlayScreen.tsx` | Comando VER MAPA |
| `client/src/ui/InformationScreens.tsx` | Credito e licenca do Rapier |
| `client/src/game/SceneViewport.tsx` | Reset de status ao remontar a cena do menu |
| `tests/build/smoke.spec.ts` | Carregar mapa/fisica pelo Express e verificar ausencia de debug |
| `README.md` | Estado, inspecao, testes e limites atuais |
| `docs/ARCHITECTURE.md` | Dados compartilhados, fisica, renderizacao e ciclo de vida |
| `docs/CHECKLIST.md` | Escopo e conclusao da Etapa 3 |
| `THIRD_PARTY_NOTICES.md` | Rapier, Apache-2.0 |

Saidas geradas: `client/dist`, `server/dist`, `shared/dist`, capturas em
`test-results/browser` e `test-results/build`, capturas manuais em `.runtime`.
Nao houve alteracao em fontes do backend nem em portas/firewall.

## Validacao executada

| Comando/verificacao | Resultado |
| --- | --- |
| `npm install @dimforge/rapier3d-compat -w @neon-strike/shared` | Dependencia 0.12.0 instalada, auditoria sem vulnerabilidades |
| `npm run check` | Build e 30 testes Node aprovados (6 HTTP + 24 mapa/fisica) |
| `npm run typecheck` | Tres workspaces aprovados |
| `npm run test:e2e`, Chrome | 29 testes aprovados (21 anteriores + 8 mapa) |
| `npm run test:build`, Chrome | Build e 1 teste aprovado pelo Express, sem Vite |
| HTTP local 5173, 5173/api/health e 3000/api/health | 200, frontend e backend ativos |

Total: 60 testes aprovados. Nenhum erro inesperado de console nos fluxos
verificados. Os testes de falha provocam deliberadamente falha de modulo,
WebGL/contexto e indisponibilidade de backend.

Testes fisicos usam uma capsula de 1.8 m de altura e raio 0.35 m com Rapier:
subida/descida das duas rampas e emendas, corredores laterais, passagem central,
passagens atras das plataformas, bloqueio das quatro paredes com deslocamento
grande, coberturas/divisorias, piso amostrado em toda a area, spawns sem
interseccao e corpo em queda com CCD. Tambem verificam que a cunha visual e
fechada, tem faces voltadas para fora e que mundos independentes podem ser liberados.

Playwright verifica pixels de geometria e mudanca real da cena ao orbitar,
aproximar, restaurar vista ou ocultar spawns. Capturas foram inspecionadas em
1440x900, 390x844 e 320x640. A vista geral nao corta a arena junto a bordas ou
barras de interface. Vistas aproximadas focalizam intencionalmente apenas um setor.
Tres entradas/saidas seguidas mantiveram apenas um contexto WebGL ativo.

Durante a validacao, corrigidos um tipo de geometria demasiado restrito e o
enquadramento inicial junto ao rodape. A primeira comparacao de restauracao de
camera tambem incluia o hover do botao; o teste foi corrigido para comparar
somente a area 3D, e a suite completa passou novamente, sem ampliar tolerancias.

## Limites e proxima etapa

- A inspecao nao e gameplay. Nao foram adicionados jogador, Pointer Lock,
  WASD, pulo, corrida, armas, bots ou eventos multiplayer.
- Colisores estaticos e passagens passaram nos testes; sensacao de movimento,
  limites de velocidade, quinas e pulo real serao validados com o controlador
  da Etapa 4. A camera orbital nao e restringida pelas paredes.
- Os spawns sao geometricamente livres; selecao por distancia/linha de visao
  de adversarios depende dos sistemas posteriores de jogador e respawn.
- O mapa permanece um blockout. Balanceamento de combate, navegacao de bots,
  materiais detalhados e benchmark de FPS/memoria pertencem a etapas futuras.
- Rapier compat inclui WASM no bundle: aproximadamente 2048 kB / 762 kB gzip,
  carregado apenas na inspecao. Three.js: 538 kB / 134 kB gzip. Vite emite aviso
  de chunks acima de 500 kB; nao impede o build. Nao foi ocultado o aviso.
- Foi verificado descarte de contextos/recursos, nao um perfil completo de heap
  ou desempenho em computadores intermediarios e nem LAN em duas maquinas reais.

Proxima etapa, mediante autorizacao: controlador FPS sobre os colisores existentes,
mantendo a definicao compartilhada do mapa e os testes desta etapa.
