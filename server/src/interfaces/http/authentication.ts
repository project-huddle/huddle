import { createHash, randomBytes } from "node:crypto";
import { config } from "../../bootstrap/config";
import {
  createSession,
  deleteSession,
  userForSession,
  type User,
} from "../../infra/database/identity-repository";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function issueSession(
  userId: string,
): Promise<{ token: string; expiresAt: string }> {
  const token = randomBytes(32).toString("base64url");
  const expiry = Date.now() + config.sessionLifetimeSeconds * 1_000;
  await createSession(userId, hashToken(token), expiry);
  return { token, expiresAt: new Date(expiry).toISOString() };
}

export function bearerToken(request: Request): string | null {
  const value = request.headers.get("authorization");
  return value?.startsWith("Bearer ") ? value.slice(7).trim() || null : null;
}

export async function authenticate(request: Request): Promise<User | null> {
  const token = bearerToken(request);
  return token ? userForSession(hashToken(token)) : null;
}

export async function revoke(request: Request): Promise<void> {
  const token = bearerToken(request);
  if (token) await deleteSession(hashToken(token));
}
