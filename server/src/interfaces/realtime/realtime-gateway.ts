import type { ElysiaWS } from "elysia/ws";
import {
  channelForUser,
  firstChannelForUser,
} from "@/infra/database/server-repository";
import {
  deleteMessage,
  editMessage,
  messageForUser,
  reactMessage,
  saveMessage,
} from "@/infra/database/message-repository";
import type { User } from "@/infra/database/identity-repository";
import { FixedWindowRateLimiter } from "@/interfaces/rate-limit";
import { messageContent, messageMedia } from "@/app/validation";

type RealtimeSocket = ElysiaWS<any, any>;
type SocketSession = {
  user: User;
  callId: string | null;
  channelId: string | null;
  limiter: FixedWindowRateLimiter;
};
type WsMessage = Record<string, unknown> & { type?: unknown };

const socketsByUser = new Map<string, Set<RealtimeSocket>>();
const calls = new Map<string, Set<RealtimeSocket>>();
const websocketTickets = new Map<string, { expiresAt: number; user: User }>();
const sessions = new WeakMap<object, SocketSession>();

function session(ws: RealtimeSocket): SocketSession {
  const current = sessions.get(ws.raw);
  if (!current) throw new Error("WebSocket session is not initialized.");
  return current;
}

function send(ws: RealtimeSocket, value: unknown): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(value));
}

function broadcastChannel(channelId: string, value: unknown): void {
  for (const sockets of socketsByUser.values()) {
    for (const socket of sockets)
      if (session(socket).channelId === channelId) send(socket, value);
  }
}

export function notifyUser(userId: string, value: unknown): void {
  for (const socket of socketsByUser.get(userId) ?? []) send(socket, value);
}

function callKey(
  ws: RealtimeSocket,
  callId = session(ws).callId,
): string | null {
  return session(ws).channelId && callId
    ? `${session(ws).channelId}:${callId}`
    : null;
}

function leaveCall(ws: RealtimeSocket, removeUserSockets = false): void {
	const callId = session(ws).callId;
	if (!callId) return;
	const key = callKey(ws, callId);
	const peers = key ? calls.get(key) : undefined;
	const socketsToRemove = removeUserSockets
		? [...(peers ?? [])].filter(
			(peer) => session(peer).user.id === session(ws).user.id,
		  )
		: [ws];
	for (const socket of socketsToRemove) {
		peers?.delete(socket);
		session(socket).callId = null;
	}
	for (const peer of peers ?? [])
		send(peer, { type: "peer_left", callId, userId: session(ws).user.id });
	if (!peers?.size && key) calls.delete(key);
}

function leaveOtherCalls(userId: string, current: RealtimeSocket): void {
  for (const peers of calls.values()) {
    for (const peer of [...peers]) {
      if (peer === current || session(peer).user.id !== userId) continue;
      send(peer, { type: "call_replaced" });
      leaveCall(peer, true);
    }
  }
}

export function issueWebSocketTicket(user: User): string {
  const ticket = crypto.randomUUID();
  const now = Date.now();
  websocketTickets.set(ticket, { user, expiresAt: now + 30_000 });
  for (const [key, value] of websocketTickets) {
    if (value.expiresAt <= now) websocketTickets.delete(key);
  }
  return ticket;
}

export function consumeWebSocketTicket(ticket: string | null): User | null {
  if (!ticket) return null;
  const entry = websocketTickets.get(ticket);
  websocketTickets.delete(ticket);
  return entry && entry.expiresAt > Date.now() ? entry.user : null;
}

export function hasValidWebSocketTicket(
  ticket: string | null | undefined,
): boolean {
  if (!ticket) return false;
  const entry = websocketTickets.get(ticket);
  return Boolean(entry && entry.expiresAt > Date.now());
}

export async function revokeUnauthorizedSocketAccess(
  userId: string,
): Promise<void> {
  for (const socket of socketsByUser.get(userId) ?? []) {
    const channelId = session(socket).channelId;
    if (!channelId || (await channelForUser(userId, channelId))) continue;
    leaveCall(socket);
    session(socket).channelId = null;
    send(socket, { type: "access_revoked", channelId });
  }
}

export const realtimeWebSocket = {
  async open(ws: RealtimeSocket) {
    const ticket = String(ws.data.query?.ticket ?? "");
    const user = consumeWebSocketTicket(ticket);
    if (!user) return ws.close(1008, "Unauthorized");
    const current: SocketSession = {
      user,
      callId: null,
      channelId: null,
      limiter: new FixedWindowRateLimiter(120),
    };
    sessions.set(ws.raw, current);
    current.channelId = (await firstChannelForUser(user.id))?.id ?? null;
    const sockets = socketsByUser.get(session(ws).user.id) ?? new Set();
    sockets.add(ws);
    socketsByUser.set(session(ws).user.id, sockets);
    send(ws, { type: "ready", user: session(ws).user });
    const channelId = session(ws).channelId;
    if (channelId)
      broadcastChannel(channelId, {
        type: "presence",
        userId: session(ws).user.id,
        status: "online",
      });
  },
  async message(ws: RealtimeSocket, raw: unknown) {
    if (!session(ws).limiter.consume(session(ws).user.id))
      return send(ws, {
        type: "error",
        code: "RATE_LIMITED",
        message: "Too many events. Try again later.",
      });
    if (typeof raw !== "string" || raw.length > 100_000)
      return send(ws, {
        type: "error",
        code: "INVALID_EVENT",
        message: "Invalid event.",
      });
    let event: WsMessage;
    try {
      event = JSON.parse(raw);
    } catch {
      return send(ws, {
        type: "error",
        code: "INVALID_JSON",
        message: "Message must be valid JSON.",
      });
    }
    if (event.type === "chat_message") {
      const channelId =
        (typeof event.channelId === "string" && event.channelId) ||
        session(ws).channelId ||
        (await firstChannelForUser(session(ws).user.id))?.id ||
        "";
      const channel = await channelForUser(session(ws).user.id, channelId);
      if (!channel)
        return send(ws, {
          type: "error",
          code: "FORBIDDEN",
          message: "You cannot access this channel.",
        });
      if (channel.type === "voice")
        return send(ws, {
          type: "error",
          code: "INVALID_CHANNEL",
          message: "Voice channels do not contain messages.",
        });
      const content = messageContent(event.content, true);
      const media = messageMedia(event.media);
      if (content === null || (!content && !media))
        return send(ws, {
          type: "error",
          code: "INVALID_MESSAGE",
          message: `Message must contain text or valid media.`,
        });
      const reply =
        typeof event.replyToId === "string"
          ? await messageForUser(session(ws).user.id, event.replyToId)
          : null;
      const replyToId = reply?.channelId === channelId ? reply.id : null;
      const message = await saveMessage(
        session(ws).user,
        channelId,
        content,
        media,
        replyToId,
      );
      return broadcastChannel(channelId, { type: "chat_message", message });
    }
    if (
      ["edit_message", "delete_message", "react_message"].includes(
        String(event.type),
      )
    ) {
      const messageId =
        typeof event.messageId === "string" ? event.messageId : "";
      const target = messageId
        ? await messageForUser(session(ws).user.id, messageId)
        : null;
      if (!target || target.channelId !== session(ws).channelId)
        return send(ws, {
          type: "error",
          code: "NOT_FOUND",
          message: "Message not found.",
        });
      let message = null;
      if (event.type === "edit_message") {
        const content = messageContent(event.content);
        if (!content)
          return send(ws, {
            type: "error",
            code: "INVALID_MESSAGE",
            message: "Message content is invalid.",
          });
        message = await editMessage(session(ws).user.id, messageId, content);
      } else if (event.type === "delete_message")
        message = await deleteMessage(session(ws).user.id, messageId);
      else
        message =
          typeof event.emoji === "string"
            ? await reactMessage(session(ws).user.id, messageId, event.emoji)
            : null;
      if (!message)
        return send(ws, {
          type: "error",
          code: "FORBIDDEN",
          message:
            event.type === "react_message"
              ? "Could not react to this message."
              : "You can only change your own messages.",
        });
      return broadcastChannel(target.channelId, {
        type: event.type,
        message,
      });
    }
    if (event.type === "subscribe_channel") {
      const channelId =
        typeof event.channelId === "string" ? event.channelId : "";
      const channel = await channelForUser(session(ws).user.id, channelId);
      if (!channel)
        return send(ws, {
          type: "error",
          code: "FORBIDDEN",
          message: "You cannot access this channel.",
        });
      leaveCall(ws);
      session(ws).channelId = channelId;
      return send(ws, { type: "channel_subscribed", channelId });
    }
    if (event.type === "join_call") {
      const callId =
        typeof event.callId === "string" &&
        /^[a-zA-Z0-9_-]{1,64}$/.test(event.callId)
          ? event.callId
          : null;
      const key = callId ? callKey(ws, callId) : null;
      if (!callId || !key)
        return send(ws, {
          type: "error",
          code: "INVALID_CALL",
          message: "Select an authorized channel before joining a call.",
        });
      if (session(ws).callId === callId)
        return send(ws, {
          type: "call_joined",
          callId,
          peers: [...(calls.get(key) ?? [])]
            .filter(
              (peer) => session(peer).user.id !== session(ws).user.id,
            )
            .map((peer) => session(peer).user),
        });
      leaveCall(ws);
      leaveOtherCalls(session(ws).user.id, ws);
      const peers = calls.get(key) ?? new Set();
      peers.add(ws);
      calls.set(key, peers);
      session(ws).callId = callId;
      send(ws, {
        type: "call_joined",
        callId,
        peers: [...peers]
          .filter(
            (peer) => session(peer).user.id !== session(ws).user.id,
          )
          .map((peer) => session(peer).user),
      });
      for (const peer of peers)
        if (peer !== ws)
          send(peer, { type: "peer_joined", callId, user: session(ws).user });
      return;
    }
    if (event.type === "leave_call") {
      leaveCall(ws, true);
      return;
    }
    if (
      [
        "webrtc_offer",
        "webrtc_answer",
        "ice_candidate",
        "screen_share",
      ].includes(String(event.type))
    ) {
      const targetUserId =
        typeof event.targetUserId === "string" ? event.targetUserId : "";
      const key = callKey(ws);
      const peers = key ? calls.get(key) : null;
      const target = [...(peers ?? [])].find(
        (peer) => session(peer).user.id === targetUserId,
      );
      if (!target)
        return send(ws, {
          type: "error",
          code: "PEER_NOT_FOUND",
          message: "Target peer is not in this call.",
        });
      if (
        (event.type === "webrtc_offer" || event.type === "webrtc_answer") &&
        (!event.sdp || typeof event.sdp !== "object")
      )
        return send(ws, {
          type: "error",
          code: "INVALID_SDP",
          message: "Invalid session description.",
        });
      if (
        event.type === "ice_candidate" &&
        (!event.candidate || typeof event.candidate !== "object")
      )
        return send(ws, {
          type: "error",
          code: "INVALID_CANDIDATE",
          message: "Invalid ICE candidate.",
        });
      const forwarded: Record<string, unknown> = {
        type: event.type,
        callId: session(ws).callId,
        fromUserId: session(ws).user.id,
      };
      if (event.type === "webrtc_offer" || event.type === "webrtc_answer")
        forwarded.sdp = event.sdp;
      if (event.type === "ice_candidate") forwarded.candidate = event.candidate;
      if (event.type === "screen_share")
        forwarded.active = event.active === true;
      return send(target, forwarded);
    }
    send(ws, {
      type: "error",
      code: "UNKNOWN_EVENT",
      message: "Unknown event type.",
    });
  },
  close(ws: RealtimeSocket) {
    const current = sessions.get(ws.raw);
    if (!current) return;
    leaveCall(ws);
    const sockets = socketsByUser.get(session(ws).user.id);
    sockets?.delete(ws);
    if (!sockets?.size) {
      socketsByUser.delete(session(ws).user.id);
      const channelId = session(ws).channelId;
      if (channelId)
        broadcastChannel(channelId, {
          type: "presence",
          userId: session(ws).user.id,
          status: "offline",
        });
    }
  },
};
