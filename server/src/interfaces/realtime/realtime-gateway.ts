import type { ElysiaWS } from "elysia/ws";
import {
  channelForUser,
  firstChannelForUser,
  hasServerPermission,
} from "@/infra/database/server-repository";
import { db } from "@/infra/database/mappers";
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
  muted: boolean;
  serverMuted: boolean;
  serverId: string | null;
};
type WsMessage = Record<string, unknown> & { type?: unknown };

const socketsByUser = new Map<string, Set<RealtimeSocket>>();
const calls = new Map<string, Set<RealtimeSocket>>();
const voicePresenceRevisions = new Map<string, number>();
const websocketTickets = new Map<string, { expiresAt: number; user: User }>();
const sessions = new WeakMap<object, SocketSession>();
const CALL_REPLACED_CLOSE_CODE = 4001;

function session(ws: RealtimeSocket): SocketSession {
  const current = sessions.get(ws.raw);
  if (!current) throw new Error("WebSocket session is not initialized.");
  return current;
}

function send(ws: RealtimeSocket, value: unknown): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(value));
}

function sdpSendsMedia(sdp: unknown, media: "audio" | "video"): boolean {
  if (!sdp || typeof sdp !== "object" || !("sdp" in sdp) || typeof sdp.sdp !== "string") return false;
  const section = sdp.sdp.split(/\r?\nm=/).find((item) => item.startsWith(`${media} `));
  if (!section) return false;
  const direction = section.match(/(?:^|\r?\n)(sendrecv|sendonly|recvonly|inactive)(?:\r?\n|$)/)?.[1];
  return direction === undefined || direction === "sendrecv" || direction === "sendonly";
}

function broadcastChannel(channelId: string, value: unknown): void {
  for (const sockets of socketsByUser.values()) {
    for (const socket of sockets)
      if (session(socket).channelId === channelId) send(socket, value);
  }
}

function broadcastServer(serverId: string, value: unknown): void {
  for (const sockets of socketsByUser.values()) for (const socket of sockets)
    if (session(socket).serverId === serverId) send(socket, value);
}

async function mentionedUserIds(serverId: string, content: string): Promise<string[]> {
	const members = await db.serverMember.findMany({
		where: { serverId },
		select: { userId: true, user: { select: { displayName: true } } },
	});
	return members
		.filter(({ user }) => {
			const escapedName = user.displayName.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&");
			const mentionPattern = new RegExp(`(^|\\s)@${escapedName}(?=\\s|$|[.,!?])`, "iu");
			return mentionPattern.test(content);
		})
		.map(({ userId }) => userId);
}

async function serverIdsForUser(userId: string): Promise<string[]> {
  const servers = await db.server.findMany({
    where: { members: { some: { userId } } },
    select: { id: true },
  });
  return servers.map(({ id }) => id);
}

async function broadcastPresenceForUser(
  userId: string,
  status: "online" | "offline",
): Promise<void> {
  const value = { type: "presence", userId, status };
  for (const serverId of await serverIdsForUser(userId))
    broadcastServer(serverId, value);
}

async function sendPresenceSnapshot(
  ws: RealtimeSocket,
  serverId: string,
): Promise<void> {
  const onlineUserIds = [...socketsByUser.keys()];
  if (!onlineUserIds.length) return;
  const members = await db.serverMember.findMany({
    where: { serverId, userId: { in: onlineUserIds } },
    select: { userId: true },
  });
  send(ws, {
    type: "presence_snapshot",
    userIds: members.map(({ userId }) => userId),
  });
}

function broadcastVoicePresence(channelId: string, serverId: string, users: RealtimeSocket[]): void {
  const revision = (voicePresenceRevisions.get(channelId) ?? 0) + 1;
  voicePresenceRevisions.set(channelId, revision);
  broadcastServer(serverId, { type: "voice_presence", channelId, revision, users: users.map((peer) => session(peer).user) });
}

export function notifyUser(userId: string, value: unknown): void {
  for (const socket of socketsByUser.get(userId) ?? []) send(socket, value);
}

export type ServerDataResource = "servers" | "channels" | "members" | "roles";

/** Notify every connected member that a server-backed collection changed. */
export async function notifyServerDataChanged(
  serverId: string,
  resources: ServerDataResource[],
): Promise<void> {
  await notifyServerMembers(serverId, {
    type: "server_data_changed",
    serverId,
    resources,
  });
}

async function notifyServerMembers(serverId: string, value: unknown): Promise<void> {
	const members = await db.serverMember.findMany({
		where: { serverId },
		select: { userId: true },
	});
	for (const { userId } of members) notifyUser(userId, value);
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
    session(socket).muted = false;
    session(socket).serverMuted = false;
  }
  for (const peer of peers ?? [])
    send(peer, { type: "peer_left", callId, userId: session(ws).user.id });
  if (!peers?.size && key) calls.delete(key);
}

function leaveCallAndBroadcast(ws: RealtimeSocket, removeUserSockets = false): void {
  const { callId, channelId, serverId } = session(ws);
  leaveCall(ws, removeUserSockets);

  if (!callId || !channelId || !serverId) return;

  const remainingPeers = calls.get(`${channelId}:${callId}`) ?? new Set();
  broadcastVoicePresence(channelId, serverId, [...remainingPeers]);
}

function leaveOtherCalls(userId: string, current: RealtimeSocket): void {
  for (const peers of calls.values()) {
    for (const peer of [...peers]) {
      if (peer === current || session(peer).user.id !== userId) continue;
      send(peer, { type: "call_replaced" });
      leaveCallAndBroadcast(peer, true);
      peer.close(CALL_REPLACED_CLOSE_CODE, "Call session replaced");
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
    leaveCallAndBroadcast(socket);
    session(socket).channelId = null;
    send(socket, { type: "access_revoked", channelId });
  }
}

export function revokeChannelSocketAccess(channelId: string): void {
  for (const sockets of socketsByUser.values()) {
    for (const socket of sockets) {
      if (session(socket).channelId !== channelId) continue;
      leaveCallAndBroadcast(socket);
      session(socket).channelId = null;
      send(socket, { type: "access_revoked", channelId });
    }
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
      muted: false,
      serverMuted: false,
      serverId: null,
    };
    sessions.set(ws.raw, current);
    const firstChannel = await firstChannelForUser(user.id);
    current.channelId = firstChannel?.id ?? null;
    current.serverId = firstChannel?.serverId ?? null;
    const sockets = socketsByUser.get(session(ws).user.id) ?? new Set();
    const wasOffline = sockets.size === 0;
    sockets.add(ws);
    socketsByUser.set(session(ws).user.id, sockets);
    send(ws, { type: "ready", user: session(ws).user });
    if (wasOffline) void broadcastPresenceForUser(session(ws).user.id, "online");
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
          message: "Você não possui permissão para acessar este canal.",
        });
      if (channel.type === "voice")
        return send(ws, {
          type: "error",
          code: "INVALID_CHANNEL",
          message: "Voice channels do not contain messages.",
        });
      if (!(await hasServerPermission(session(ws).user.id, channel.serverId, "messages.send")))
        return send(ws, { type: "error", code: "FORBIDDEN", message: "Você não possui permissão para enviar mensagens." });
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
      broadcastChannel(channelId, { type: "chat_message", message });
      const mentioned = await mentionedUserIds(channel.serverId, message.content);
      await notifyServerMembers(channel.serverId, {
        type: "server_notification",
        serverId: channel.serverId,
        channelId,
        message,
        mentionedUserIds: mentioned,
      });
      return;
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
      const targetChannel = await channelForUser(session(ws).user.id, target.channelId);
      const canModerate = Boolean(targetChannel && await hasServerPermission(session(ws).user.id, targetChannel.serverId, "messages.moderate"));
      if (event.type === "edit_message") {
        const content = messageContent(event.content);
        if (!content)
          return send(ws, {
            type: "error",
            code: "INVALID_MESSAGE",
            message: "Message content is invalid.",
          });
        message = await editMessage(session(ws).user.id, messageId, content, canModerate);
      } else if (event.type === "delete_message")
        message = await deleteMessage(session(ws).user.id, messageId, canModerate);
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
          message: "Você não possui permissão para acessar este canal.",
        });
      leaveCallAndBroadcast(ws);
      session(ws).channelId = channelId;
      session(ws).serverId = channel.serverId;
      await sendPresenceSnapshot(ws, channel.serverId);
      for (const peers of calls.values()) {
        const active = [...peers].filter((peer) => session(peer).serverId === channel.serverId);
        if (!active.length) continue;
        const activeChannelId = session(active[0]!).channelId;
        if (!activeChannelId) continue;
        send(ws, {
          type: "voice_presence",
          channelId: activeChannelId,
          revision: voicePresenceRevisions.get(activeChannelId) ?? 0,
          users: active.map((peer) => session(peer).user),
        });
      }
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
      const subscribedChannelId = session(ws).channelId;
      const callChannel = subscribedChannelId
        ? await channelForUser(session(ws).user.id, subscribedChannelId)
        : null;
      if (!callChannel || !(await hasServerPermission(session(ws).user.id, callChannel.serverId, "voice.connect")))
        return send(ws, { type: "error", code: "FORBIDDEN", message: "Você não possui permissão para entrar nesta chamada." });
      if (session(ws).callId === callId)
        return send(ws, {
          type: "call_joined",
          callId,
      peers: [...(calls.get(key) ?? [])]
            .filter((peer) => session(peer).user.id !== session(ws).user.id)
            .map((peer) => ({ user: session(peer).user, muted: session(peer).muted || session(peer).serverMuted, serverMuted: session(peer).serverMuted })),
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
          .filter((peer) => session(peer).user.id !== session(ws).user.id)
          .map((peer) => ({ user: session(peer).user, muted: session(peer).muted || session(peer).serverMuted, serverMuted: session(peer).serverMuted })),
      });
      for (const peer of peers)
        if (peer !== ws)
          send(peer, { type: "peer_joined", callId, user: session(ws).user, muted: session(ws).muted || session(ws).serverMuted, serverMuted: session(ws).serverMuted });
      broadcastVoicePresence(session(ws).channelId!, session(ws).serverId!, [...peers]);
      return;
    }
    if (event.type === "leave_call") {
      const callId = session(ws).callId;
      leaveCallAndBroadcast(ws, true);
      return send(ws, { type: "call_left", callId });
    }
    if (event.type === "participant_mute") {
      const channel = session(ws).channelId ? await channelForUser(session(ws).user.id, session(ws).channelId!) : null;
      if (!channel || !(await hasServerPermission(session(ws).user.id, channel.serverId, "voice.moderate_mute")))
        return send(ws, { type: "error", code: "FORBIDDEN", message: "Você não possui permissão para silenciar participantes." });
      const targetUserId = typeof event.targetUserId === "string" ? event.targetUserId : "";
      const target = [...(calls.get(callKey(ws) ?? "") ?? [])].find((peer) => session(peer).user.id === targetUserId);
      if (!target) return send(ws, { type: "error", code: "PEER_NOT_FOUND", message: "O participante não está nesta chamada." });
      const serverMuted = event.muted === true;
      session(target).serverMuted = serverMuted;
      for (const peer of calls.get(callKey(ws) ?? "") ?? []) send(peer, { type: "participant_state", callId: session(ws).callId, userId: targetUserId, muted: session(target).muted || serverMuted, serverMuted });
      return;
    }
    if (event.type === "participant_state") {
      const targetUserId = session(ws).user.id;
      session(ws).muted = event.muted === true;
      for (const peer of calls.get(callKey(ws) ?? "") ?? []) if (peer !== ws) send(peer, { type: "participant_state", callId: session(ws).callId, userId: targetUserId, muted: session(ws).muted || session(ws).serverMuted, serverMuted: session(ws).serverMuted });
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
      const subscribedChannelId = session(ws).channelId;
      const currentChannel = subscribedChannelId
        ? await channelForUser(session(ws).user.id, subscribedChannelId)
        : null;
      if (!currentChannel)
        return send(ws, { type: "error", code: "FORBIDDEN", message: "Você não possui acesso a este canal." });
      if (event.type === "webrtc_offer" || event.type === "webrtc_answer") {
        if (sdpSendsMedia(event.sdp, "audio") && !(await hasServerPermission(session(ws).user.id, currentChannel.serverId, "voice.speak")))
          return send(ws, { type: "error", code: "FORBIDDEN", message: "Você não possui permissão para usar o microfone." });
        if (sdpSendsMedia(event.sdp, "video") && !(await hasServerPermission(session(ws).user.id, currentChannel.serverId, "voice.camera")))
          return send(ws, { type: "error", code: "FORBIDDEN", message: "Você não possui permissão para usar a câmera." });
      }
      if (event.type === "screen_share") {
        if (!currentChannel || !(await hasServerPermission(session(ws).user.id, currentChannel.serverId, "voice.screen_share")))
          return send(ws, { type: "error", code: "FORBIDDEN", message: "Você não possui permissão para compartilhar a tela." });
      }
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
    leaveCallAndBroadcast(ws);
    const sockets = socketsByUser.get(session(ws).user.id);
    sockets?.delete(ws);
    if (!sockets?.size) {
      socketsByUser.delete(session(ws).user.id);
      void broadcastPresenceForUser(session(ws).user.id, "offline");
    }
  },
};
