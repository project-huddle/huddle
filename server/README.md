# Peniscord server

Back-end local em Bun + TypeScript para autenticação, chat persistente e sinalização de chamadas WebRTC. Os dados ficam em SQLite; não há dependência de serviços de banco externos.

## Executar

Requer Bun 1.3 ou mais recente.

```bash
bun install
cp .env.example .env
bun run dev
```

O servidor usa `http://localhost:3000` por padrão. As variáveis aceitas estão em `.env.example`. Em produção, limite `CORS_ORIGINS` à origem HTTPS exata do cliente e mantenha o arquivo SQLite em volume persistente.

```bash
bun run typecheck
bun test
```

## API HTTP

Todos os corpos e respostas usam JSON. Erros têm a forma `{ "error": { "code": "...", "message": "..." } }`.

### Autenticação

- `POST /auth/register` — `{ email, displayName, password }`; devolve `{ user, session: { token, expiresAt } }`.
- `POST /auth/login` — `{ email, password }`; devolve o mesmo formato.
- `GET /auth/me` — requer `Authorization: Bearer <token>`.
- `POST /auth/logout` — requer bearer token e revoga a sessão.

Senhas têm de ter entre 8 e 128 caracteres e são armazenadas com Argon2id. O token de sessão dura 30 dias; apenas seu SHA-256 fica no banco.

### Mensagens

`GET /messages?limit=50&before=<data ISO>` requer autenticação e devolve `{ messages: [...] }` em ordem cronológica. `limit` vai de 1 a 100. Para paginar para trás, use o `createdAt` da primeira mensagem como `before`.

### Saúde

`GET /health` não exige autenticação.

## WebSocket

Conecte a `ws://localhost:3000/ws?token=<token>`. O primeiro evento recebido é:

```json
{ "type": "ready", "user": { "id": "...", "email": "...", "displayName": "..." } }
```

Envie texto pelo socket:

```json
{ "type": "chat_message", "content": "Olá" }
```

Todos os clientes conectados recebem `{ "type": "chat_message", "message": ... }`. O servidor também emite eventos `presence` com `userId` e status `online`/`offline`.

## Chamada e compartilhamento de tela

O servidor é o canal de sinalização. Áudio, vídeo e tela trafegam diretamente entre navegadores por `RTCPeerConnection` — o cliente deve usar `getUserMedia()` para câmera/microfone e `getDisplayMedia()` para a tela.

1. Envie `{ "type": "join_call", "callId": "general" }`.
2. O cliente recebe `call_joined`, contendo os usuários já presentes. Eles recebem `peer_joined`.
3. Para cada participante, crie um `RTCPeerConnection` e troque eventos direcionados:

```json
{ "type": "webrtc_offer", "targetUserId": "...", "sdp": { "type": "offer", "sdp": "..." } }
{ "type": "webrtc_answer", "targetUserId": "...", "sdp": { "type": "answer", "sdp": "..." } }
{ "type": "ice_candidate", "targetUserId": "...", "candidate": { "candidate": "..." } }
{ "type": "screen_share", "targetUserId": "...", "active": true }
```

Ao receber, esses eventos trazem `fromUserId` no lugar de `targetUserId`. `peer_left` informa a saída. Também é possível enviar `leave_call` explicitamente.

Ao iniciar a tela, o cliente adiciona a faixa com `addTrack()` ou substitui a faixa de vídeo com `replaceTrack()`, renegocia se necessário e envia `screen_share` a cada peer. Ao encerrar, restaura a câmera e envia `active: false`.

Para uso fora da rede local, configure servidores STUN no `RTCPeerConnection`. Redes restritivas também exigem um servidor TURN; isso é infraestrutura de retransmissão de mídia e fica deliberadamente separado desta API.

## Estrutura

- `src/index.ts`: rotas e protocolo WebSocket.
- `src/database.ts`: esquema e consultas SQLite.
- `src/auth.ts`: emissão, validação e revogação de sessões.
- `src/config.ts`: configuração por ambiente.
- `src/index.test.ts`: integração HTTP + dois clientes WebSocket.
