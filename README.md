# huddle

Aplicação de chat em tempo real com cliente React/Vite e API Bun, Prisma e PostgreSQL. A infraestrutura serve o cliente e encaminha HTTP/WebSocket para a API pela mesma origem.

## Deploy com Docker

Requer Docker com Compose v2:

```bash
cp .env.example .env
docker compose up --build -d
docker compose ps
```

Acesse `http://localhost:8080`. O PostgreSQL fica no volume `huddle-postgres` e as imagens enviadas no volume `huddle-data`; recriar os contêineres não remove os dados. As migrações Prisma são aplicadas automaticamente antes de a API iniciar. São aceitos JPEG, PNG, GIF e WebP de até 8 MB. Para acompanhar ou encerrar:

```bash
docker compose logs -f
docker compose down
```

Defina `APP_PORT` e `APP_ORIGIN` no `.env` para outro endereço. Em produção, use uma origem HTTPS exata. A aplicação precisa de HTTPS para microfone e compartilhamento de tela fora de `localhost`. Para redes restritivas, configure `TURN_URL`, `TURN_USERNAME` e `TURN_CREDENTIAL`; prefira credenciais TURN temporárias no ambiente de produção.

A busca integrada de GIFs usa a Tenor quando `TENOR_API_KEY` está configurada. A Tenor deixou de aceitar novos clientes de API em janeiro de 2026; a configuração é destinada a chaves existentes. Mesmo sem essa chave, GIFs locais continuam disponíveis pelo envio de imagens.

## Desenvolvimento com Docker

Use o arquivo adicional de Compose para executar Vite e Bun em modo de observação:

```bash
docker compose -f compose.yaml -f compose.dev.yaml up --build
```

Acesse `http://localhost:8080`. Alterações em `client/src` atualizam o navegador via HMR, enquanto alterações em `server/src` reiniciam a API automaticamente. Os diretórios `node_modules` ficam em volumes separados para não serem substituídos pelos arquivos do host.

Para encerrar:

```bash
docker compose -f compose.yaml -f compose.dev.yaml down
```

O comando de deploy continua usando somente `compose.yaml` e gera imagens imutáveis com o cliente estático servido pelo Nginx:

```bash
docker compose up --build -d
```

## Desenvolvimento local e validação

```bash
cd server && bun install --frozen-lockfile && bun run db:generate && bun run typecheck
# Com DATABASE_URL apontando para um banco de teste já migrado:
DATABASE_URL=postgresql://huddle:huddle@localhost:5432/huddle_test?schema=public bun test
cd ../client && bun install --frozen-lockfile && bun run lint && bun run build
```

O backend reserva uma porta livre durante os testes. Cada execução deve usar um banco PostgreSQL de teste isolado, pois a suíte limpa esse banco antes de iniciar. Os health checks são `/health` na API e `/healthz` no proxy.

## CI/CD

O workflow em `.github/workflows/ci-cd.yml` valida testes, tipos, lint e build em pull requests e pushes para `main`. Depois da validação, constrói as duas imagens; em `main`, publica imagens versionadas pelo SHA e também `latest` no GitHub Container Registry (GHCR).

O deploy no ambiente final pode consumir essas imagens imutáveis pelo SHA. Credenciais, domínio, TLS e TURN devem ficar no gerenciador de segredos e na plataforma de destino, não no repositório.
