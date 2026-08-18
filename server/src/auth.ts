import { createHash, randomBytes } from "node:crypto";
import { config } from "./config";
import { createSession, deleteSession, userForSession, type User } from "./database";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function issueSession(userId: string): { token: string; expiresAt: string } {
  const token = randomBytes(32).toString("base64url");
  const expiry = Date.now() + config.sessionLifetimeSeconds * 1_000;
  createSession(userId, hashToken(token), expiry);
  return { token, expiresAt: new Date(expiry).toISOString() };
}

export function bearerToken(request: Request): string | null {
  const value = request.headers.get("authorization");
  return value?.startsWith("Bearer ") ? value.slice(7).trim() || null : null;
}

export function authenticate(request: Request): User | null {
  const token = bearerToken(request);
  return token ? userForSession(hashToken(token)) : null;
}

export function revoke(request: Request): void {
  const token = bearerToken(request);
  if (token) deleteSession(hashToken(token));
}
