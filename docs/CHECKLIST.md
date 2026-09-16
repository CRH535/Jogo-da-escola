# NEON STRIKE - checklist de desenvolvimento

Uma etapa so recebe [x] depois da implementacao, execucao, testes e registro dos
arquivos e limitacoes. A prioridade e jogabilidade, colisao e performance.
Escopo atual autorizado: Etapa 11. Nao iniciar a Etapa 12 neste turno.

- [x] 1. Fundacao: workspaces, dependencias, Vite/React/Three, Node/Express,
  scripts, health via proxy, build, teste de navegador e documentacao inicial.
- [x] 2. Menu: principal com seis opcoes, jogar/bots/mapa/dificuldade,
  treinamento, configuracoes por categoria, creditos, sair informativo,
  preferencias validadas no localStorage; validar ida/volta e reload.
- [x] 3. Mapa: NEON FACILITY em geometria basica, piso, paredes, rampas,
  colliders, spawns e luz; validar limites e passagens antes do acabamento.
- [x] 4. Jogador: Pointer Lock, WASD/mouse, aceleracao, desaceleracao, corrida,
  gravidade e pulo; testar quinas, rampas, teto, queda, alt-tab e FPS variados.
- [x] 5. Gameplay: NX-7 Pulse primeiro, depois VX Scatter e ARC-9; cooldown,
  municao, recarga, alvos, 100 HP, dano, eliminacao digital e respawn em 3 s.
- [x] 6. HUD: vida, municao, equipamento, mira, hit marker, feedback de dano,
  jogadores, cronometro, feed temporario e placar TAB ordenado.
- [x] 7. Bots: navegacao primeiro, deteccao depois, combate depois;
  PATROL/SEARCH/CHASE/ATTACK/RESPAWN, perda de alvo, 1-7 bots, tres dificuldades.
- [x] 8. Partidas: FFA, countdown 3/2/1/GO com input bloqueado, 10 min ou
  30 eliminacoes, +100 por eliminacao, pausa offline, resultados e reinicio.
- [x] 9. Rede basica: Socket.IO e NetworkManager; handshake, dois navegadores,
  dois jogadores visiveis, inputs limitados, movimento autoritativo,
  previsao/reconciliacao, interpolacao, ping e reconexao. Sem combate ate passar.
- [x] 10. Gameplay online: disparos, cadencia, municao, HP, raycast, eliminacao,
  respawn, placar, relogio e fim validados pelo servidor; testes de abuso.
- [x] 11. Lobby LAN: criar/entrar por endereco, nome/mapa/limite/modo,
  HOST/PRONTO/ping, restricao de inicio, copiar endereco com fallback,
  sala cheia/iniciada/incompativel, saida do host/cliente e retomada limitada.
- [ ] 12. Polimento: sons originais ou placeholders identificados, grupos de
  volume, passos/pulo/disparo/recarga/UI/contagem/resultado, pooling de particulas,
  head bob opcional, recoil sutil, setores do mapa, loading, tutorial persistido,
  video/FOV/sensibilidade/fullscreen/FPS/sombras e tela final completa.
- [ ] 13. Otimizacao: medir FPS, frame time, memoria, draw calls, objetos,
  trafego, React renders, listeners, loops e sockets apos varios reinicios;
  debug exclusivo para desenvolvimento; corrigir vazamentos e gargalos.
- [ ] 14. Testes completos: menu, jogo, morte, respawn, fim, reinicio, retorno,
  configuracao/reload; host/cliente saindo, queda, reconexao, disparos simultaneos,
  placar e fim sincronizados; testar dois computadores reais na mesma rede.

## Porta de aprovacao por etapa

1. Executar verificacao de tipos/build e testes pertinentes existentes.
2. Executar a aplicacao e exercitar o comportamento que mudou.
3. Verificar console, servidor e estados de erro.
4. Corrigir problemas antes de seguir.
5. Registrar arquivos criados, alterados, comandos, resultado e limitacoes.
6. Informar o usuario. Avancar apenas dentro do escopo autorizado.

## Aceite do MVP

- [ ] Menu e configuracoes persistidas; um mapa; FPS com movimento confiavel.
- [ ] Tres equipamentos, vida, eliminacao, respawn, bots e dificuldade.
- [ ] HUD, TAB, feed, countdown, tempo, pontuacao e fim/reinicio de partida.
- [ ] Servidor LAN, lobby, dois ou mais jogadores e combate sincronizado.
- [ ] README reproduzivel para host e cliente, com portas e problemas conhecidos.
- [ ] Validacao em duas maquinas reais registrada sem confundir com duas abas.

Novos mapas, modos, skins, contas, rank, banco, servidores publicos e matchmaking
permanecem fora do escopo ate o MVP passar.
