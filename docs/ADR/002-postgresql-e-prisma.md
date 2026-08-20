# ADR-002 — PostgreSQL e Prisma

Status: Aceita — 20/08/2026

## Contexto

O produto possui relações fortes entre usuários, servidores, amizades, mensagens, permissões e reports, além de exigir transações e integridade referencial.

## Decisão

Usar PostgreSQL como fonte de verdade e Prisma como cliente e mecanismo de migrações. Regras críticas também recebem constraints e índices no banco.

## Consequências

Consultas relacionais e transações ficam explícitas e testáveis. Migrações devem ser aplicadas antes do processo da API. O CLI Prisma é dependência de toolchain e seus advisories transitivos precisam ser acompanhados.
