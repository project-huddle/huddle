# ADR-009 — Vertical Slices com Functional Core e Imperative Shell

Status: Aceita — 21/08/2026

## Contexto

O back-end já possui separação entre `core`, `app`, `infra` e `interfaces`, mas a organização principalmente horizontal dificulta acompanhar operações completas como entrada em um servidor, criação de convite e envio de mensagem. Uma única operação pode exigir navegar por vários módulos separados apenas pela função técnica.

Foi considerada a introdução de Controllers como uma fachada HTTP. Em muitos casos isso criaria apenas a sequência artificial `route → controller → use case`, sem acrescentar comportamento ou significado arquitetural.

## Decisão

Organizar a camada de aplicação progressivamente por comportamento usando Vertical Slice Architecture. Cada slice pode conter o handler, seus ports, o adapter de transporte e testes proporcionais à complexidade da operação.

DDD continua responsável pelo modelo de domínio. Aggregates, entities, value objects, invariantes e transições não serão movidos automaticamente para dentro dos slices; conceitos compartilhados podem permanecer em `domain`.

Aplicar Functional Core / Imperative Shell: decisões de negócio devem ser determinísticas e independentes de banco, Prisma, HTTP, Elysia, WebSocket, filesystem, ambiente, relógio global e geração implícita de IDs. Carregamento, persistência, transações, publicação de eventos e integrações ficam nas bordas.

O domínio usará orientação a objetos seletivamente para objetos com identidade, invariantes e transições. Handlers e orquestração usarão funções e composição explícita quando não houver estado interno que justifique classes.

## Direção de dependências

```text
HTTP / realtime → feature handler → domain
                       │
                       └── ports ← infrastructure
```

O domínio não conhece frameworks ou infraestrutura. Features dependem do domínio e de ports. A infraestrutura implementa ports. O bootstrap conhece implementações concretas e realiza dependency injection manual. Não será introduzido container de DI, mediator, event bus genérico ou Controllers artificiais.

Elysia continua sendo somente um adapter de transporte. Rotas cuidam de schemas, autenticação de transporte, status, headers, serialização e chamada ao handler. Regras de negócio e persistência não pertencem às rotas.

## Consequências

O primeiro slice migrado é `join-server`, mantendo o contrato público existente. A migração será incremental: após validar o piloto, outros comportamentos poderão ser migrados individualmente. Durante a transição, fachadas antigas só serão removidas quando não possuírem consumidores reais.

O backend continuará sendo um monólito modular com PostgreSQL, Prisma, Bun e Elysia, conforme ADRs anteriores.
