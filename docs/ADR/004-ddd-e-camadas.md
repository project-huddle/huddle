# ADR-004 — DDD pragmático e arquitetura em camadas

Status: Aceita — 20/08/2026

## Contexto

O back-end original concentrava HTTP, WebSocket, persistência e regras em poucos arquivos e escondia complexidade em linhas extensas.

## Decisão

Organizar novas regras em `core` (domínio puro), `app` (casos de uso), `infra` (Prisma, e-mail e criptografia) e `interfaces` (HTTP/WebSocket). O bootstrap apenas compõe dependências. A migração do legado é incremental para manter testes verdes, com fachadas de compatibilidade até a extração completa.

## Consequências

Regras de domínio e permissões podem ser testadas sem banco. Integrações ficam substituíveis. A implementação de persistência está dividida por agregado.

A fachada temporária `database.ts` foi removida em 22/08/2026 após a migração dos últimos consumidores para os módulos específicos de `infra/database`.

# Complemento — limites da infraestrutura (2026-08-20)

O entrypoint `server/src/index.ts` é exclusivamente um composition root. Adaptadores de transporte são construídos por fábricas e não devem iniciar processos como efeito colateral de importação.

O runtime também é composição, não um destino para a lógica removida do entrypoint. HTTP e realtime possuem adaptadores independentes; estado de sockets, presença e chamadas pertence ao gateway realtime e não ao bootstrap.

Na infraestrutura Prisma, repositórios são separados por agregado/capacidade (`identity`, `server` e `message`). Mapeadores compartilhados ficam isolados dos casos de uso, e consumidores importam o limite específico em vez de uma facade global de banco. `server/src/database.ts` permanece apenas como compatibilidade transitória e não deve receber novas implementações.
