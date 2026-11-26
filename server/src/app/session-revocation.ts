type SessionListener = { userId: string; revoke: () => void };
const listeners = new Map<string, Set<SessionListener>>();

export function observeSession(tokenHash: string, userId: string, revoke: () => void) {
  const entry = { userId, revoke };
  const current = listeners.get(tokenHash) ?? new Set<SessionListener>();
  current.add(entry);
  listeners.set(tokenHash, current);
  return () => {
    current.delete(entry);
    if (!current.size) listeners.delete(tokenHash);
  };
}

export function revokeSessionAccess(tokenHash: string) {
  const current = listeners.get(tokenHash);
  listeners.delete(tokenHash);
  for (const entry of current ?? []) entry.revoke();
}

export function revokeUserSessionAccess(userId: string) {
  for (const [tokenHash, current] of listeners) {
    if ([...current].some((entry) => entry.userId === userId)) revokeSessionAccess(tokenHash);
  }
}
