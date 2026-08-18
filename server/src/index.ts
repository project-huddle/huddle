import { authenticate, hashToken, issueSession, revoke } from "./auth";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { config } from "./config";
import { createUser, findUserByEmail, messageHistory, saveMessage, userForSession, type MessageMedia, type User } from "./database";
import { body, corsHeaders, error, json } from "./http";

type SocketData = { user: User; callId: string | null };
type WsMessage = Record<string, unknown> & { type?: unknown };

const socketsByUser = new Map<string, Set<Bun.ServerWebSocket<SocketData>>>();
const calls = new Map<string, Set<Bun.ServerWebSocket<SocketData>>>();
mkdirSync(config.uploadsPath, { recursive: true });

const imageTypes = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
} as const;

function detectedImageType(bytes: Uint8Array): keyof typeof imageTypes | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.slice(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index])) return "image/png";
  const header = new TextDecoder().decode(bytes.slice(0, 12));
  if (header.startsWith("GIF87a") || header.startsWith("GIF89a")) return "image/gif";
  if (header.startsWith("RIFF") && header.slice(8) === "WEBP") return "image/webp";
  return null;
}

function send(ws: Bun.ServerWebSocket<SocketData>, value: unknown): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(value));
}

function broadcastAll(value: unknown, except?: Bun.ServerWebSocket<SocketData>): void {
  for (const sockets of socketsByUser.values()) for (const socket of sockets) if (socket !== except) send(socket, value);
}

function leaveCall(ws: Bun.ServerWebSocket<SocketData>): void {
  const callId = ws.data.callId;
  if (!callId) return;
  const peers = calls.get(callId);
  peers?.delete(ws);
  for (const peer of peers ?? []) send(peer, { type: "peer_left", callId, userId: ws.data.user.id });
  if (!peers?.size) calls.delete(callId);
  ws.data.callId = null;
}

function validEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function routes(request: Request, server: Bun.Server<SocketData>): Promise<Response | undefined> {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (request.method === "GET" && url.pathname === "/health") return json({ status: "ok", timestamp: new Date().toISOString() });
  if (request.method === "GET" && /^\/media\/[a-f0-9-]+\.(jpg|png|gif|webp)$/.test(url.pathname)) {
    const file = Bun.file(join(config.uploadsPath, url.pathname.slice("/media/".length)));
    if (!(await file.exists())) return error(404, "NOT_FOUND", "Media not found.");
    return new Response(file, { headers: { "Content-Type": file.type, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
  }

  if (request.method === "POST" && url.pathname === "/auth/register") {
    const input = await body(request);
    const email = typeof input?.email === "string" ? input.email.trim().toLowerCase() : input?.email;
    const displayName = typeof input?.displayName === "string" ? input.displayName.trim() : input?.displayName;
    const password = input?.password;
    if (!validEmail(email) || typeof displayName !== "string" || displayName.length < 2 || displayName.length > 32 || typeof password !== "string" || password.length < 8 || password.length > 128)
      return error(400, "INVALID_INPUT", "Use a valid email, a display name with 2-32 characters, and a password with 8-128 characters.");
    if (findUserByEmail(email)) return error(409, "EMAIL_IN_USE", "An account already exists for this email.");
    const user = createUser(email, displayName, await Bun.password.hash(password, { algorithm: "argon2id" }));
    return json({ user, session: issueSession(user.id) }, 201);
  }

  if (request.method === "POST" && url.pathname === "/auth/login") {
    const input = await body(request);
    const email = typeof input?.email === "string" ? input.email.trim().toLowerCase() : "";
    const password = typeof input?.password === "string" ? input.password : "";
    const account = findUserByEmail(email);
    if (!account || !(await Bun.password.verify(password, account.passwordHash))) return error(401, "INVALID_CREDENTIALS", "Invalid email or password.");
    const { passwordHash: _, ...user } = account;
    return json({ user, session: issueSession(user.id) });
  }

  if (url.pathname === "/ws") {
    const token = url.searchParams.get("token");
    const user = token ? userForSession(hashToken(token)) : null;
    if (!user) return error(401, "UNAUTHORIZED", "A valid session token is required.");
    if (server.upgrade(request, { data: { user, callId: null } })) return;
    return error(500, "UPGRADE_FAILED", "Could not open WebSocket.");
  }

  const user = authenticate(request);
  if (!user) return error(401, "UNAUTHORIZED", "A valid bearer token is required.");
  if (request.method === "GET" && url.pathname === "/auth/me") return json({ user });
  if (request.method === "POST" && url.pathname === "/auth/logout") { revoke(request); return new Response(null, { status: 204 }); }
  if (request.method === "POST" && url.pathname === "/uploads") {
    const form = await request.formData().catch(() => null);
    const upload = form?.get("file");
    if (!(upload instanceof File)) return error(400, "INVALID_FILE", "Choose an image to upload.");
    if (upload.size < 1 || upload.size > config.maxUploadBytes) return error(413, "FILE_TOO_LARGE", "Images must be no larger than 8 MB.");
    const bytes = new Uint8Array(await upload.arrayBuffer());
    const type = detectedImageType(bytes);
    if (!type) return error(415, "UNSUPPORTED_FILE", "Only JPEG, PNG, GIF and WebP images are supported.");
    const filename = `${crypto.randomUUID()}.${imageTypes[type]}`;
    await Bun.write(join(config.uploadsPath, filename), bytes);
    return json({ media: { url: `/media/${filename}`, type: type === "image/gif" ? "gif" : "image", alt: upload.name.slice(0, 160) || "Imagem enviada" } }, 201);
  }
  if (request.method === "GET" && url.pathname === "/gifs/search") {
    if (!config.tenorApiKey) return error(503, "GIF_PROVIDER_UNAVAILABLE", "GIF search is not configured.");
    const query = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
    if (!query) return json({ results: [] });
    const endpoint = new URL("https://tenor.googleapis.com/v2/search");
    endpoint.search = new URLSearchParams({ q: query, key: config.tenorApiKey, client_key: config.tenorClientKey, limit: "18", locale: "pt_BR", contentfilter: "medium", media_filter: "tinygif,gif" }).toString();
    const response = await fetch(endpoint);
    if (!response.ok) return error(502, "GIF_PROVIDER_ERROR", "The GIF provider could not complete the search.");
    const payload = await response.json() as { results?: Array<{ id: string; content_description?: string; media_formats?: { tinygif?: { url?: string }; gif?: { url?: string } } }> };
    return json({ results: (payload.results ?? []).flatMap((item) => {
      const url = item.media_formats?.gif?.url;
      const previewUrl = item.media_formats?.tinygif?.url ?? url;
      return url && previewUrl ? [{ id: item.id, url, previewUrl, alt: item.content_description ?? "GIF do Tenor" }] : [];
    }) });
  }
  if (request.method === "GET" && url.pathname === "/messages") {
    const parsed = Number(url.searchParams.get("limit") ?? 50);
    const limit = Number.isInteger(parsed) ? Math.min(Math.max(parsed, 1), config.maxHistoryLimit) : 50;
    const before = url.searchParams.get("before") ?? undefined;
    if (before && Number.isNaN(Date.parse(before))) return error(400, "INVALID_CURSOR", "before must be an ISO date.");
    return json({ messages: messageHistory(limit, before) });
  }
  return error(404, "NOT_FOUND", "Route not found.");
}

export const server = Bun.serve<SocketData>({
  hostname: config.host,
  port: config.port,
  async fetch(request, server) {
    const headers = corsHeaders(request);
    const response = await routes(request, server).catch((cause) => {
      console.error(cause);
      return error(500, "INTERNAL_ERROR", "An unexpected error occurred.");
    });
    if (!response) return;
    for (const [key, value] of headers) response.headers.set(key, value);
    return response;
  },
  websocket: {
    open(ws) {
      const sockets = socketsByUser.get(ws.data.user.id) ?? new Set();
      sockets.add(ws); socketsByUser.set(ws.data.user.id, sockets);
      send(ws, { type: "ready", user: ws.data.user });
      broadcastAll({ type: "presence", userId: ws.data.user.id, status: "online" }, ws);
    },
    async message(ws, raw) {
      if (typeof raw !== "string" || raw.length > 100_000) return send(ws, { type: "error", code: "INVALID_EVENT", message: "Invalid event." });
      let event: WsMessage;
      try { event = JSON.parse(raw); } catch { return send(ws, { type: "error", code: "INVALID_JSON", message: "Message must be valid JSON." }); }
      if (event.type === "chat_message") {
        const content = typeof event.content === "string" ? event.content.trim() : "";
        const candidate = event.media && typeof event.media === "object" ? event.media as Record<string, unknown> : null;
        const mediaType = candidate?.type === "image" || candidate?.type === "gif" ? candidate.type : null;
        const mediaUrl = typeof candidate?.url === "string" ? candidate.url : "";
        const localMedia = /^\/media\/[a-f0-9-]+\.(jpg|png|gif|webp)$/.test(mediaUrl);
        let tenorMedia = false;
        try { tenorMedia = new URL(mediaUrl).hostname === "media.tenor.com"; } catch { /* Relative uploads are handled above. */ }
        const media: MessageMedia | null = mediaType && (localMedia || (mediaType === "gif" && tenorMedia))
          ? { type: mediaType, url: mediaUrl, alt: typeof candidate?.alt === "string" ? candidate.alt.slice(0, 160) : "Imagem enviada" }
          : null;
        if ((!content && !media) || content.length > config.maxMessageLength) return send(ws, { type: "error", code: "INVALID_MESSAGE", message: `Message must contain text or valid media.` });
        const message = saveMessage(ws.data.user, content, media);
        return broadcastAll({ type: "chat_message", message });
      }
      if (event.type === "join_call") {
        const callId = typeof event.callId === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(event.callId) ? event.callId : null;
        if (!callId) return send(ws, { type: "error", code: "INVALID_CALL", message: "Invalid callId." });
        if (ws.data.callId === callId) return send(ws, { type: "call_joined", callId, peers: [...(calls.get(callId) ?? [])].filter((peer) => peer !== ws).map((peer) => peer.data.user) });
        leaveCall(ws); const peers = calls.get(callId) ?? new Set();
        peers.add(ws); calls.set(callId, peers); ws.data.callId = callId;
        send(ws, { type: "call_joined", callId, peers: [...peers].filter((peer) => peer !== ws).map((peer) => peer.data.user) });
        for (const peer of peers) if (peer !== ws) send(peer, { type: "peer_joined", callId, user: ws.data.user });
        return;
      }
      if (event.type === "leave_call") { leaveCall(ws); return; }
      if (["webrtc_offer", "webrtc_answer", "ice_candidate", "screen_share"].includes(String(event.type))) {
        const targetUserId = typeof event.targetUserId === "string" ? event.targetUserId : "";
        const peers = ws.data.callId ? calls.get(ws.data.callId) : null;
        const target = [...(peers ?? [])].find((peer) => peer.data.user.id === targetUserId);
        if (!target) return send(ws, { type: "error", code: "PEER_NOT_FOUND", message: "Target peer is not in this call." });
        if ((event.type === "webrtc_offer" || event.type === "webrtc_answer") && (!event.sdp || typeof event.sdp !== "object"))
          return send(ws, { type: "error", code: "INVALID_SDP", message: "Invalid session description." });
        if (event.type === "ice_candidate" && (!event.candidate || typeof event.candidate !== "object"))
          return send(ws, { type: "error", code: "INVALID_CANDIDATE", message: "Invalid ICE candidate." });
        const forwarded: Record<string, unknown> = { type: event.type, callId: ws.data.callId, fromUserId: ws.data.user.id };
        if (event.type === "webrtc_offer" || event.type === "webrtc_answer") forwarded.sdp = event.sdp;
        if (event.type === "ice_candidate") forwarded.candidate = event.candidate;
        if (event.type === "screen_share") forwarded.active = event.active === true;
        return send(target, forwarded);
      }
      send(ws, { type: "error", code: "UNKNOWN_EVENT", message: "Unknown event type." });
    },
    close(ws) {
      leaveCall(ws); const sockets = socketsByUser.get(ws.data.user.id); sockets?.delete(ws);
      if (!sockets?.size) { socketsByUser.delete(ws.data.user.id); broadcastAll({ type: "presence", userId: ws.data.user.id, status: "offline" }); }
    },
  },
});

console.log(`Peniscord server listening on http://${config.host}:${server.port}`);
