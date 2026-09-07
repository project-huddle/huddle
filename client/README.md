# Clientes Huddle

Este diretório é um workspace Bun, com um único `bun.lock`.

- `shared/src`: interface React, estilos, hooks, stores e acesso à API.
- `web`: entrada do navegador, Vite, testes de navegador e Nginx.
- `desktop`: entrada do renderer, processo principal e preload do Electron.

Instale as dependências a partir deste diretório com `bun install --frozen-lockfile`.
Use `bun run dev:web` ou `bun run dev:desktop`. Para validar ambos:
`bun run typecheck`, `bun run lint` e `bun run build`.

O Docker usa este diretório como contexto para incluir `shared`, mas instala
apenas os workspaces web e shared. O Electron roda no sistema do usuário.
