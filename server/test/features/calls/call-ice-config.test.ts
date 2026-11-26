import { createHmac } from "node:crypto";
import { expect, test } from "bun:test";
import { createCallIceConfig } from "../../../src/features/calls/application/call-ice-config";

const settings = {
  turnUrl: "turn:relay.example.test:3478",
  turnSharedSecret: "test-only-shared-secret",
  turnCredentialLifetimeSeconds: 600,
};

test("issues user-bound TURN credentials with a bounded expiry and verifiable HMAC", () => {
  const now = 1_800_000_000_250;
  const result = createCallIceConfig("user-a", settings, now);
  const relay = result.iceServers[1];
  expect(result.expiresAt).toBe(new Date(1_800_000_600_000).toISOString());
  expect(relay?.urls).toBe(settings.turnUrl);
  expect(relay?.username).toBe("1800000600:user-a");
  expect(relay?.credential).toBe(createHmac("sha1", settings.turnSharedSecret)
    .update("1800000600:user-a").digest("base64"));
  expect(JSON.stringify(result)).not.toContain(settings.turnSharedSecret);
  expect(createCallIceConfig("user-b", settings, now).iceServers[1]?.credential)
    .not.toBe(relay?.credential);
});

test("refreshing after expiry issues a new expiring credential", () => {
  const first = createCallIceConfig("user-a", settings, 1_800_000_000_000);
  const next = createCallIceConfig("user-a", settings, 1_800_000_601_000);
  expect(next.iceServers[1]?.username).toBe("1800001201:user-a");
  expect(next.iceServers[1]?.credential).not.toBe(first.iceServers[1]?.credential);
});

test("uses STUN without exposing relay authentication when TURN is unconfigured", () => {
  expect(createCallIceConfig("user-a", {
    ...settings, turnUrl: null, turnSharedSecret: null,
  }, 0)).toEqual({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    expiresAt: null,
  });
});
