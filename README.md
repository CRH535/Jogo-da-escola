# NEON STRIKE

FPS de arena futurista para navegador desktop, com partidas rapidas e efeitos
digitais sem violencia grafica. Projeto em desenvolvimento incremental.

**Estado atual: Etapa 4 - controlador FPS.** JOGAR > EXPLORAR ARENA abre a
NEON FACILITY em primeira pessoa, com mouse, WASD, corrida, pulo e colisoes.
Menus, inspecao do mapa, preferencias e backend HTTP foram preservados.
Ainda nao ha combate, armas, vida, bots, placar, lobby ou multiplayer.

JOGAR, MULTIPLAYER, TREINAMENTO, CONFIGURACOES, CREDITOS e SAIR abrem suas telas.
O menu JOGAR salva nome, mapa, 1-7 bots e dificuldade. Botoes de iniciar partida,
treinamento e criar/entrar em salas ficam desabilitados ate as etapas correspondentes.

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
| `npm run check` | Build e testes HTTP/configuracao/contrato/mapa/fisica |
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
Isso nao constitui benchmark de GPU nem teste de combate ou gameplay touch.

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
nao foram adicionados controles touch. O pequeno ponto central e so referencia
visual, ainda nao ha equipamento ou disparo.

No modo dev, Debug do jogador exibe FPS amostrado, XYZ, velocidade, estado de
chao/ar, FOV, camera, draw calls, geometrias e recuperacoes de queda. Atualiza
no maximo quatro vezes por segundo durante a cena, mais as transicoes de controle.
Esse controle e seus dados nao aparecem no build de producao.

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
estao livres de geometria, mas selecao segura em relacao a adversarios vem no respawn.

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
Volumes permanecem preparados para o futuro sistema de audio. A camera de
inspecao tem enquadramento proprio, independente do FOV FPS.
O tutorial esta agendado para a primeira partida; a tela de tutorial sera
implementada junto ao fluxo jogavel. Nao ha remapeamento de teclas nesta etapa.

Preferencias usam `neon-strike:preferences:v1` no localStorage, sem dados sensiveis.
Cada origem/porta do navegador possui seu armazenamento: 5173 e 3000 nao
compartilham configuracoes. JSON invalido usa padroes; se o armazenamento estiver
bloqueado, as alteracoes continuam funcionando na sessao com aviso visivel.
Restaurar padroes pede confirmacao e mantem nome do jogador, mapa, bots e dificuldade.

## Acesso pela rede local agora

Este procedimento entrega menus e exploracao local; jogadores nao sao sincronizados.

### Host em desenvolvimento

1. Execute `npm run dev` no computador HOST.
2. Use `ipconfig` e encontre o IPv4 do adaptador Wi-Fi/Ethernet da rede local.
   Ignore adaptadores desconectados, VPNs e interfaces virtuais.
3. No outro computador, abra `http://IP_DO_HOST:5173`.
4. Confirme a cena e o indicador `Servidor online`.

O frontend encaminha `/api` ao backend no host. Para abrir a interface e seu
health por proxy, apenas **TCP 5173** precisa estar acessivel ao cliente.
Para acessar a API diretamente, permita tambem **TCP 3000**.
Os processos escutam em `0.0.0.0`; isso inclui todas as interfaces IPv4.

### Host com build, um unico endereco

Encerre o dev para liberar 3000 e execute:

```sh
npm run build
npm start
```

No outro computador, abra **http://IP_DO_HOST:3000**. O Express entrega
`client/dist` e `/api/health` na mesma origem. Apenas **TCP 3000** e necessario.
Frontend e backend continuam separados no codigo; Vite nao participa deste modo.

O servidor imprime enderecos LAN candidatos na inicializacao. Confirme o IP
correto se houver varias placas. Nao e possivel comprovar uma segunda maquina
apenas com dois navegadores locais; essa verificacao real esta pendente.

Se houver bloqueio, confira isolamento de clientes no roteador e permissao de
entrada do Windows Defender Firewall para Node/porta correspondente no perfil
de rede privada. **Nenhuma regra de firewall e alterada automaticamente.**
Nao e necessario abrir portas no roteador para uma LAN.

### Multiplayer planejado

Nas Etapas 9-11, o HOST iniciara o servidor Node, criara uma sala no menu e
os convidados usarao ENTRAR EM PARTIDA com `http://IP_DO_HOST:3000`.
Socket.IO usara a porta TCP do servidor, sem uma porta UDP adicional.
Salas, estados de pronto, combate e reconexao ainda nao existem nesta versao.
O guia sera atualizado com o fluxo efetivamente validado quando forem implementados.

## Combate offline planejado

Na etapa jogavel: JOGAR > PARTIDA CONTRA BOTS > NEON FACILITY, escolher 1-7 bots,
dificuldade Facil/Normal/Dificil e INICIAR PARTIDA. Treinamento tera alvos locais.
O modo offline rodara a simulacao local, independentemente do servidor de partida.
Atualmente essa configuracao pode ser salva no menu, mas iniciar esta bloqueado.

| Acao | Controle |
| --- | --- |
| Mover / olhar | WASD / mouse |
| Pular / correr | Espaco / Shift |
| Disparar / mira secundaria (futuro) | Clique esquerdo / direito |
| Recarregar / equipamento (futuro) | R / 1, 2, 3 |
| Placar (futuro) / pausa atual | TAB / ESC |

## Organizacao

`client` contem React, renderer e acesso HTTP. `server` contem Express e
configuracao. `shared` contem versao, contrato de health, dados do mapa e fabrica
do mundo fisico sem depender do DOM ou da renderizacao.
No cliente, `ui` organiza telas e controles; `settings` organiza validacao,
persistencia e fullscreen. A navegacao fica em `app` e HTTP em `network`.
`client/src/maps` cria meshes, camera de inspecao, luz e descarte dos recursos;
`shared/src/maps` define solidos/spawns e a geometria das rampas;
`shared/src/physics` instancia os colisores com Rapier. `shared/src/simulation`
contem movimento e passo fixo, sem DOM/Three. `client/src/game/player` contem
InputManager, camera e executor local. Dados, fisica e simulacao usam subpaths
separados; o motor so carrega ao abrir a inspecao ou a exploracao.
`docs` registra arquitetura e criterios das 14 etapas. `tests/browser` valida a
interface e o mapa; `server/test` cobre HTTP e `shared/test` cobre mapa/fisica/movimento.

- [Arquitetura, dependencias e riscos](docs/ARCHITECTURE.md)
- [Checklist das etapas e do MVP](docs/CHECKLIST.md)
- [Registro da Etapa 1](docs/STAGE-1.md)
- [Registro da Etapa 2](docs/STAGE-2.md)
- [Registro da Etapa 3](docs/STAGE-3.md)
- [Registro da Etapa 4](docs/STAGE-4.md)

## Problemas conhecidos

- Ja e possivel explorar em primeira pessoa, mas nao disputar partidas.
  Nao foram iniciadas as Etapas 5-14.
- GPU sem WebGL 2 exige hardware/navegador compativel; ha mensagem de fallback.
- Se o contexto grafico se perder, recarregue a pagina para reinicializar.
- Servidor desligado nao impede a cena; status e reavaliado a cada 5 segundos.
- Portas ocupadas causam erro explicito. O processo nao encerra programas alheios
  nem troca silenciosamente a porta. Configure SERVER_PORT/CLIENT_PORT na raiz.
  Se definir API_PROXY_TARGET, ajuste-o tambem ao mudar a porta do backend.
- O build servido pelo Express so se atualiza apos novo `npm run build`.
- Interface, Three.js, visualizador, controlador e fisica carregam em bundles
  separados. O motor Three.js tem aproximadamente 538 kB / 134 kB gzip;
  Rapier com WASM, aproximadamente 2048 kB / 762 kB gzip.
  A fisica nao e baixada no menu; a primeira abertura do mapa pode levar mais
  tempo e mostra CARREGANDO MAPA. O Vite avisa sobre os chunks acima de 500 kB.
  Medicao de FPS, memoria e orcamentos completos permanece na etapa de otimizacao.
- Nenhum teste em dois computadores fisicos foi realizado nesta etapa.
- Vite de desenvolvimento e acesso LAN nao sao uma publicacao em servidor publico.

## Creditos e licencas

Projeto independente desenvolvido com tecnologias web. A geometria inicial e
criada no codigo; nao usa modelos ou audio de terceiros. Icones usam Lucide
(ISC). Nao ha audio nesta etapa. Licencas das dependencias e ferramentas estao em
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md); os textos originais acompanham
os respectivos pacotes em node_modules. Nenhuma licenca do codigo autoral do
projeto foi escolhida em nome do autor.
