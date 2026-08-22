# Huddle server

API Bun + TypeScript com PostgreSQL e Prisma.

## Estrutura

- `src/domain`: regras puras, aggregates, entidades e value objects;
- `src/features`: operações da aplicação organizadas por Vertical Slice;
- `src/app`: casos de uso legados ainda em migração;
- `src/infra`: Prisma, criptografia e Nodemailer;
- `src/interfaces`: adaptadores HTTP e tempo real;
- `src/bootstrap`: composition root com dependency injection manual;
- `src/index.ts`: entrypoint pequeno;
- `prisma/migrations`: evolução versionada do banco.

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
