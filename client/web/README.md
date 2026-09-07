# Huddle Web

Execute `bun install --frozen-lockfile` em `client/` e `bun run dev:web` para iniciar o Vite na porta
8080. A interface está em `../shared/src`; esta pasta mantém somente a entrada
web e a infraestrutura de navegador.

Use `VITE_API_URL` para configurar a API. No Docker o valor é `/api` e o proxy
encaminha HTTP, mídia e WebSocket. Execute o Compose a partir da raiz do projeto.

Nesta pasta: `bun run build`, `bun run lint` e `bun run e2e`.
Os testes E2E precisam de banco configurado, backend e Chromium do Playwright.
