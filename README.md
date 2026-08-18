# huddle

Aplicação de chat em tempo real com cliente React/Vite e API Bun/SQLite. A infraestrutura serve o cliente e encaminha HTTP/WebSocket para a API pela mesma origem.

## Subir com Docker

Requer Docker com Compose v2:

```bash
cp .env.example .env
docker compose up --build -d
docker compose ps
```

Acesse `http://localhost:8080`. O SQLite e as imagens enviadas ficam no volume nomeado `huddle-data`; recriar os contêineres não remove os dados. São aceitos JPEG, PNG, GIF e WebP de até 8 MB. Para acompanhar ou encerrar:

```bash
docker compose logs -f
docker compose down
```

Defina `APP_PORT` e `APP_ORIGIN` no `.env` para outro endereço. Em produção, use uma origem HTTPS exata. A aplicação precisa de HTTPS para microfone e compartilhamento de tela fora de `localhost`. Para redes restritivas, configure `TURN_URL`, `TURN_USERNAME` e `TURN_CREDENTIAL`; prefira credenciais TURN temporárias no ambiente de produção.

A busca integrada de GIFs usa a Tenor quando `TENOR_API_KEY` está configurada. A Tenor deixou de aceitar novos clientes de API em janeiro de 2026; a configuração é destinada a chaves existentes. Mesmo sem essa chave, GIFs locais continuam disponíveis pelo envio de imagens.

## Desenvolvimento e validação

```bash
cd server && bun install --frozen-lockfile && bun test && bun run typecheck
cd ../client && bun install --frozen-lockfile && bun run lint && bun run build
```

O backend reserva uma porta livre durante os testes, permitindo suítes paralelas sem colisão. Os health checks são `/health` na API e `/healthz` no proxy.

## CI/CD

O workflow em `.github/workflows/ci-cd.yml` valida testes, tipos, lint e build em pull requests e pushes para `main`. Depois da validação, constrói as duas imagens; em `main`, publica imagens versionadas pelo SHA e também `latest` no GitHub Container Registry (GHCR).

O deploy no ambiente final pode consumir essas imagens imutáveis pelo SHA. Credenciais, domínio, TLS e TURN devem ficar no gerenciador de segredos e na plataforma de destino, não no repositório.
