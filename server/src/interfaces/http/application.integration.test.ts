import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import { createHash } from "node:crypto";

const temporaryDirectory = mkdtempSync(join(tmpdir(), "huddle-test-"));
process.env.HOST = "127.0.0.1";
process.env.UPLOADS_PATH = join(temporaryDirectory, "uploads");

let server: typeof import("../../index").server;
let baseUrl: string;

function availablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (!address || typeof address === "string")
        return reject(new Error("Could not allocate a test port"));
      probe.close((cause) => (cause ? reject(cause) : resolve(address.port)));
    });
  });
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL)
    throw new Error(
      "DATABASE_URL must point to an isolated PostgreSQL test database",
    );
  const { db } = await import("../../infra/database/client");
  await db.$transaction([
    db.emailToken.deleteMany(),
    db.report.deleteMany(),
    db.directMessage.deleteMany(),
    db.friendship.deleteMany(),
    db.messageReaction.deleteMany(),
    db.message.deleteMany(),
    db.invite.deleteMany(),
    db.channel.deleteMany(),
    db.serverMember.deleteMany(),
    db.server.deleteMany(),
    db.session.deleteMany(),
    db.user.deleteMany(),
  ]);
  process.env.PORT = String(await availablePort());
  ({ server } = await import("../../index"));
  baseUrl = `http://127.0.0.1:${server.port}`;
});

afterAll(async () => {
  server?.stop(true);
  const { db } = await import("../../infra/database/client");
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
  return response.json() as Promise<{
    user: { id: string };
    session: { token: string };
  }>;
}

function nextEvent(
  socket: WebSocket,
  type: string,
): Promise<Record<string, any>> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Timed out waiting for ${type}`)),
      2_000,
    );
    const listener = (event: MessageEvent) => {
      const value = JSON.parse(String(event.data));
      if (value.type !== type) return;
      clearTimeout(timeout);
      socket.removeEventListener("message", listener);
      resolve(value);
    };
    socket.addEventListener("message", listener);
  });
}

function sendAndWait(
  socket: WebSocket,
  type: string,
  event: Record<string, unknown>,
): Promise<Record<string, any>> {
  const received = nextEvent(socket, type);
  socket.send(JSON.stringify(event));
  return received;
}

async function connect(token: string): Promise<WebSocket> {
  const ticketResponse = await fetch(`${baseUrl}/auth/ws-ticket`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
  expect(ticketResponse.status).toBe(200);
  const { ticket } = (await ticketResponse.json()) as { ticket: string };
  const socket = new WebSocket(
    `${baseUrl.replace("http", "ws")}/ws?ticket=${encodeURIComponent(ticket)}`,
  );
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener("open", () => resolve(), { once: true });
    socket.addEventListener(
      "error",
      () => reject(new Error("WebSocket failed")),
      { once: true },
    );
  });
  return socket;
}

describe("huddle API", () => {
  test("reports health and applies CORS only to configured origins", async () => {
    const allowed = await fetch(`${baseUrl}/health`, {
      headers: { origin: "http://localhost:5173" },
    });
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:5173",
    );
    expect(allowed.headers.get("x-frame-options")).toBe("DENY");
    expect(allowed.headers.get("x-content-type-options")).toBe("nosniff");
    expect(((await allowed.json()) as { status: string }).status).toBe("ok");

    const denied = await fetch(`${baseUrl}/health`, {
      headers: { origin: "https://untrusted.example" },
    });
    expect(denied.headers.has("access-control-allow-origin")).toBeFalse();
  });

  test("rejects invalid registration and protected requests without a session", async () => {
    const invalid = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "invalid",
        displayName: "A",
        password: "short",
      }),
    });
    expect(invalid.status).toBe(400);

    const protectedResponse = await fetch(`${baseUrl}/messages`);
    expect(protectedResponse.status).toBe(401);

    const first = await register("duplicate@example.com", "Duplicate");
    expect(first.user.id).toBeTruthy();
    const duplicate = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "duplicate@example.com",
        displayName: "Duplicate",
        password: "secure-password",
      }),
    });
    expect(duplicate.status).toBe(409);

    const oversized = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "large@example.com",
        displayName: "Large",
        password: "x".repeat(17_000),
      }),
    });
    expect(oversized.status).toBe(400);
  });

  test("validates native routes and preserves authorization and not-found responses", async () => {
    const owner = await register("native-owner@example.com", "Native Owner");
    const outsider = await register(
      "native-outsider@example.com",
      "Native Outsider",
    );
    const ownerHeaders = { authorization: `Bearer ${owner.session.token}` };
    const outsiderHeaders = {
      authorization: `Bearer ${outsider.session.token}`,
    };
    const created = await fetch(`${baseUrl}/servers`, {
      method: "POST",
      headers: { ...ownerHeaders, "content-type": "application/json" },
      body: JSON.stringify({ name: "Native routes" }),
    });
    const serverId = ((await created.json()) as { server: { id: string } })
      .server.id;

    const forbidden = await fetch(`${baseUrl}/servers/${serverId}/channels`, {
      headers: outsiderHeaders,
    });
    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toMatchObject({
      error: { code: "FORBIDDEN" },
    });

    const invalid = await fetch(`${baseUrl}/servers`, {
      method: "POST",
      headers: { ...ownerHeaders, "content-type": "application/json" },
      body: JSON.stringify([]),
    });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({
      error: { code: "INVALID_INPUT" },
    });

    expect(
      (
        await fetch(`${baseUrl}/route-that-does-not-exist`, {
          headers: ownerHeaders,
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await fetch(`${baseUrl}/servers`, {
          method: "OPTIONS",
          headers: { origin: "http://localhost:5173" },
        })
      ).status,
    ).toBe(204);
  });

  test("uses short-lived, single-use WebSocket tickets instead of session tokens in URLs", async () => {
    const account = await register("ticket@example.com", "Ticket");
    const response = await fetch(`${baseUrl}/auth/ws-ticket`, {
      method: "POST",
      headers: { authorization: `Bearer ${account.session.token}` },
    });
    const { ticket } = (await response.json()) as { ticket: string };
    const first = new WebSocket(
      `${baseUrl.replace("http", "ws")}/ws?ticket=${ticket}`,
    );
    await new Promise<void>((resolve, reject) => {
      first.addEventListener("open", () => resolve(), { once: true });
      first.addEventListener(
        "error",
        () => reject(new Error("First ticket use failed")),
        { once: true },
      );
    });
    first.close();

    const replay = await fetch(`${baseUrl}/ws?ticket=${ticket}`, {
      headers: { upgrade: "websocket" },
    });
    expect(replay.status).toBe(401);
    const leakedSession = await fetch(
      `${baseUrl}/ws?token=${account.session.token}`,
      { headers: { upgrade: "websocket" } },
    );
    expect(leakedSession.status).toBe(401);
  });

  test("registers, authenticates, stores messages and relays WebRTC signaling", async () => {
    const alice = await register("alice@example.com", "Alice");
    const bob = await register("bob@example.com", "Bob");
    const aliceHeaders = { authorization: `Bearer ${alice.session.token}` };
    const bobHeaders = { authorization: `Bearer ${bob.session.token}` };
    const initialServers = await fetch(`${baseUrl}/servers`, {
      headers: aliceHeaders,
    });
    expect(
      ((await initialServers.json()) as { servers: unknown[] }).servers,
    ).toHaveLength(0);
    const createdServer = await fetch(`${baseUrl}/servers`, {
      method: "POST",
      headers: { ...aliceHeaders, "content-type": "application/json" },
      body: JSON.stringify({ name: "Shared" }),
    });
    const sharedServerId = (
      (await createdServer.json()) as { server: { id: string } }
    ).server.id;
    const inviteResponse = await fetch(
      `${baseUrl}/servers/${sharedServerId}/invites`,
      { method: "POST", headers: aliceHeaders },
    );
    const inviteCode = (
      (await inviteResponse.json()) as { invite: { code: string } }
    ).invite.code;
    const joined = await fetch(`${baseUrl}/invites/join`, {
      method: "POST",
      headers: { ...bobHeaders, "content-type": "application/json" },
      body: JSON.stringify({ code: inviteCode }),
    });
    expect(joined.status).toBe(201);
    const channelsResponse = await fetch(
      `${baseUrl}/servers/${sharedServerId}/channels`,
      { headers: aliceHeaders },
    );
    const sharedChannelId = (
      (await channelsResponse.json()) as { channels: Array<{ id: string }> }
    ).channels[0]!.id;
    const aliceSocket = await connect(alice.session.token);
    const bobSocket = await connect(bob.session.token);
    await sendAndWait(aliceSocket, "channel_subscribed", {
      type: "subscribe_channel",
      channelId: sharedChannelId,
    });
    await sendAndWait(bobSocket, "channel_subscribed", {
      type: "subscribe_channel",
      channelId: sharedChannelId,
    });

    const chat = nextEvent(bobSocket, "chat_message");
    aliceSocket.send(JSON.stringify({ type: "chat_message", content: "Olá!" }));
    expect((await chat).message.content).toBe("Olá!");

    const uploadForm = new FormData();
    uploadForm.append(
      "file",
      new File(
        [
          new Uint8Array([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
          ]),
        ],
        "foto.png",
        { type: "image/png" },
      ),
    );
    const upload = await fetch(`${baseUrl}/uploads`, {
      method: "POST",
      headers: aliceHeaders,
      body: uploadForm,
    });
    expect(upload.status).toBe(201);
    const uploadedMedia = (
      (await upload.json()) as {
        media: { url: string; type: string; alt: string };
      }
    ).media;
    expect((await fetch(`${baseUrl}${uploadedMedia.url}`)).status).toBe(200);

    const imageMessage = nextEvent(bobSocket, "chat_message");
    aliceSocket.send(
      JSON.stringify({
        type: "chat_message",
        content: "",
        media: uploadedMedia,
      }),
    );
    expect((await imageMessage).message.media).toMatchObject({
      type: "image",
      alt: "foto.png",
    });

    const invalidForm = new FormData();
    invalidForm.append(
      "file",
      new File(["not-an-image"], "fake.png", { type: "image/png" }),
    );
    const invalidUpload = await fetch(`${baseUrl}/uploads`, {
      method: "POST",
      headers: aliceHeaders,
      body: invalidForm,
    });
    expect(invalidUpload.status).toBe(415);

    await sendAndWait(aliceSocket, "call_joined", {
      type: "join_call",
      callId: "general",
    });
    await sendAndWait(bobSocket, "call_joined", {
      type: "join_call",
      callId: "general",
    });

    const offer = nextEvent(bobSocket, "webrtc_offer");
    aliceSocket.send(
      JSON.stringify({
        type: "webrtc_offer",
        targetUserId: bob.user.id,
        sdp: { type: "offer", sdp: "test" },
      }),
    );
    expect((await offer).fromUserId).toBe(alice.user.id);

    const screenShare = nextEvent(bobSocket, "screen_share");
    aliceSocket.send(
      JSON.stringify({
        type: "screen_share",
        targetUserId: bob.user.id,
        active: true,
      }),
    );
    expect(await screenShare).toMatchObject({
      fromUserId: alice.user.id,
      active: true,
      callId: "general",
    });

    const peerLeft = nextEvent(aliceSocket, "peer_left");
    bobSocket.send(JSON.stringify({ type: "leave_call" }));
    expect(await peerLeft).toMatchObject({
      userId: bob.user.id,
      callId: "general",
    });

    const history = await fetch(
      `${baseUrl}/messages?channelId=${sharedChannelId}`,
      { headers: aliceHeaders },
    );
    expect(history.status).toBe(200);
    const historyBody = (await history.json()) as { messages: unknown[] };
    expect(historyBody.messages).toHaveLength(2);
    aliceSocket.close();
    bobSocket.close();
  });

  test("manages servers, members, roles, channels and message features", async () => {
    const owner = await register("owner@example.com", "Owner");
    const guest = await register("guest@example.com", "Guest");
    const ownerHeaders = { authorization: `Bearer ${owner.session.token}` };
    const guestHeaders = { authorization: `Bearer ${guest.session.token}` };

    const created = await fetch(`${baseUrl}/servers`, {
      method: "POST",
      headers: { ...ownerHeaders, "content-type": "application/json" },
      body: JSON.stringify({ name: "QA server" }),
    });
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as {
      server: { id: string };
      channel: { id: string };
    };
    const inviteResponse = await fetch(
      `${baseUrl}/servers/${createdBody.server.id}/invites`,
      { method: "POST", headers: ownerHeaders },
    );
    expect(inviteResponse.status).toBe(201);
    const invite = (await inviteResponse.json()) as {
      invite: { code: string };
    };
    const joined = await fetch(`${baseUrl}/invites/join`, {
      method: "POST",
      headers: { ...guestHeaders, "content-type": "application/json" },
      body: JSON.stringify({ code: invite.invite.code }),
    });
    expect(joined.status).toBe(201);

    const memberList = await fetch(
      `${baseUrl}/servers/${createdBody.server.id}/members`,
      { headers: guestHeaders },
    );
    expect(
      ((await memberList.json()) as { members: unknown[] }).members,
    ).toHaveLength(2);
    const promoted = await fetch(
      `${baseUrl}/servers/${createdBody.server.id}/members/${guest.user.id}`,
      {
        method: "PATCH",
        headers: { ...ownerHeaders, "content-type": "application/json" },
        body: JSON.stringify({ role: "moderator" }),
      },
    );
    expect(promoted.status).toBe(204);
    const channel = await fetch(
      `${baseUrl}/servers/${createdBody.server.id}/channels`,
      {
        method: "POST",
        headers: { ...guestHeaders, "content-type": "application/json" },
        body: JSON.stringify({ name: "qa-chat" }),
      },
    );
    expect(channel.status).toBe(201);
    const channelBody = (await channel.json()) as { channel: { id: string } };

    const ownerSocket = await connect(owner.session.token);
    const guestSocket = await connect(guest.session.token);
    await sendAndWait(ownerSocket, "channel_subscribed", {
      type: "subscribe_channel",
      channelId: channelBody.channel.id,
    });
    await sendAndWait(guestSocket, "channel_subscribed", {
      type: "subscribe_channel",
      channelId: channelBody.channel.id,
    });

    const received = nextEvent(guestSocket, "chat_message");
    ownerSocket.send(
      JSON.stringify({
        type: "chat_message",
        channelId: channelBody.channel.id,
        content: "feature test",
      }),
    );
    const message = (await received).message as { id: string };
    const edited = nextEvent(guestSocket, "edit_message");
    ownerSocket.send(
      JSON.stringify({
        type: "edit_message",
        messageId: message.id,
        content: "edited feature test",
      }),
    );
    expect((await edited).message.content).toBe("edited feature test");
    const reacted = nextEvent(ownerSocket, "react_message");
    guestSocket.send(
      JSON.stringify({
        type: "react_message",
        messageId: message.id,
        emoji: "👍",
      }),
    );
    expect((await reacted).message.reactions["👍"]).toBe(1);
    const reactedByOwner = nextEvent(ownerSocket, "react_message");
    ownerSocket.send(
      JSON.stringify({
        type: "react_message",
        messageId: message.id,
        emoji: "👍",
      }),
    );
    expect((await reactedByOwner).message.reactions["👍"]).toBe(2);
    const guestRemovedOwnReaction = nextEvent(ownerSocket, "react_message");
    guestSocket.send(
      JSON.stringify({
        type: "react_message",
        messageId: message.id,
        emoji: "👍",
      }),
    );
    expect((await guestRemovedOwnReaction).message.reactions["👍"]).toBe(1);
    const replied = nextEvent(guestSocket, "chat_message");
    ownerSocket.send(
      JSON.stringify({
        type: "chat_message",
        channelId: channelBody.channel.id,
        content: "reply",
        replyToId: message.id,
      }),
    );
    expect((await replied).message.replyToId).toBe(message.id);
    const deleted = nextEvent(guestSocket, "delete_message");
    ownerSocket.send(
      JSON.stringify({ type: "delete_message", messageId: message.id }),
    );
    expect((await deleted).message.deletedAt).toBeTruthy();
    const forbiddenEdit = nextEvent(guestSocket, "error");
    guestSocket.send(
      JSON.stringify({
        type: "edit_message",
        messageId: message.id,
        content: "should fail",
      }),
    );
    expect((await forbiddenEdit).code).toBe("FORBIDDEN");
    const revoked = nextEvent(guestSocket, "access_revoked");
    const removed = await fetch(
      `${baseUrl}/servers/${createdBody.server.id}/members/${guest.user.id}`,
      { method: "DELETE", headers: ownerHeaders },
    );
    expect(removed.status).toBe(204);
    expect(await revoked).toMatchObject({ channelId: channelBody.channel.id });
    const cannotSendAfterRemoval = nextEvent(guestSocket, "error");
    guestSocket.send(
      JSON.stringify({
        type: "chat_message",
        channelId: channelBody.channel.id,
        content: "still here",
      }),
    );
    expect((await cannotSendAfterRemoval).code).toBe("FORBIDDEN");
    ownerSocket.close();
    guestSocket.close();
  });

  test("updates protected profiles, manages friendships and exchanges private messages", async () => {
    const alice = await register("social-alice@example.com", "Social Alice");
    const bob = await register("social-bob@example.com", "Social Bob");
    const aliceHeaders = { authorization: `Bearer ${alice.session.token}` };
    const bobHeaders = { authorization: `Bearer ${bob.session.token}` };
    const profile = await fetch(`${baseUrl}/profile`, {
      method: "PATCH",
      headers: { ...aliceHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        displayName: "Alice BR",
        countryCode: "BR",
      }),
    });
    expect(profile.status).toBe(200);
    expect(await profile.json()).toMatchObject({
      user: {
        displayName: "Alice BR",
        countryCode: "BR",
      },
    });
    const stored = await (
      await import("../../infra/database/client")
    ).db.user.findUniqueOrThrow({ where: { id: alice.user.id } });
    expect(stored.countryCode).toBe("BR");

    const requested = await fetch(`${baseUrl}/friends`, {
      method: "POST",
      headers: { ...aliceHeaders, "content-type": "application/json" },
      body: JSON.stringify({ email: "social-bob@example.com" }),
    });
    expect(requested.status).toBe(201);
    const accepted = await fetch(`${baseUrl}/friends/${alice.user.id}`, {
      method: "PATCH",
      headers: bobHeaders,
    });
    expect(accepted.status).toBe(204);
    const direct = await fetch(`${baseUrl}/direct-messages`, {
      method: "POST",
      headers: { ...aliceHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        recipientId: bob.user.id,
        content: "mensagem privada",
      }),
    });
    expect(direct.status).toBe(201);
    const history = await fetch(
      `${baseUrl}/direct-messages?userId=${alice.user.id}`,
      { headers: bobHeaders },
    );
    expect(await history.json()).toMatchObject({
      messages: [
        {
          content: "mensagem privada",
          senderId: alice.user.id,
          recipientId: bob.user.id,
        },
      ],
    });

    const { db } = await import("../../infra/database/client");
    const verificationCode = "123456";
    await db.emailToken.create({
      data: {
        userId: alice.user.id,
        purpose: "email_verification",
        codeHash: createHash("sha256").update(verificationCode).digest("hex"),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const verified = await fetch(`${baseUrl}/profile/verify-email`, {
      method: "POST",
      headers: { ...aliceHeaders, "content-type": "application/json" },
      body: JSON.stringify({ code: verificationCode }),
    });
    expect(verified.status).toBe(204);
    const enabled2fa = await fetch(`${baseUrl}/profile/two-factor`, {
      method: "POST",
      headers: { ...aliceHeaders, "content-type": "application/json" },
      body: JSON.stringify({ enabled: true }),
    });
    expect(enabled2fa.status).toBe(204);
    const challengeId = crypto.randomUUID();
    await db.emailToken.create({
      data: {
        id: challengeId,
        userId: alice.user.id,
        purpose: "two_factor",
        codeHash: createHash("sha256").update(verificationCode).digest("hex"),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const secondFactor = await fetch(`${baseUrl}/auth/2fa/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ challengeId, code: verificationCode }),
    });
    expect(secondFactor.status).toBe(200);
    expect(await secondFactor.json()).toMatchObject({
      user: { id: alice.user.id },
      session: { token: expect.any(String) },
    });
  });
});
