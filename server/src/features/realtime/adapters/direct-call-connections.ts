import type {
  CallParticipant,
  DirectCall,
} from "@/core/direct-calls/direct-call-registry";

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
type Dependencies = {
  authorize: (callId: string, userId: string) => Promise<DirectCall | null>;
  isActive: (call: DirectCall) => boolean;
  end: (callId: string, userId: string) => DirectCall | null;
  schedule: (callback: () => void, delay: number) => number;
  cancel: (timer: number) => void;
};
const RECOVERY_GRACE_MS = 10_000;

function send(socket: DirectSocket, event: object) {
  if (socket.readyState === 1) socket.send(JSON.stringify(event));
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validSignal(event: Record<string, unknown>) {
  if (event.type === "webrtc_offer" || event.type === "webrtc_answer") {
    const expectedType = event.type === "webrtc_offer" ? "offer" : "answer";
    return (
      record(event.sdp) &&
      event.sdp.type === expectedType &&
      typeof event.sdp.sdp === "string" &&
      event.sdp.sdp.length > 0 &&
      event.sdp.sdp.length <= 1_000_000
    );
  }
  if (event.type === "ice_candidate") {
    const candidate = event.candidate;
    return (
      record(candidate) &&
      typeof candidate.candidate === "string" &&
      candidate.candidate.length <= 16_384 &&
      (candidate.sdpMid == null || typeof candidate.sdpMid === "string") &&
      (candidate.sdpMLineIndex == null ||
        (Number.isInteger(candidate.sdpMLineIndex) &&
          Number(candidate.sdpMLineIndex) >= 0))
    );
  }
  if (event.type === "screen_share") {
    return (
      typeof event.active === "boolean" &&
      (!event.active ||
        (typeof event.streamId === "string" &&
          event.streamId.length > 0 &&
          event.streamId.length <= 256))
    );
  }
  return false;
}

export class DirectCallGateway {
  private readonly subscriptions = new Map<object, Subscription>();
  private readonly retiredSockets = new WeakSet<object>();
  private readonly recoveries = new Map<
    string,
    { callId: string; timer: number }
  >();

  constructor(private readonly dependencies: Dependencies) {}

  private peers(callId: string) {
    return [...this.subscriptions.values()].filter(
      (entry) => entry.callId === callId && entry.joined,
    );
  }

  private recoveryKey(entry: Subscription) {
    return `${entry.callId}:${entry.user.id}`;
  }

  private cancelRecovery(entry: Subscription) {
    const key = this.recoveryKey(entry);
    const pending = this.recoveries.get(key);
    if (pending) this.dependencies.cancel(pending.timer);
    this.recoveries.delete(key);
  }

  private detach(entry: Subscription) {
    this.subscriptions.delete(entry.socket.raw);
    this.retiredSockets.add(entry.socket.raw);
    if (!entry.joined) return;
    for (const peer of this.peers(entry.callId))
      send(peer.socket, {
        type: "peer_left",
        callId: `channel-${entry.callId}`,
        userId: entry.user.id,
      });
  }

  close(callId: string) {
    for (const [key, pending] of this.recoveries) {
      if (pending.callId !== callId) continue;
      this.dependencies.cancel(pending.timer);
      this.recoveries.delete(key);
    }
    for (const [key, entry] of this.subscriptions) {
      if (entry.callId !== callId) continue;
      send(entry.socket, { type: "call_left", callId: `channel-${callId}` });
      this.subscriptions.delete(key);
      this.retiredSockets.add(key);
    }
  }

  private end(entry: Subscription, notify: Notify) {
    const call = this.dependencies.end(entry.callId, entry.user.id);
    this.close(entry.callId);
    if (!call) return;
    const event = { type: "direct_call_ended", call };
    notify(call.caller.id, event);
    notify(call.recipient.id, event);
  }

  disconnect(socket: DirectSocket, notify: Notify, intentional = false) {
    const entry = this.subscriptions.get(socket.raw);
    if (!entry) return;
    this.detach(entry);
    this.cancelRecovery(entry);
    if (intentional) {
      this.end(entry, notify);
      return;
    }
    const key = this.recoveryKey(entry);
    const timer = this.dependencies.schedule(() => {
      this.recoveries.delete(key);
      this.end(entry, notify);
    }, RECOVERY_GRACE_MS);
    this.recoveries.set(key, { callId: entry.callId, timer });
  }

  private async subscribe(
    socket: DirectSocket,
    user: CallParticipant,
    callId: string,
  ) {
    const call = await this.dependencies.authorize(callId, user.id);
    if (socket.readyState !== 1) return;
    if (
      !call ||
      call.status !== "accepted" ||
      !this.dependencies.isActive(call)
    ) {
      send(socket, {
        type: "error",
        message: "Você não possui acesso a esta chamada privada.",
      });
      return;
    }
    const current = this.subscriptions.get(socket.raw);
    if (current?.callId === callId) {
      send(socket, { type: "channel_subscribed", channelId: callId });
      return;
    }
    // Replacing media first makes the next join produce a fresh peer connection.
    for (const entry of this.subscriptions.values()) {
      if (entry.user.id !== user.id) continue;
      this.detach(entry);
      send(entry.socket, { type: "call_replaced" });
    }
    const entry = { socket, user, callId, joined: false, muted: false };
    this.cancelRecovery(entry);
    this.subscriptions.set(socket.raw, entry);
    this.retiredSockets.delete(socket.raw);
    send(socket, { type: "channel_subscribed", channelId: callId });
  }

  async handle(
    socket: DirectSocket,
    user: CallParticipant,
    event: Record<string, unknown>,
    notify: Notify,
  ): Promise<boolean> {
    if (event.type === "subscribe_direct_call") {
      await this.subscribe(
        socket,
        user,
        typeof event.callId === "string" ? event.callId : "",
      );
      return true;
    }
    const entry = this.subscriptions.get(socket.raw);
    if (!entry) return this.retiredSockets.has(socket.raw);
    const call = await this.dependencies.authorize(entry.callId, user.id);
    // A close or tab takeover may occur while authorization is in flight.
    if (this.subscriptions.get(socket.raw) !== entry) return true;
    if (
      !call ||
      call.status !== "accepted" ||
      !this.dependencies.isActive(call)
    ) {
      this.disconnect(socket, notify, true);
      send(socket, {
        type: "error",
        message: "A chamada privada foi encerrada.",
      });
      return true;
    }
    const callId = `channel-${entry.callId}`;
    if (event.callId !== undefined && event.callId !== callId) return true;
    if (event.type === "join_call") {
      if (entry.joined) return true;
      const existing = this.peers(entry.callId).filter(
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
      this.disconnect(socket, notify, true);
      send(socket, { type: "call_left", callId });
      return true;
    }
    if (!entry.joined) return true;
    if (event.type === "participant_state") {
      if (typeof event.muted !== "boolean") return true;
      entry.muted = event.muted;
      for (const peer of this.peers(entry.callId)) {
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
    if (!validSignal(event)) return true;
    const target = this.peers(entry.callId).find(
      (peer) => peer.user.id === event.targetUserId && peer.user.id !== user.id,
    );
    if (!target) return true;
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
}
