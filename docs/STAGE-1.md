# Etapa 1 - fundacao

Data: 13/09/2026. Escopo: somente a Etapa 1 do documento original.
Status: fundacao implementada e validada. Etapa 2 nao iniciada.

## Resultado

- Monorepo npm com `client`, `server` e `shared`, TypeScript estrito e ESM.
- React/Vite iniciando uma cena minima de verificacao com Three.js.
- Canvas responsivo com animacao, recursos compartilhados e limpeza no unmount.
- Camadas explicitas para preservar a interface sobre o canvas WebGL.
- Respeito a reduced motion e interrupcao do loop quando a aba fica oculta.
- Express separado, `GET /api/health`, contrato e versao compartilhados.
- Cliente com health via proxy, timeout, cancelamento e rechecagem a cada 5 s.
- Estados visiveis para backend indisponivel, protocolo incompatível e falta de WebGL.
- Scripts conjuntos/separados, watch do shared e reinicio do backend.
- Build estatico servido pelo Express, sem Vite, na mesma porta da API.
- Configuracao opcional na raiz, portas explicitas e logs com candidatos de IP LAN.
- README, arquitetura, dependencias/licencas e checklist das 14 etapas.

Nao ha mapa, jogador, armas, bots, menu de jogo, sockets, salas ou partidas.
O indicador de servidor confirma HTTP e protocolo, nao uma conexao multiplayer.

## Verificacoes

Ambiente: Windows, Node 24.15.0, npm 12.0.2, Google Chrome instalado.

| Verificacao | Resultado |
| --- | --- |
| `npm install` | 141 pacotes adicionados; 145 auditados; 0 vulnerabilidades informadas pelo npm |
| `npm run check` | Compilacao TypeScript/Vite e 6 testes do Node aprovados |
| `npm run test:e2e` com PLAYWRIGHT_CHANNEL=chrome | 6 testes aprovados apos os ajustes visuais |
| `npm run test:build` com PLAYWRIGHT_CHANNEL=chrome | Build e teste de navegador do servidor compilado aprovados |
| Capturas 1440x900 e 390x844 | Cena enquadrada, titulo/HUD da fundacao visiveis, sem cortes laterais |
| Pixels | Cena nao vazia, animacao entre quadros e titulo efetivamente desenhado |
| `npm run dev` | Vite e Express iniciados; shared em watch com zero erros |
| `http://localhost:5173` | HTTP 200 |
| `http://localhost:5173/api/health` | HTTP 200, servico e versao corretos via proxy |
| `http://localhost:3000/api/health` | HTTP 200 no backend independente |
| Watch do shared | Logs confirmaram reinicio do tsx apos emissao dos arquivos compartilhados |

Os 6 testes Node cobrem contrato/health/cache, rotas e metodos desconhecidos,
servidor sem build, cliente compilado e API coexistindo, configuracao de portas
e respostas malformadas. Os 6 testes E2E cobrem os dois tamanhos de tela,
backend indisponivel/recuperado, protocolo incompatível, falta de WebGL e reload/resize.
O teste de build abre a interface compilada via Express, verifica renderizacao,
API e ausencia do cliente de desenvolvimento Vite. Total: 13 testes.

## Ajustes encontrados durante a validacao

- Sandbox Windows impediu `tsx` de consultar o usuario do sistema
  (`uv_os_get_passwd returned ENOMEM`). Reexecutado fora dessa restricao; suite
  passou. Nao foi necessario modificar a logica da aplicacao para esse ambiente.
- Aspas do caminho `--include` do tsx ajustadas para funcionar com cmd/PowerShell.
- Enquadramento da camera passou a considerar FOV e aspecto para nao cortar barras.
- Empilhamento do canvas e da UI tornado explicito; teste de pixels do titulo
  adicionado apos capturas mostrarem que a verificacao somente do DOM era insuficiente.

## Arquivos criados

```text
.env.example
.gitignore
.nvmrc
package.json
package-lock.json
tsconfig.base.json
playwright.config.ts
playwright.build.config.ts
README.md
THIRD_PARTY_NOTICES.md
client/package.json
client/tsconfig.json
client/vite.config.ts
client/index.html
client/src/main.tsx
client/src/app/App.tsx
client/src/app/global.css
client/src/app/useServerStatus.ts
client/src/game/SceneViewport.tsx
client/src/game/rendering/createFoundationScene.ts
client/src/network/healthClient.ts
server/package.json
server/tsconfig.json
server/src/index.ts
server/src/config/environment.ts
server/src/http/app.ts
server/test/foundation.test.mjs
shared/package.json
shared/tsconfig.json
shared/src/index.ts
shared/src/protocol/health.ts
shared/src/protocol/version.ts
tests/browser/foundation.spec.ts
tests/build/smoke.spec.ts
docs/ARCHITECTURE.md
docs/CHECKLIST.md
docs/STAGE-1.md
```

Arquivos preexistentes alterados: nenhum, pois a pasta estava vazia.
Durante a validacao foram ajustados `server/package.json`, a camera, o CSS,
os testes, os scripts e a documentacao criados nesta etapa.
Saidas geradas e ignoradas: `node_modules`, `*/dist`, `test-results` e `.runtime`.

## Limites e proximo passo

- O Vite emite aviso de bundle inicial maior que 500 kB: cerca de 759 kB
  minificados / 203 kB gzip, incluindo React e Three.js. Aviso mantido visivel;
  carregamento separado do motor previsto com os menus e medicao na Etapa 13.
- npm 12 informou bloqueio do postinstall do esbuild; o binario opcional instalado
  foi suficiente para executar tsx e todos os testes. Nenhum script foi liberado globalmente.
- Capturas/execucao headless nao comprovam FPS ou memoria em computadores intermediarios.
- Somente HTTP local e build foram validados. Multiplayer e duas maquinas reais pendentes.
- Nenhuma regra de firewall foi alterada. Nao houve publicacao externa.
- Proxima etapa: menu principal, navegacao e configuracoes basicas, preservando esta base.

Para executar novamente: `npm run dev`. Para verificar: `npm run check` e os
testes Playwright descritos no README. Os logs da sessao de desenvolvimento
deixada ativa ficam em `.runtime/dev.stdout.log` e `.runtime/dev.stderr.log`.
