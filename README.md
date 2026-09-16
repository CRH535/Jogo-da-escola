# NEON STRIKE

FPS de arena futurista para navegador desktop, com partidas rapidas e efeitos
digitais sem violencia grafica. Projeto em desenvolvimento incremental.

**Estado atual: Etapa 11 - lobby e salas LAN.** JOGAR inicia partida com 1-7 bots,
tres dificuldades, tres equipamentos, eliminacoes, respawn, feed e placar.
TREINAMENTO com hologramas, exploracao livre, mapa, menus e backend preservados.
Contagem inicial, limite de dez minutos/30 eliminacoes, resultado e revanche.
MULTIPLAYER conecta ate oito jogadores por sala, com movimento
autoritativo, avatares, previsao, interpolacao, ping e retomada de conexao.
Combate online possui tres equipamentos, vida, eliminacao, respawn, placar e
partida FFA controlados pelo servidor. Salas isoladas, HOST, PRONTO e inicio autorizado.

JOGAR, MULTIPLAYER, TREINAMENTO, CONFIGURACOES, CREDITOS e SAIR abrem suas telas.
O menu JOGAR salva nome, mapa, 1-7 bots e dificuldade e inicia a arena local.
MULTIPLAYER permite CRIAR PARTIDA ou ENTRAR EM PARTIDA por endereco/codigo.
O servidor admite quatro salas simultaneas; sair como host encerra sua sala.

## Requisitos e instalacao

- Node.js 24.x e npm 11 ou superior. Ambiente inicial: Node 24.15.0 / npm 12.0.2.
- Navegador desktop atualizado com WebGL 2 e aceleracao grafica habilitada.
- Windows/PowerShell, Linux ou macOS; os scripts npm nao dependem de shell Unix.

Na raiz:

```sh
npm install
npm run dev
```

Frontend: **http://localhost:5173**. Backend: **http://localhost:3000/api/health**.
`npm run dev` compila o pacote compartilhado e inicia seus tipos em watch,
o Express com reinicio automatico e o Vite. Ctrl+C encerra o grupo.
Se o PowerShell bloquear `npm.ps1`, use `npm.cmd install` e `npm.cmd run dev`.

Sem `.env`, os padroes funcionam. `.env.example` documenta as variaveis opcionais
de um `.env` na raiz; reinicie os processos depois de altera-las.
Variaveis do terminal tem precedencia. Nao ha segredos ou credenciais requeridos.

## Comandos

| Comando | Resultado |
| --- | --- |
| `npm run dev` | Frontend, backend e shared em watch |
| `npm run dev:client` | Compila shared e inicia apenas Vite |
| `npm run dev:server` | Compila shared e inicia apenas Express |
| `npm run typecheck` | Verifica TypeScript nos tres pacotes |
| `npm run build` | Compila shared/server e gera client/dist |
| `npm run check` | Build e testes HTTP/contrato/mapa/movimento/gameplay/HUD/bots |
| `npm test` | Compila servidor/shared e executa testes do Node |
| `npm run test:e2e` | Testes de navegador com servidores isolados em 5180/3100 |
| `npm run test:build` | Build e teste do frontend/API pelo Express na porta isolada 3101 |
| `npm start` | Executa server/dist; requer build previo |

Nos comandos separados, alteracoes em `shared/src` exigem recompilar shared
ou executar `npm run dev -w @neon-strike/shared` em outro terminal.
Prefira `npm run dev` para trabalhar nos tres pacotes.

## Validar o projeto

```sh
npm run check
npx playwright install chromium
npm run test:e2e
npm run test:build
```

Com Google Chrome ja instalado, o download do Chromium e opcional. PowerShell:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm.cmd run test:e2e
```

Os testes verificam status HTTP e proxy, protocolo incompatível, backend
indisponivel e recuperado, fallback sem WebGL, resize/reload e pixels em movimento
em 1440x900 e 390x844. Tambem cobrem navegacao, foco, historico, persistencia,
restauracao com confirmacao, armazenamento corrompido/bloqueado, fullscreen e
menus ate 320px de largura. Capturas ficam em `test-results/browser/`;
o teste compilado usa `test-results/build/`. Traces sao mantidos em falhas.
Os testes do mapa verificam geometria, piso sem lacunas, spawns livres, colisao
com paredes/coberturas, subida/descida das rampas e passagens por capsulas de teste.
No navegador, verificam enquadramento/pixels, orbita, zoom, troca de vistas,
retorno ao menu, cancelamento do carregamento, perda de contexto e descarte WebGL.
O controlador real possui testes de aceleracao, frenagem, velocidade diagonal,
gravidade, pulo unico, teto, quinas, rampas, plataformas e movimento equivalente
em 30/60/120/144 FPS. Playwright exercita Pointer Lock real, teclado/mouse,
pausa, configuracoes, reinicio, recusa de captura, perda de foco/contexto e saida.
O treinamento acrescenta testes de cadencia, municao, dano por raycast,
oclusao por paredes, alvos, vida, morte e respawn. Chrome valida os tres
equipamentos, mira, pausa de recarga/respawn, reinicio, audio/mute e descarte
de contextos em entradas repetidas. O HUD tem testes de pontos, derrotas, tempo,
feed limitado/expiracao, ordenacao, TAB durante morte/respawn e nomes longos.
Uma fixture exclusiva de testes verifica oito linhas do placar, sem simular
conexoes na aplicacao. O build compilado tambem exercita combate e HUD.
Etapa 6 validada com 147 testes: 84 Node, 59 navegador e 4 build.
Etapa 7 acrescenta testes de navegacao com capsulas reais entre todos os spawns,
patrulha prolongada, percepcao/oclusao, memoria, reacao, combate e respawn dos bots.
Validacoes anteriores estao no [registro da Etapa 7](docs/STAGE-7.md).
Etapa 7 validada com 173 testes: 99 Node, 69 navegador e cinco build.
Etapa 8 acrescenta testes de contagem, limites exatos, resultados imutaveis,
precisao, bloqueio de acoes, pausa, revanche e fim com TAB aberto.
Resultados novos estao no [registro da Etapa 8](docs/STAGE-8.md).
Etapa 8 validada com 187 testes distintos: 108 Node, 74 navegador (em dois
blocos, conforme o registro) e cinco build. Contagem e combate tambem conferidos
no servidor de desenvolvimento em localhost:5173.
Isso nao constitui benchmark de GPU, teste multiplayer ou gameplay touch.

Etapa 9 validada com **212 testes distintos**: 121 Node, 85 navegador (regressao
anterior + bloco LAN final) e seis build. Dois clientes reais, avatar remoto,
movimento autoritativo, 150 ms de RTT simulado, retomada, limites e descarte.
Detalhes, correcoes e arquivos em [Etapa 9](docs/STAGE-9.md). Teste em dois
computadores fisicos continua pendente; nao e substituido por duas abas locais.

Etapa 10 validada com **225 testes distintos**: 132 Node, 87 navegador em lotes
e seis build. Combate real entre dois clientes, respawn, placar, fim e nova rodada.
Um teste interrompido por HMR passou na reexecucao isolada do bloco completo;
detalhes e arquivos em [Etapa 10](docs/STAGE-10.md). Nao executar build de shared
simultaneamente a testes do Vite, pois a recompilacao recarrega a cena em teste.

Etapa 11 validada com **244 testes distintos**: 142 Node, 96 navegador em lotes
(74 offline, 13 rede e nove lobby) e seis build. Inclui isolamento de salas,
prontidao, host, reconexao, combate, retorno ao lobby e layouts ate 320 px.
Correcoes, comandos e arquivos em [Etapa 11](docs/STAGE-11.md).
O teste em dois computadores fisicos permanece pendente.

## Jogar o treinamento (Etapa 5)

1. Abra http://localhost:5173 > TREINAMENTO > INICIAR TREINAMENTO.
2. Clique em ENTRAR NA ARENA. O primeiro alvo esta alinhado com a mira.
3. Clique esquerdo dispara; R recarrega; 1, 2 e 3 selecionam equipamentos.
4. Os quatro hologramas possuem 100 HP. Ao eliminar um alvo, ele se dissolve
   em particulas digitais e retorna depois de 3 segundos de simulacao.
5. O circulo coral no CORE, rotulado CAMPO INSTAVEL / DANO, causa 25 HP a
   cada 0.5 s de exposicao. Entre nele para testar dano e eliminacao do jogador.
6. Ao chegar a zero HP, comandos de combate/movimento ficam bloqueados e
   aparece RESPAWN EM 3, 2, 1. O jogador retorna ao SPAWN 08, fora do campo,
   com 100 HP e os equipamentos reabastecidos. Nao ha adversarios nesta etapa.
7. ESC pausa toda a simulacao, inclusive recarga e respawn. REINICIAR restaura
   jogador, alvos e municao; VOLTAR AO MENU libera a sessao e seus recursos.

| Equipamento | Seletor | Carga / reserva | Cadencia | Recarga | Perfil ficticio |
| --- | --- | --- | --- | --- | --- |
| NX-7 Pulse | 1 | 30 / 150 | Automatico, 7.5/s | 1.4 s | 20 de dano proximo, alcance 55 m |
| VX Scatter | 2 | 6 / 36 | Um clique, intervalo 0.8 s | 1.8 s | 8 pulsos dispersos, queda forte de dano, 22 m |
| ARC-9 | 3 | 5 / 25 | Um clique, intervalo 0.9 s | 1.7 s | 80 de dano proximo, precisao alta, 90 m |

Somente ARC-9 tem mira secundaria: segure o botao direito para aproximar.
O alcance e a dispersao pertencem apenas as regras ficticias deste jogo.
Paredes e coberturas bloqueiam disparos; hologramas nao bloqueiam movimento.
Trocar equipamento cancela a recarga sem conceder municao e nao elimina o
cooldown restante. Reserva e finita; reiniciar a sessao ou respawn reabastece.

## HUD e placar (Etapa 6)

- Vida, carga/reserva, equipamento, mira, acerto, dano e respawn continuam
  ligados ao combate real. Recarga tem barra de progresso; vida e municao
  baixas recebem destaque, sem piscadas ou efeitos fortes.
- O topo mostra pontos, TEMPO DE TREINO e quantidade real de jogadores.
  Cada alvo eliminado vale 100 pontos locais; morrer acrescenta uma derrota
  sem apagar os pontos. Alvos holograficos nao entram na lista de jogadores.
- Segure TAB para abrir o placar; solte para fechar. Exibe JOGADOR,
  ELIMINACOES, DERROTAS, PONTUACAO e PING, ordenado por pontuacao decrescente.
  Empates usam mais eliminacoes, menos derrotas e ID estavel.
- O treinamento tem um unico jogador e mostra LOCAL no lugar de ping.
  Nao sao simuladas conexoes nem preenchidas linhas com bots inexistentes.
- O feed registra jogador > alvo e Campo de energia > jogador. Eventos duram
  5 segundos de simulacao; armazena no maximo 4, exibindo os 2 mais recentes
  em telas de ate 600 px. A pontuacao nao desaparece ao expirar um evento.
- TAB nao pausa, nao libera Pointer Lock e funciona durante morte/respawn.
  ESC ou perda de foco fecha o placar e pausa. Nos menus, TAB navega normalmente.
- Pausa congela cronometro e expiracao do feed. Respawn conserva estatisticas;
  REINICIAR e uma nova entrada zeram tempo, pontuacao, derrotas e feed.

O treinamento e livre: o cronometro mostra tempo **decorrido**, nao uma falsa
contagem regressiva de partida. O contrato visual suporta tempo restante para
a integracao com partidas. JOGAR usa tempo restante, limite de 10 minutos/30
eliminacoes e resultados; o treinamento continua separado dessas regras.

## Explorar em primeira pessoa (Etapa 4)

1. Abra http://localhost:5173 e selecione JOGAR > EXPLORAR ARENA.
2. Aguarde o carregamento e clique em ENTRAR NA ARENA para capturar o mouse.
3. Use WASD para andar, mouse para olhar, Shift para correr e Espaco para pular.
4. ESC libera o cursor e pausa. CONTINUAR captura novamente; CONFIGURACOES
   permite ajustar video, sensibilidade e head bob sem perder a posicao.
5. REINICIAR retorna ao SPAWN 08. VOLTAR AO MENU encerra a exploracao.

Andar: 6 m/s; correr: 9 m/s, com aceleracao e desaceleracao. Diagonais sao
normalizadas. Segurar Espaco nao repete o pulo; e preciso soltar e pressionar
novamente depois de tocar o chao. Nao ha agachamento nesta etapa.
O jogador usa uma capsula de 1.8 m de altura e raio 0.35 m, sem modelo visivel.

Perda de foco ou aba oculta limpa as teclas e pausa. Retornar a aba nao retoma
sozinho: clique em CONTINUAR. Falhas de Pointer Lock sao informadas, sem ativar
movimento antes da captura. Navegador desktop com mouse e teclado e necessario;
nao foram adicionados controles touch. EXPLORAR ARENA continua sem equipamento
ou dano; para combate local, selecione JOGAR (bots) ou TREINAMENTO (hologramas).

No modo dev, Debug do jogador exibe FPS amostrado, XYZ, velocidade, estado de
chao/ar, FOV, camera, draw calls, geometrias e recuperacoes de queda. Atualiza
no maximo quatro vezes por segundo durante a cena, mais as transicoes de controle.
Esse controle e seus dados nao aparecem no build de producao.
Na sessao contra bots, o diagnostico tambem inclui quantidade, poses e estados
da IA. Ele fica acima dos indicadores de vida/municao e e ocultado pelo placar.

## Inspecionar o mapa (Etapa 3)

1. Abra http://localhost:5173, selecione JOGAR e VER MAPA.
2. Arraste com o mouse para orbitar e use a roda para aproximar/afastar.
3. Selecione uma vista geral, setor ou SPAWN 01-08 no seletor Vista.
4. O botao de seta circular restaura a vista selecionada; Spawns mostra/oculta
   os marcadores. ESC ou a seta de voltar retorna a JOGAR, mantendo suas escolhas.
5. Em desenvolvimento, Colisores exibe as linhas reais do mundo Rapier. Esse
   controle e o contador DEBUG nao existem no build de producao.

A arena mede 48 x 40 metros. Possui um piso continuo, quatro paredes externas,
corredores laterais ligados no centro e pelas extremidades, duas plataformas a
3 metros com rampas de 8 metros de comprimento, seis coberturas e oito spawns.
Todos os 19 solidos visiveis usam as mesmas medidas e orientacao na fisica.
Faixas, nomes dos setores e marcadores sao decorativos e nao bloqueiam movimento.

A camera de VER MAPA continua sendo de inspecao: nao usa WASD ou Pointer Lock.
EXPLORAR ARENA usa o controlador FPS da Etapa 4 e os mesmos colisores. Os spawns
estao livres de geometria. A sessao contra bots usa esses pontos na selecao
por distancia e visibilidade descrita na secao da Etapa 7.

## Configuracoes

- VIDEO: resolucao interna Nativa/1920x1080/1600x900/1280x720, qualidade,
  fullscreen, sombras, FPS 30/60/120/sem limite e FOV 60-110.
- AUDIO: volumes geral, efeitos, musica, interface e passos de 0 a 100.
- CONTROLES: sensibilidade de 0.1 a 3 e consulta das teclas previstas.
- JOGABILIDADE: head bob e preferencia para reapresentar o tutorial.

Resolucao, qualidade e limite de FPS afetam a cena atual sem remontar o renderer.
A resolucao selecionada e um teto de pixels, preservando o aspecto da janela;
qualidade Baixa limita pixel ratio a 0.75, Media a 1 e Alta a 1.5, respeitando
o dispositivo. O FPS efetivo tambem depende do monitor e desempenho da maquina.
Fullscreen entra/sai por clique e acompanha o estado real do navegador.

Sombras agora afetam o mapa: uma luz direcional com shadow map 1024 x 1024,
desativada na qualidade Baixa ou ao desligar Sombras. A iluminacao e estatica.
FOV, sensibilidade e head bob agora afetam a camera FPS. O head bob e discreto,
somente ao andar/correr no chao, e tambem respeita prefers-reduced-motion.
Volume geral e Efeitos controlam os sons sinteticos provisorios do combate local:
disparo, recarga, acerto, dano, eliminacao e respawn. O audio so e ativado
por gesto do jogador; se indisponivel, o combate continua silenciosamente.
Musica, Interface e Passos ficam salvos, mas ainda nao possuem fontes sonoras.
A camera de inspecao tem enquadramento proprio, independente do FOV FPS.
A preferencia do tutorial permanece salva; a tela automatica de tutorial ainda
e pendente para o polimento. Nao ha remapeamento de teclas nesta etapa.

Preferencias usam `neon-strike:preferences:v1` no localStorage, sem dados sensiveis.
Cada origem/porta do navegador possui seu armazenamento: 5173 e 3000 nao
compartilham configuracoes. JSON invalido usa padroes; se o armazenamento estiver
bloqueado, as alteracoes continuam funcionando na sessao com aviso visivel.
Restaurar padroes pede confirmacao e mantem nome do jogador, mapa, bots e dificuldade.

## Acesso pela rede local agora

Menus, exploracao, treinamento e bots continuam locais. MULTIPLAYER usa salas
isoladas de NEON FACILITY com movimento, combate e partida FFA autoritativos.

### Host em desenvolvimento

1. Execute `npm run dev` no computador HOST.
2. Use `ipconfig` e encontre o IPv4 do adaptador Wi-Fi/Ethernet da rede local.
   Ignore adaptadores desconectados, VPNs e interfaces virtuais.
3. No outro computador, abra `http://IP_DO_HOST:5173`.
4. Confirme a cena e o indicador `Servidor online`.
5. No HOST, abra MULTIPLAYER > CRIAR PARTIDA. Preencha nome do jogador, nome da
   sala, mapa, modo, limite 2-8 e Exigir jogadores prontos; CRIAR SERVIDOR/SALA.
6. No lobby, COPIAR ENDERECO inclui a URL do backend e o codigo da sala.
   Se houver varias interfaces, escolha a correspondente a rede Wi-Fi/Ethernet.
7. No convidado, abra MULTIPLAYER > ENTRAR EM PARTIDA e cole esse endereco.
   Ou mantenha `http://IP_DO_HOST:5173` e informe o codigo da sala separadamente.
   Sem codigo, CONECTAR entra somente quando existe uma unica sala no servidor.
8. O convidado marca PRONTO. O host inicia quando houver pelo menos dois
   conectados e todos prontos (se exigido). ENTRAR NA ARENA captura o mouse.
   WASD/mouse, Espaco, Shift, clique, R e 1/2/3; TAB abre o placar.

O frontend encaminha `/api` e `/socket.io` (WebSocket) ao backend no host.
Usando o endereco sugerido, apenas **TCP 5173** precisa estar acessivel ao cliente.
O endereco copiado pelo lobby usa **TCP 3000**, que tambem precisa estar
acessivel se for usado diretamente no formulario. Alternativa: frontend 5173
mais codigo da sala, pelo proxy. Nao existe porta UDP adicional.
Os processos escutam em `0.0.0.0`; isso inclui todas as interfaces IPv4.

### Host com build, um unico endereco

Encerre o dev para liberar 3000 e execute:

```sh
npm run build
npm start
```

No outro computador, abra **http://IP_DO_HOST:3000**. O Express entrega
`client/dist`, `/api/health` e Socket.IO na mesma origem. Apenas **TCP 3000** e necessario.
Frontend e backend continuam separados no codigo; Vite nao participa deste modo.
No host: MULTIPLAYER > CRIAR PARTIDA; no convidado: ENTRAR EM PARTIDA > CONECTAR.
Depois PRONTO > INICIAR PARTIDA > ENTRAR NA ARENA. O host tambem precisa de navegador.
O botao do menu nao inicia um processo Node: `npm start` precisa estar rodando.

O servidor imprime enderecos LAN candidatos na inicializacao. Confirme o IP
correto se houver varias placas. Nao e possivel comprovar uma segunda maquina
apenas com dois navegadores locais; essa verificacao real esta pendente.

Se houver bloqueio, confira isolamento de clientes no roteador e permissao de
entrada do Windows Defender Firewall para Node/porta correspondente no perfil
de rede privada. **Nenhuma regra de firewall e alterada automaticamente.**
Nao e necessario abrir portas no roteador para uma LAN.

### Verificar sincronizacao e conexao

1. Confirme dois jogadores no HUD/TAB. Os spawns sao diferentes; atravesse os
   corredores ou a passagem central para encontrar o outro avatar identificado.
2. Um jogador anda, corre, pula e gira. O outro deve ver seu movimento e orientacao.
3. Abra ESC em um cliente: MENU LOCAL. O outro continua andando; o servidor nao pausa.
4. DESCONECTAR/SAIR DA SALA remove o convidado. Se for o host, sua sala encerra
   e os demais veem SALA ENCERRADA. Outras salas nao sao afetadas.
5. Uma queda breve mostra CONEXAO PERDIDA / TENTANDO RECONECTAR. O servidor reserva
   o ID por dez segundos; a retomada exige novo clique em CONTINUAR, sem capturar
   o mouse automaticamente. Quatro tentativas falhas levam a SERVIDOR INDISPONIVEL.
6. Encerrar Node perde todas as sessoes. Reinicie e conecte novamente pelo menu.
   Fechar o navegador nao encerra Node. Se era o host da sala, a sala encerra
   apos a deteccao da queda e a janela de retomada de dez segundos. Nao ha migracao.

Se a conexao antiga ainda aguarda timeout no servidor, ha ate tres tentativas
adicionais de retomada, espacadas em um segundo, sem criar outro jogador.

O servidor rejeita versao incompatível, nome invalido, lotacao de oito jogadores,
sequencias duplicadas, payloads invalidos e spam. Falha inicial de endereco/conexao
mostra SERVIDOR NAO ENCONTRADO. Tambem informa SALA NAO ENCONTRADA, SALA CHEIA,
PARTIDA JA INICIADA, VERSAO INCOMPATIVEL e limite global de salas.
Nomes nao sao unicos nem autenticados; use somente rede privada confiavel.
Credencial de retomada fica apenas em memoria e nunca em localStorage/URL.
HTTP/WS nao criptografa o trafego LAN. Nao exponha esse servidor na Internet.

### Combate LAN (Etapa 10)

1. Todos aguardam no lobby, sem movimento ou disparos. O host inicia a partida.
2. O servidor inicia 3, 2, 1 e libera o FFA. Durante a contagem, movimento/disparos
   ficam bloqueados. Clique em ENTRAR NA ARENA.
3. Use clique esquerdo, R, 1/2/3 e mira secundaria do ARC-9. Municao, cadencia,
   dispersao, alcance, paredes e dano sao resolvidos pelo servidor, nao pelo HUD.
4. Cada eliminacao vale 100 pontos. A vitima retorna em tres segundos, com vida
   e municao restauradas, em um spawn selecionado por distancia/visibilidade.
5. ESC e troca de aba nao pausam a partida, recarga ou respawn. Um jogador no
   menu local continua vulneravel; nao use a pausa como protecao.
6. Dez minutos ou 30 eliminacoes encerram a partida. Os resultados sao comuns
   aos clientes, com posicao, precisao e tempo; o mouse e liberado.
7. Ao terminar, VOLTAR AO LOBBY retorna a sala para todos; o servidor tambem faz
   isso automaticamente apos 15 segundos. A prontidao e zerada e so o host pode
   iniciar outra rodada. Nenhum cliente pode interromper uma partida em andamento.

Existem ate quatro salas por servidor. Novas entradas sao recusadas durante a
partida e o resultado; participantes ja registrados podem retomar uma queda breve.
Reconexao preserva vida, municao e pontuacao, mas limpa a prontidao no lobby.
Nao ha bots online. O protocolo e versao 3:
cliente e servidor antigos precisam ser atualizados juntos.
Disparos usam a posicao atual no servidor, sem rewind de latencia. Efeitos/sons
sao confirmados pelo servidor, portanto o atraso fica perceptivel em conexoes lentas.

## Jogar contra bots (Etapa 7)

1. Abra JOGAR e configure nome, NEON FACILITY, 1-7 bots e dificuldade.
2. Clique em INICIAR PARTIDA; depois, ENTRAR NA ARENA para capturar o mouse.
3. Todos contra todos: os bots enfrentam voce e os outros bots. Cada eliminacao
   vale 100 pontos. Segure TAB para consultar o placar; BOT identifica IA, nao ping.
4. Vida padrao de 100 HP, tres equipamentos com municao finita e recarga.
   Bots comecam com NX-7 e usam o mesmo inventario; mudam equipamento se esgotado.
5. Eliminacao digital e respawn em 3 s. A selecao de spawn prioriza distancia
   e cobertura visual em relacao aos adversarios vivos, sem teleporte de navegacao.
6. ESC pausa todos os atores, recarga, respawn e relogio. REINICIAR restaura
   vida/municao, posicoes iniciais e todas as estatisticas. VOLTAR AO MENU encerra.

| Dificuldade | Reacao minima | Movimento | Erro de mira adicional |
| --- | --- | --- | --- |
| Facil | 0.90 s | Mais lento, sem strafe de combate | Maior |
| Normal | 0.50 s | Patrulha e deslocamento lateral | Moderado |
| Dificil | 0.30 s | Mais rapido, deslocamento lateral | Menor, nunca perfeito |

Bots usam A* sobre pontos com margem de colisao e apoio, gerados a partir do
mapa fisico. Corredores e rampas conectam os setores. Paredes bloqueiam visao e
disparos; ao perder um alvo, buscam sua ultima posicao vista por ate 3 s antes
de patrulhar novamente. Percepcao a 10 Hz e revisao de destino a ate 2 Hz;
fisica a 60 Hz. Nao ha perseguicao onisciente atraves das paredes.

Desde a Etapa 8, JOGAR possui contagem inicial e final automatico; o HUD mostra
TEMPO RESTANTE. Regras e resultados estao descritos abaixo.
Treinamento conserva os quatro hologramas e o campo ambiental; esses elementos
nao existem na sessao contra bots. O servidor HTTP nao simula os bots.

## Partidas FFA (Etapa 8)

1. Depois de ENTRAR NA ARENA, aguarde 3, 2, 1, GO! Movimento, combate e IA
   ficam bloqueados por tres segundos. Olhar e consultar TAB continuam possiveis.
   Acoes pressionadas durante a contagem nao ficam enfileiradas para o inicio.
2. A partida termina quando alguem atinge 30 eliminacoes ou depois de dez
   minutos de simulacao ativa, o que ocorrer primeiro. Cada eliminacao vale 100.
3. ESC/perda de foco pausa tambem a contagem inicial, tempo, IA e respawns.
   CONTINUAR retoma do mesmo ponto; REINICIAR zera a partida e repete a contagem.
4. Ao terminar, o mouse e liberado e toda simulacao de combate e congelada.
   VITORIA/DERROTA mostra posicao, eliminacoes, derrotas, pontuacao, precisao,
   tempo da partida e o placar de todos os participantes.
5. JOGAR NOVAMENTE reutiliza mapa/bots/dificuldade com todos os estados zerados.
   MENU PRINCIPAL encerra a sessao e libera os recursos. Partidas offline nao
   possuem lobby; VOLTAR AO LOBBY pertence ao multiplayer.

Desempate: pontuacao, eliminacoes, menos derrotas e ID estavel, nessa ordem,
igual ao TAB. Isso tambem decide partidas sem eliminacoes; nao ha prorrogacao.
Se a ultima eliminacao ocorrer no tick do limite de tempo, o motivo registrado
e o limite de eliminacoes. O resultado nao muda depois do encerramento.
Precisao e a porcentagem de projeteis que causaram dano em adversarios; cada
pulso do VX Scatter conta separadamente. Sem disparos, exibe 0%.

Testes de regras verificam os 36000 ticks reais do limite padrao. Para testar
o ciclo completo no navegador sem esperar dez minutos por caso, uma entrada
isolada em `tests/fixtures/match.html` usa a mesma cena/simulacao com limites
curtos. Ela nao e importada pela aplicacao nem incluida no build. Nenhuma URL
ou preferencia da aplicacao permite alterar os limites de producao.

| Acao | Controle |
| --- | --- |
| Mover / olhar | WASD / mouse |
| Pular / correr | Espaco / Shift |
| Disparar / mira secundaria ARC-9 | Clique esquerdo / direito |
| Recarregar / equipamento | R / 1, 2, 3 |
| Placar / pausa | Segurar TAB / ESC |

## Organizacao

`client` contem React, renderer e acesso HTTP/Socket.IO. `server` contem Express,
rede e simulacao autoritativa. `shared` contem versao, contratos, dados do mapa e fabrica
do mundo fisico sem depender do DOM ou da renderizacao.
No cliente, `ui` organiza telas e controles; `settings` organiza validacao,
persistencia e fullscreen. A navegacao fica em `app` e HTTP em `network`.
`client/src/maps` cria meshes, camera de inspecao, luz e descarte dos recursos;
`shared/src/maps` define solidos/spawns e a geometria das rampas;
`shared/src/physics` instancia os colisores com Rapier. `shared/src/simulation`
contem movimento e passo fixo, sem DOM/Three. `client/src/game/player` contem
InputManager, camera e executor local. Dados, fisica e simulacao usam subpaths
separados; o motor so carrega ao abrir inspecao, exploracao, treinamento, bots ou LAN.
`shared/src/gameplay` contem catalogo, inventario, vida, layout dos alvos e
executor local de treinamento, sem Three/DOM. `client/src/game/combat` adapta
eventos para modelos 3D e pools; `client/src/audio` controla sons sinteticos.
`CombatReadout` recebe snapshots limitados a 10 Hz, sem simular combate no React.
`client/src/ui/hud` separa resumo, feed e tabela. `TrainingStats` conserva tempo,
estatisticas e eventos limitados na simulacao. `@neon-strike/shared/hud` exporta
tipos, ordenacao e formatacao sem importar o motor fisico para o menu.
`shared/src/bots` contem navegacao, percepcao, estados, respawn e sessao FFA local.
O adaptador de combate tambem renderiza bots e compartilha audio/efeitos/HUD,
sem misturar a IA com componentes React. Geometrias/materiais sao reutilizados.
`shared/src/match` organiza regras FFA, relogios e resultado imutavel sem DOM,
Three ou Rapier. `BotSession` aplica a politica quando configurada; o executor
da aplicacao sempre usa FFA padrao. `client/src/ui/match` exibe o resultado.
`shared/src/network` define eventos, validadores e buffer de interpolacao.
`server/src/network` possui MovementArena, limites e transporte Socket.IO.
`client/src/network/NetworkManager` e o unico dono do socket; `game/network`
reconcilia o jogador e renderiza avatares. A UI recebe dados limitados a 10 Hz.
`docs` registra arquitetura e criterios das 14 etapas. `tests/browser` valida a
interface e cenas; `server/test` cobre HTTP/rede e `shared/test` cobre contratos e simulacao.

- [Arquitetura, dependencias e riscos](docs/ARCHITECTURE.md)
- [Checklist das etapas e do MVP](docs/CHECKLIST.md)
- [Registro da Etapa 1](docs/STAGE-1.md)
- [Registro da Etapa 2](docs/STAGE-2.md)
- [Registro da Etapa 3](docs/STAGE-3.md)
- [Registro da Etapa 4](docs/STAGE-4.md)
- [Registro da Etapa 5](docs/STAGE-5.md)
- [Registro da Etapa 6](docs/STAGE-6.md)
- [Registro da Etapa 7](docs/STAGE-7.md)
- [Registro da Etapa 8](docs/STAGE-8.md)
- [Registro da Etapa 9](docs/STAGE-9.md)
- [Registro da Etapa 10](docs/STAGE-10.md)
- [Registro da Etapa 11](docs/STAGE-11.md)

## Problemas conhecidos

- Partidas locais FFA, combate e lobby LAN implementados; Etapas 12-14 estao pendentes.
  Alvos estaticos do treinamento nao sao bots e o treinamento nao termina sozinho.
- LAN possui ate quatro salas por processo e oito vagas por sala. Avatares nao
  bloqueiam fisicamente outros jogadores nesta etapa; colisoes com o mapa sao
  autoritativas. Sem bots online, chat, senha ou autenticacao de nomes.
- Interpolacao remota adiciona 100 ms; extrapolacao limitada a 33 ms. Latencia alta,
  quedas longas ou maquina sobrecarregada podem causar correcoes visiveis. Fila de
  inputs excessiva e recusada; nao ha promessa de desempenho WAN ou anti-cheat completo.
- O spawn fixo do treinamento foi preservado. Contra bots, o spawn e escolhido
  por distancia/visibilidade, mas uma arena ocupada pode nao oferecer cobertura
  completa. Nao existe invulnerabilidade artificial de respawn.
- Navegacao atual pressupoe uma superficie caminhavel por coordenada XZ e foi
  validada em NEON FACILITY; mapas futuros com pontes/sobreposicoes exigem navmesh.
  IA e inicial: sem salto tatico, retirada, coordenacao ou aprendizado.
- Modelos e audio dos bots sao provisorios. Sons proximos usam o sintetizador
  atual, ainda sem audio 3D espacial ou sons de passos.
- Equipamentos, efeitos e sons sao provisorios. Tutorial automatico, agachamento,
  remapeamento e tratamento visual refinado de equipamento junto as paredes
  permanecem pendentes; os controles estao no README e em CONFIGURACOES.
- GPU sem WebGL 2 exige hardware/navegador compativel; ha mensagem de fallback.
- Se o contexto grafico se perder, recarregue a pagina para reinicializar.
- Apos muitas entradas/saidas rapidas, o navegador pode limitar novas capturas
  do mouse. A mensagem informa a recusa: aguarde alguns segundos e clique
  novamente em ENTRAR NA ARENA ou CONTINUAR. Nao ha recaptura automatica.
- Servidor desligado nao impede modos locais; health e reavaliado a cada 5 segundos.
  Arena LAN exige servidor ativo e mostra falhas/retomada na propria tela.
- Portas ocupadas causam erro explicito. O processo nao encerra programas alheios
  nem troca silenciosamente a porta. Configure SERVER_PORT/CLIENT_PORT na raiz.
  Se definir API_PROXY_TARGET, ajuste-o tambem ao mudar a porta do backend.
- O build servido pelo Express so se atualiza apos novo `npm run build`.
- Interface, Three.js, visualizador, controlador e fisica carregam em bundles
  separados. O motor Three.js tem aproximadamente 550 kB / 137 kB gzip;
  Rapier com WASM, aproximadamente 2048 kB / 762 kB gzip.
  A fisica nao e baixada no menu; a primeira abertura do mapa pode levar mais
  tempo e mostra CARREGANDO MAPA. O Vite avisa sobre os chunks acima de 500 kB.
  Medicao de FPS, memoria e orcamentos completos permanece na etapa de otimizacao.
- Nenhum teste em dois computadores fisicos foi realizado nesta etapa.
- Vite de desenvolvimento e acesso LAN nao sao uma publicacao em servidor publico.

## Creditos e licencas

Projeto independente desenvolvido com tecnologias web. A geometria inicial e
criada no codigo; nao usa modelos ou audio de terceiros. Icones usam Lucide
(ISC). Audio sintetico original e provisorio via Web Audio API. Licencas estao em
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md); os textos originais acompanham
os respectivos pacotes em node_modules. Nenhuma licenca do codigo autoral do
projeto foi escolhida em nome do autor.
