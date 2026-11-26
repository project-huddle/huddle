import { createHmac } from "node:crypto";

export type CallIceSettings = {
  turnUrl: string | null;
  turnSharedSecret: string | null;
  turnCredentialLifetimeSeconds: number;
};

type IceServer = { urls: string; username?: string; credential?: string };
export type CallIceConfig = {
  iceServers: IceServer[];
  expiresAt: string | null;
};

export function createCallIceConfig(
  userId: string,
  settings: CallIceSettings,
  now: number,
): CallIceConfig {
  const iceServers: IceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
  if (!settings.turnUrl || !settings.turnSharedSecret) {
    return { iceServers, expiresAt: null };
  }

  const expiresAt = Math.floor(now / 1000) + settings.turnCredentialLifetimeSeconds;
  const username = `${expiresAt}:${userId}`;
  // coturn's REST authentication format uses a timestamp and HMAC-SHA1.
  const credential = createHmac("sha1", settings.turnSharedSecret)
    .update(username)
    .digest("base64");
  iceServers.push({ urls: settings.turnUrl, username, credential });
  return { iceServers, expiresAt: new Date(expiresAt * 1000).toISOString() };
}
