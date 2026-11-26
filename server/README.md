# Huddle server

API Bun + TypeScript com PostgreSQL e Prisma.

## Estrutura

- `src/domain`: regras puras, aggregates, entidades e value objects;
- `src/features`: aplicação, adaptadores HTTP/realtime e repositories agrupados por capacidade;
- `src/shared/infrastructure`: conexão Prisma e mapeadores usados por várias fatias;
- `src/interfaces`: composição HTTP compartilhada, autenticação e plugins de transporte;
- `src/bootstrap`: composition root com dependency injection manual;
- `src/index.ts`: entrypoint pequeno;
- `prisma/migrations`: evolução versionada do banco.

As operações Prisma ficam nos repositories em `features/*/infrastructure`. Rotas e serviços de aplicação usam esses módulos; o cliente e os mapeadores Prisma compartilhados ficam em `shared/infrastructure/database`.

## Executar e validar

```bash
bun install --frozen-lockfile
cp .env.example .env
bun run db:generate
bun run db:migrate
bun run dev
bun run typecheck
DATABASE_URL=postgresql://.../huddle_test bun test --coverage
```

Os testes apagam os dados do banco informado. Use exclusivamente um banco isolado de testes.

WebSockets são autenticados por tickets descartáveis obtidos em `POST /auth/ws-ticket`; tokens de sessão não devem ser colocados em URLs. Consulte os ADRs em `docs/ADR` para decisões de arquitetura, dados, e-mail e privacidade.
