import { describe, expect, test } from "bun:test";
import {
  DirectCallRegistry,
  type CallParticipant,
} from "../../../src/core/direct-calls/direct-call-registry";
import { DirectCallGateway } from "../../../src/features/realtime/adapters/direct-call-connections";

const user = (id: string): CallParticipant => ({
  id,
  displayName: id,
  username: id,
  avatarUrl: null,
  createdAt: "2026-01-01",
});
const alice = user("alice");
const bob = user("bob");
function socket() {
  const events: Record<string, unknown>[] = [];
  return {
    raw: {},
    readyState: 1,
    events,
    send: (message: string) => events.push(JSON.parse(message)),
  };
}
function fixture() {
  const calls = new DirectCallRegistry();
  calls.invite("call", alice, bob, 0);
  calls.accept("call", bob.id, 1);
  const timers = new Map<number, () => void>();
  let timerId = 0;
  const gateway = new DirectCallGateway({
    authorize: async (id, userId) => calls.forParticipant(id, userId, 2),
    isActive: (call) =>
      calls.forParticipant(call.id, call.caller.id, 2) === call,
    end: (id, userId) => calls.end(id, userId),
    schedule: (callback, delay) => {
      expect(delay).toBe(10_000);
      timers.set(++timerId, callback);
      return timerId;
    },
    cancel: (id) => {
      timers.delete(id);
    },
  });
  const notifications: unknown[] = [];
  const notify = (_id: string, event: unknown) => {
    notifications.push(event);
  };
  const join = async (
    connection: ReturnType<typeof socket>,
    participant: CallParticipant,
  ) => {
    await gateway.handle(
      connection,
      participant,
      { type: "subscribe_direct_call", callId: "call" },
      notify,
    );
    await gateway.handle(
      connection,
      participant,
      { type: "join_call" },
      notify,
    );
  };
  const expire = () => {
    const pending = [...timers.values()];
    timers.clear();
    pending.forEach((callback) => callback());
  };
  return { calls, gateway, timers, notifications, notify, join, expire };
}

describe("direct call transport recovery", () => {
  test("a closed transport preserves the call until the recovery deadline", async () => {
    const f = fixture();
    const a = socket();
    const b = socket();
    await f.join(a, alice);
    await f.join(b, bob);
    f.gateway.disconnect(a, f.notify);
    expect(f.calls.forParticipant("call", alice.id, 2)?.status).toBe(
      "accepted",
    );
    expect(b.events.at(-1)?.type).toBe("peer_left");
    expect(f.notifications).toHaveLength(0);
    f.expire();
    expect(f.calls.forParticipant("call", alice.id, 2)).toBeNull();
    expect(f.notifications).toHaveLength(2);
    expect(b.events.at(-1)?.type).toBe("call_left");
  });

  test("reconnect cancels expiry and joins with exactly one peer", async () => {
    const f = fixture();
    const a = socket();
    const b = socket();
    const replacement = socket();
    await f.join(a, alice);
    await f.join(b, bob);
    f.gateway.disconnect(a, f.notify);
    await f.join(replacement, alice);
    expect(f.timers.size).toBe(0);
    f.expire();
    expect(f.calls.forParticipant("call", alice.id, 2)).not.toBeNull();
    expect(replacement.events.at(-1)?.peers).toEqual([
      { user: bob, muted: false },
    ]);
    expect(b.events.slice(-2).map((event) => event.type)).toEqual([
      "peer_left",
      "peer_joined",
    ]);
  });

  test("tab takeover replaces old media and its later close cannot end the call", async () => {
    const f = fixture();
    const a = socket();
    const b = socket();
    const replacement = socket();
    await f.join(a, alice);
    await f.join(b, bob);
    await f.join(replacement, alice);
    expect(a.events.at(-1)?.type).toBe("call_replaced");
    f.gateway.disconnect(a, f.notify);
    expect(f.timers.size).toBe(0);
    expect(b.events.slice(-2).map((event) => event.type)).toEqual([
      "peer_left",
      "peer_joined",
    ]);
    expect(replacement.events.at(-1)?.peers).toEqual([
      { user: bob, muted: false },
    ]);
  });

  test("explicit leave and revocation end immediately and clear all timers", async () => {
    for (const action of ["leave", "revoke"] as const) {
      const f = fixture();
      const a = socket();
      const b = socket();
      await f.join(a, alice);
      await f.join(b, bob);
      f.gateway.disconnect(a, f.notify);
      if (action === "leave")
        await f.gateway.handle(b, bob, { type: "leave_call" }, f.notify);
      else f.gateway.disconnect(b, f.notify, true);
      expect(f.timers.size).toBe(0);
      expect(f.calls.forParticipant("call", alice.id, 2)).toBeNull();
      const replacement = socket();
      await f.join(replacement, alice);
      expect(
        replacement.events.some((event) => event.type === "call_joined"),
      ).toBe(false);
    }
  });

  test("ending during subscribe authorization cannot resurrect the call", async () => {
    const f = fixture();
    const a = socket();
    const pending = f.gateway.handle(
      a,
      alice,
      { type: "subscribe_direct_call", callId: "call" },
      f.notify,
    );
    f.calls.end("call", alice.id);
    f.gateway.close("call");
    await pending;
    expect(a.events.map((event) => event.type)).toEqual(["error"]);
  });

  test("a transport close during signaling authorization drops the event", async () => {
    const f = fixture();
    const a = socket();
    const b = socket();
    await f.join(a, alice);
    await f.join(b, bob);
    const pending = f.gateway.handle(
      a,
      alice,
      {
        type: "webrtc_offer",
        targetUserId: bob.id,
        sdp: { type: "offer", sdp: "sdp" },
      },
      f.notify,
    );
    f.gateway.disconnect(a, f.notify);
    await pending;
    expect(b.events.at(-1)?.type).toBe("peer_left");
    expect(
      await f.gateway.handle(a, alice, { type: "join_call" }, f.notify),
    ).toBe(true);
  });

  test("closing a call cancels both participants' pending recoveries", async () => {
    const f = fixture();
    const a = socket();
    const b = socket();
    await f.join(a, alice);
    await f.join(b, bob);
    f.gateway.disconnect(a, f.notify);
    f.gateway.disconnect(b, f.notify);
    expect(f.timers.size).toBe(2);
    f.gateway.close("call");
    expect(f.timers.size).toBe(0);
    f.expire();
    expect(f.notifications).toHaveLength(0);
  });

  test("rejects invalid signaling and cannot deliver to self or an outsider", async () => {
    const f = fixture();
    const a = socket();
    const b = socket();
    await f.join(a, alice);
    await f.join(b, bob);
    const before = b.events.length;
    for (const event of [
      { type: "webrtc_offer", targetUserId: bob.id, sdp: {} },
      {
        type: "webrtc_answer",
        targetUserId: bob.id,
        sdp: { type: "offer", sdp: "sdp" },
      },
      { type: "ice_candidate", targetUserId: bob.id, candidate: [] },
      { type: "screen_share", targetUserId: bob.id, active: true },
      { type: "participant_state", muted: "yes" },
      {
        type: "webrtc_offer",
        targetUserId: alice.id,
        sdp: { type: "offer", sdp: "sdp" },
      },
      {
        type: "webrtc_offer",
        targetUserId: "outsider",
        sdp: { type: "offer", sdp: "sdp" },
      },
      {
        type: "webrtc_offer",
        callId: "channel-other",
        targetUserId: bob.id,
        sdp: { type: "offer", sdp: "sdp" },
      },
    ])
      await f.gateway.handle(a, alice, event, f.notify);
    expect(b.events).toHaveLength(before);
    await f.gateway.handle(
      a,
      alice,
      {
        type: "webrtc_offer",
        targetUserId: bob.id,
        sdp: { type: "offer", sdp: "sdp" },
      },
      f.notify,
    );
    expect(b.events.at(-1)?.type).toBe("webrtc_offer");
  });
});
