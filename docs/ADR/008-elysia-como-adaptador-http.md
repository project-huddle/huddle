# ADR-008 — Elysia como framework de transporte HTTP e WebSocket

Status: Aceita — 20/08/2026

## Contexto

O back-end utilizava diretamente `Bun.serve`, `server.upgrade` e o handler WebSocket nativo. Uma primeira migração colocou Elysia somente diante do HTTP e preservou o transporte realtime nativo, criando dois modelos de lifecycle e composição. Essa solução híbrida foi rejeitada por aumentar a complexidade operacional e não representar uma adoção integral do framework.

Essa abordagem tem poucas dependências, mas aumenta o acoplamento do composition root ao transporte e dificulta evoluir validação, middlewares e documentação da API. A adoção de um framework não deve contaminar `core`, `app` ou `infra` com tipos específicos de transporte.

## Decisão

Adotar Elysia como único framework de transporte da aplicação. Bun continua sendo o runtime sobre o qual o próprio Elysia executa, mas o código da aplicação não instancia nem coordena diretamente o servidor nativo.

- `interfaces/http/application.ts` constrói a aplicação Elysia e concentra o lifecycle HTTP.
- Rate limiting é executado em `onRequest`.
- CORS e headers de segurança são aplicados em `onAfterHandle`.
- Erros não tratados são convertidos em resposta padronizada por `onError`.
- `runtime.ts` inicia a aplicação exclusivamente por `Elysia.listen()`.
- Casos de uso e repositórios continuam independentes de Elysia.
- `/ws` é registrado por `Elysia.ws()`, com query tipada, validação de origin e ticket em `beforeHandle` e callbacks de conexão, mensagem e encerramento gerenciados pelo framework.
- O gateway realtime usa `ElysiaWS` e mantém o estado de sessão em `WeakMap`; ele não depende de `Bun.ServerWebSocket` nem de campos mutáveis injetados durante `server.upgrade`.

A migração dos handlers HTTP é incremental: o dispatcher existente permanece atrás do adaptador durante a preservação dos contratos atuais. Novas rotas devem ser implementadas como plugins/handlers Elysia por feature, e não adicionadas ao dispatcher central.

## Alternativas consideradas

### Continuar apenas com `Bun.serve`

Rejeitada porque exigiria manter manualmente roteamento, lifecycle, composição de middlewares e futura geração de documentação.

### Hono

É pequeno e portátil entre runtimes, mas a portabilidade não é um requisito atual. Elysia possui integração mais direta com Bun e oferece schemas e inferência de tipos adequados para a evolução planejada da API.

### Elysia no HTTP e APIs nativas do Bun no WebSocket

Rejeitada após a primeira implementação. Embora funcional, mantém dois modelos de transporte, exige uma ponte manual no composition root e enfraquece a padronização de lifecycle e autenticação.

## Consequências

### Positivas

- O composition root deixa de implementar middleware HTTP.
- HTTP e WebSocket compartilham um único lifecycle de framework.
- O pipeline de transporte passa a ter lifecycle explícito.
- Rotas futuras podem usar parâmetros e schemas tipados do Elysia.
- O domínio continua testável sem framework.

### Negativas e riscos

- Uma dependência de framework passa a fazer parte do adaptador HTTP.
- Durante a migração dos handlers por feature, o dispatcher HTTP antigo ainda existe atrás da aplicação Elysia.
- A equipe precisa evitar importar tipos Elysia nas camadas `core`, `app` e `infra`.

## Critérios de conclusão da migração

- Cada conjunto de rotas deve virar um plugin por feature: autenticação, comunidades, mídia e mensagens.
- Validação de body, params e query deve usar schemas Elysia na borda.
- O dispatcher manual deve ser removido após os testes de contrato cobrirem os plugins.
