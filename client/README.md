# Huddle client

Cliente React, TypeScript e Vite do Huddle.

```bash
npm install
npm run dev
npm run lint
npm run build
```

Use `VITE_API_URL` para apontar para a API. O ambiente Docker configura proxy para HTTP, mídia e WebSocket. Os testes de navegador ficam em `e2e/` e executam com `npm run e2e` após instalar o Chromium do Playwright.
