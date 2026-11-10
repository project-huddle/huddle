import { authorizedDirectCall, directCalls } from "@/app/direct-call-service";
import type { CallParticipant } from "@/core/direct-calls/direct-call-registry";

type DirectSocket = {
  raw: object;
  readyState: number;
  send: (message: string) => unknown;
};
type Subscription = {
  socket: DirectSocket;
  user: CallParticipant;
  callId: string;
  joined: boolean;
  muted: boolean;
};
type Notify = (userId: string, event: unknown) => void;
const subscriptions = new Map<object, Subscription>();
const signalingTypes = new Set([
  "webrtc_offer",
  "webrtc_answer",
  "ice_candidate",
  "screen_share",
  "participant_state",
]);

function send(socket: DirectSocket, event: object) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(event));
}

function peers(callId: string) {
  return [...subscriptions.values()].filter(
    (entry) => entry.callId === callId && entry.joined,
  );
}

export function closeDirectCall(callId: string) {
  for (const [key, entry] of subscriptions) {
    if (entry.callId !== callId) continue;
    send(entry.socket, { type: "call_left", callId: `channel-${callId}` });
    subscriptions.delete(key);
  }
}

export function disconnectDirectCall(socket: DirectSocket, notify: Notify) {
  const entry = subscriptions.get(socket.raw);
  if (!entry) return;
  subscriptions.delete(socket.raw);
  const call = directCalls.end(entry.callId, entry.user.id);
  closeDirectCall(entry.callId);
  if (call) {
    const event = { type: "direct_call_ended", call };
    notify(call.caller.id, event);
    notify(call.recipient.id, event);
  }
}

export async function handleDirectCallEvent(
  socket: DirectSocket,
  user: CallParticipant,
  event: Record<string, unknown>,
  notify: Notify,
): Promise<boolean> {
  if (event.type === "subscribe_direct_call") {
    const callId = typeof event.callId === "string" ? event.callId : "";
    const call = await authorizedDirectCall(callId, user.id);
    if (!call) {
      send(socket, {
        type: "error",
        message: "Você não possui acesso a esta chamada privada.",
      });
      return true;
    }
    // One media connection per participant, including across tabs.
    for (const entry of subscriptions.values()) {
      if (entry.user.id !== user.id || entry.socket.raw === socket.raw)
        continue;
      send(entry.socket, { type: "call_replaced" });
      subscriptions.delete(entry.socket.raw);
    }
    subscriptions.set(socket.raw, {
      socket,
      user,
      callId,
      joined: false,
      muted: false,
    });
    send(socket, { type: "channel_subscribed", channelId: callId });
    return true;
  }

  const entry = subscriptions.get(socket.raw);
  if (!entry) return false;
  if (!(await authorizedDirectCall(entry.callId, user.id))) {
    disconnectDirectCall(socket, notify);
    send(socket, {
      type: "error",
      message: "A chamada privada foi encerrada.",
    });
    return true;
  }
  const callId = `channel-${entry.callId}`;
  if (event.type === "join_call") {
    if (entry.joined) return true;
    const existing = peers(entry.callId).filter(
      (peer) => peer.user.id !== user.id,
    );
    entry.joined = true;
    send(socket, {
      type: "call_joined",
      callId,
      peers: existing.map((peer) => ({ user: peer.user, muted: peer.muted })),
    });
    for (const peer of existing)
      send(peer.socket, { type: "peer_joined", callId, user });
    return true;
  }
  if (event.type === "leave_call") {
    disconnectDirectCall(socket, notify);
    send(socket, { type: "call_left", callId });
    return true;
  }
  if (!entry.joined || !signalingTypes.has(String(event.type))) return true;
  if (event.type === "participant_state") {
    entry.muted = event.muted === true;
    for (const peer of peers(entry.callId)) {
      if (peer !== entry)
        send(peer.socket, {
          type: "participant_state",
          callId,
          userId: user.id,
          muted: entry.muted,
        });
    }
    return true;
  }
  const target = peers(entry.callId).find(
    (peer) => peer.user.id === event.targetUserId && peer.user.id !== user.id,
  );
  if (!target) return true;
  if (
    (event.type === "webrtc_offer" || event.type === "webrtc_answer") &&
    (!event.sdp || typeof event.sdp !== "object")
  )
    return true;
  if (
    event.type === "ice_candidate" &&
    (!event.candidate || typeof event.candidate !== "object")
  )
    return true;
  send(target.socket, {
    type: event.type,
    callId,
    fromUserId: user.id,
    sdp: event.sdp,
    candidate: event.candidate,
    active: event.active === true,
    streamId: event.streamId,
  });
  return true;
}
