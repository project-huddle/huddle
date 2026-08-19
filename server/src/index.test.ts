import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:net";

const temporaryDirectory = mkdtempSync(join(tmpdir(), "huddle-test-"));
process.env.HOST = "127.0.0.1";
process.env.UPLOADS_PATH = join(temporaryDirectory, "uploads");

let server: typeof import("./index").server;
let baseUrl: string;

function availablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (!address || typeof address === "string") return reject(new Error("Could not allocate a test port"));
      probe.close((cause) => cause ? reject(cause) : resolve(address.port));
    });
  });
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must point to an isolated PostgreSQL test database");
  const { db } = await import("./database");
  await db.$transaction([db.message.deleteMany(), db.invite.deleteMany(), db.channel.deleteMany(), db.serverMember.deleteMany(), db.server.deleteMany(), db.session.deleteMany(), db.user.deleteMany()]);
  process.env.PORT = String(await availablePort());
  ({ server } = await import("./index"));
  baseUrl = `http://127.0.0.1:${server.port}`;
});

afterAll(async () => {
  server?.stop(true);
  const { db } = await import("./database");
  await db.$disconnect();
  rmSync(temporaryDirectory, { recursive: true, force: true });
});

async function register(email: string, displayName: string) {
  const response = await fetch(`${baseUrl}/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, displayName, password: "secure-password" }),
  });
  expect(response.status).toBe(201);
  return response.json() as Promise<{ user: { id: string }; session: { token: string } }>;
}

function nextEvent(socket: WebSocket, type: string): Promise<Record<string, any>> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${type}`)), 2_000);
    const listener = (event: MessageEvent) => {
      const value = JSON.parse(String(event.data));
      if (value.type !== type) return;
      clearTimeout(timeout); socket.removeEventListener("message", listener); resolve(value);
    };
    socket.addEventListener("message", listener);
  });
}

async function connect(token: string): Promise<WebSocket> {
  const socket = new WebSocket(`${baseUrl.replace("http", "ws")}/ws?token=${encodeURIComponent(token)}`);
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener("open", () => resolve(), { once: true });
    socket.addEventListener("error", () => reject(new Error("WebSocket failed")), { once: true });
  });
  return socket;
}

describe("huddle API", () => {
  test("reports health and applies CORS only to configured origins", async () => {
    const allowed = await fetch(`${baseUrl}/health`, { headers: { origin: "http://localhost:5173" } });
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    expect((await allowed.json() as { status: string }).status).toBe("ok");

    const denied = await fetch(`${baseUrl}/health`, { headers: { origin: "https://untrusted.example" } });
    expect(denied.headers.has("access-control-allow-origin")).toBeFalse();
  });

  test("rejects invalid registration and protected requests without a session", async () => {
    const invalid = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "invalid", displayName: "A", password: "short" }),
    });
    expect(invalid.status).toBe(400);

    const protectedResponse = await fetch(`${baseUrl}/messages`);
    expect(protectedResponse.status).toBe(401);
  });

  test("registers, authenticates, stores messages and relays WebRTC signaling", async () => {
    const alice = await register("alice@example.com", "Alice");
    const bob = await register("bob@example.com", "Bob");
    const aliceSocket = await connect(alice.session.token);
    const bobSocket = await connect(bob.session.token);

    const chat = nextEvent(bobSocket, "chat_message");
    aliceSocket.send(JSON.stringify({ type: "chat_message", content: "Olá!" }));
    expect((await chat).message.content).toBe("Olá!");

    const uploadForm = new FormData();
    uploadForm.append("file", new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])], "foto.png", { type: "image/png" }));
    const upload = await fetch(`${baseUrl}/uploads`, { method: "POST", headers: { authorization: `Bearer ${alice.session.token}` }, body: uploadForm });
    expect(upload.status).toBe(201);
    const uploadedMedia = (await upload.json() as { media: { url: string; type: string; alt: string } }).media;
    expect((await fetch(`${baseUrl}${uploadedMedia.url}`)).status).toBe(200);

    const imageMessage = nextEvent(bobSocket, "chat_message");
    aliceSocket.send(JSON.stringify({ type: "chat_message", content: "", media: uploadedMedia }));
    expect((await imageMessage).message.media).toMatchObject({ type: "image", alt: "foto.png" });

    const invalidForm = new FormData();
    invalidForm.append("file", new File(["not-an-image"], "fake.png", { type: "image/png" }));
    const invalidUpload = await fetch(`${baseUrl}/uploads`, { method: "POST", headers: { authorization: `Bearer ${alice.session.token}` }, body: invalidForm });
    expect(invalidUpload.status).toBe(415);

    aliceSocket.send(JSON.stringify({ type: "join_call", callId: "general" }));
    await nextEvent(aliceSocket, "call_joined");
    bobSocket.send(JSON.stringify({ type: "join_call", callId: "general" }));
    await nextEvent(bobSocket, "call_joined");

    const offer = nextEvent(bobSocket, "webrtc_offer");
    aliceSocket.send(JSON.stringify({ type: "webrtc_offer", targetUserId: bob.user.id, sdp: { type: "offer", sdp: "test" } }));
    expect((await offer).fromUserId).toBe(alice.user.id);

    const screenShare = nextEvent(bobSocket, "screen_share");
    aliceSocket.send(JSON.stringify({ type: "screen_share", targetUserId: bob.user.id, active: true }));
    expect(await screenShare).toMatchObject({ fromUserId: alice.user.id, active: true, callId: "general" });

    const peerLeft = nextEvent(aliceSocket, "peer_left");
    bobSocket.send(JSON.stringify({ type: "leave_call" }));
    expect(await peerLeft).toMatchObject({ userId: bob.user.id, callId: "general" });

    const history = await fetch(`${baseUrl}/messages`, { headers: { authorization: `Bearer ${alice.session.token}` } });
    expect(history.status).toBe(200);
    const historyBody = await history.json() as { messages: unknown[] };
    expect(historyBody.messages).toHaveLength(2);
    aliceSocket.close(); bobSocket.close();
  });

  test("manages servers, members, roles, channels and message features", async () => {
    const owner = await register("owner@example.com", "Owner");
    const guest = await register("guest@example.com", "Guest");
    const ownerHeaders = { authorization: `Bearer ${owner.session.token}` };
    const guestHeaders = { authorization: `Bearer ${guest.session.token}` };

    const created = await fetch(`${baseUrl}/servers`, { method: "POST", headers: { ...ownerHeaders, "content-type": "application/json" }, body: JSON.stringify({ name: "QA server" }) });
    expect(created.status).toBe(201);
    const createdBody = await created.json() as { server: { id: string }; channel: { id: string } };
    const inviteResponse = await fetch(`${baseUrl}/servers/${createdBody.server.id}/invites`, { method: "POST", headers: ownerHeaders });
    expect(inviteResponse.status).toBe(201);
    const invite = await inviteResponse.json() as { invite: { code: string } };
    const joined = await fetch(`${baseUrl}/invites/join`, { method: "POST", headers: { ...guestHeaders, "content-type": "application/json" }, body: JSON.stringify({ code: invite.invite.code }) });
    expect(joined.status).toBe(201);

    const memberList = await fetch(`${baseUrl}/servers/${createdBody.server.id}/members`, { headers: guestHeaders });
    expect((await memberList.json() as { members: unknown[] }).members).toHaveLength(2);
    const promoted = await fetch(`${baseUrl}/servers/${createdBody.server.id}/members/${guest.user.id}`, { method: "PATCH", headers: { ...ownerHeaders, "content-type": "application/json" }, body: JSON.stringify({ role: "moderator" }) });
    expect(promoted.status).toBe(204);
    const channel = await fetch(`${baseUrl}/servers/${createdBody.server.id}/channels`, { method: "POST", headers: { ...guestHeaders, "content-type": "application/json" }, body: JSON.stringify({ name: "qa-chat" }) });
    expect(channel.status).toBe(201);
    const channelBody = await channel.json() as { channel: { id: string } };

    const ownerSocket = await connect(owner.session.token);
    const guestSocket = await connect(guest.session.token);
    ownerSocket.send(JSON.stringify({ type: "subscribe_channel", channelId: channelBody.channel.id }));
    guestSocket.send(JSON.stringify({ type: "subscribe_channel", channelId: channelBody.channel.id }));
    await nextEvent(ownerSocket, "channel_subscribed");
    await nextEvent(guestSocket, "channel_subscribed");

    const received = nextEvent(guestSocket, "chat_message");
    ownerSocket.send(JSON.stringify({ type: "chat_message", channelId: channelBody.channel.id, content: "feature test" }));
    const message = (await received).message as { id: string };
    const edited = nextEvent(guestSocket, "edit_message");
    ownerSocket.send(JSON.stringify({ type: "edit_message", messageId: message.id, content: "edited feature test" }));
    expect((await edited).message.content).toBe("edited feature test");
    const reacted = nextEvent(ownerSocket, "react_message");
    guestSocket.send(JSON.stringify({ type: "react_message", messageId: message.id, emoji: "👍" }));
    expect((await reacted).message.reactions["👍"]).toBe(1);
    const replied = nextEvent(guestSocket, "chat_message");
    ownerSocket.send(JSON.stringify({ type: "chat_message", channelId: channelBody.channel.id, content: "reply", replyToId: message.id }));
    expect((await replied).message.replyToId).toBe(message.id);
    const deleted = nextEvent(guestSocket, "delete_message");
    ownerSocket.send(JSON.stringify({ type: "delete_message", messageId: message.id }));
    expect((await deleted).message.deletedAt).toBeTruthy();
    const forbiddenEdit = nextEvent(guestSocket, "error");
    guestSocket.send(JSON.stringify({ type: "edit_message", messageId: message.id, content: "should fail" }));
    expect((await forbiddenEdit).code).toBe("FORBIDDEN");
    ownerSocket.close(); guestSocket.close();
  });
});
