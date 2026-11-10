import { describe, expect, test } from "bun:test";
import { DirectCallRegistry, type CallParticipant } from "../../../src/core/direct-calls/direct-call-registry";

function participant(id: string): CallParticipant {
  return { id, displayName: id, email: `${id}@example.com`, avatarUrl: null, createdAt: "2026-01-01T00:00:00.000Z" };
}

const alice = participant("alice");
const bob = participant("bob");
const outsider = participant("outsider");

describe("private call lifecycle", () => {
  test("only the recipient can accept a ringing call", () => {
    const calls = new DirectCallRegistry();
    calls.invite("call", alice, bob, 1000);
    expect(calls.accept("call", alice.id, 1001)).toBeNull();
    expect(calls.accept("call", outsider.id, 1001)).toBeNull();
    expect(calls.accept("call", bob.id, 1001)?.status).toBe("accepted");
    expect(calls.accept("call", bob.id, 1002)).toBeNull();
  });

  test("outsiders cannot inspect or end a call", () => {
    const calls = new DirectCallRegistry();
    calls.invite("call", alice, bob, 1000);
    expect(calls.forParticipant("call", outsider.id, 1001)).toBeNull();
    expect(calls.end("call", outsider.id)).toBeNull();
    expect(calls.forParticipant("call", alice.id, 1001)).not.toBeNull();
  });

  test("busy participants cannot receive a second invitation", () => {
    const calls = new DirectCallRegistry();
    calls.invite("call", alice, bob, 1000);
    expect(calls.invite("another", outsider, bob, 1001)).toBeNull();
    calls.end("call", bob.id);
    expect(calls.invite("another", outsider, bob, 1002)).not.toBeNull();
  });

  test("unanswered calls expire and accepted calls remain active", () => {
    const calls = new DirectCallRegistry();
    calls.invite("expired", alice, bob, 1000);
    expect(calls.accept("expired", bob.id, 31000)).toBeNull();
    expect(calls.expire("expired", 31000)?.id).toBe("expired");
    calls.invite("active", alice, bob, 32000);
    calls.accept("active", bob.id, 32001);
    expect(calls.expire("active", 100000)).toBeNull();
    expect(calls.forParticipant("active", alice.id, 100000)?.status).toBe("accepted");
  });
});
