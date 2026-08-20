# ADR-001 — TypeScript e Bun no back-end

Status: Aceita — 20/08/2026

## Contexto

Cliente e servidor compartilham contratos JSON e regras suscetíveis a erros de forma. O servidor também depende de WebSocket, APIs Web e Argon2id.

## Decisão

Usar TypeScript estrito em ambas as camadas e Bun no runtime da API. Tipos de domínio não substituem validação de entrada; todo dado externo continua sendo validado em runtime.

## Consequências

Há uma linguagem comum no produto, typecheck rápido e APIs Web nativas. Bun permanece uma dependência operacional e os testes devem executar na mesma família de versão das imagens Docker.
