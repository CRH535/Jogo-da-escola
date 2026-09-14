# Dependencias de terceiros

Esta lista nao atribui uma licenca ao codigo autoral de NEON STRIKE.

| Dependencia direta | Licenca | Uso |
| --- | --- | --- |
| React e React DOM | MIT | Cliente |
| Three.js | MIT | Cliente |
| @dimforge/rapier3d-compat | Apache-2.0 | Colisores compartilhados e testes de fisica |
| ngraph.graph | BSD-3-Clause | Grafo navegavel dos bots |
| ngraph.path | MIT | Busca A* dos bots |
| lucide-react | ISC | Icones da interface |
| Express | MIT | Servidor |
| Vite e @vitejs/plugin-react | MIT | Ferramentas |
| TypeScript | Apache-2.0 | Ferramentas |
| tsx | MIT | Ferramentas |
| concurrently | MIT | Ferramentas |
| @playwright/test | Apache-2.0 | Testes |
| pngjs | MIT | Testes |
| @types/* (DefinitelyTyped) | MIT | Tipos |

Versoes resolvidas e dependencias transitivas: `package-lock.json`.
Textos de copyright/licenca: arquivos LICENSE ou equivalentes dentro de cada
pacote instalado. Preservar os avisos exigidos ao redistribuir dependencias.
Nao ha assets externos, audio protegido ou conteudo baixado de CDNs.

Na Etapa 5, modelos de equipamentos, hologramas, labels e particulas sao
geometria/texturas originais criadas em codigo. Os sons sao placeholders
originais sintetizados com osciladores da Web Audio API, sem samples externos.
Nenhuma biblioteca nova foi adicionada para combate ou audio.

Na Etapa 7, ngraph.graph 20.1.2 e ngraph.path 1.6.1 fornecem o grafo e A*.
ngraph.events e uma dependencia transitiva BSD-3-Clause. Os modelos dos bots, visores,
animacao de passos e texturas de identificacao sao originais, criados em codigo.
