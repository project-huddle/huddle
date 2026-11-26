type MessageAnchor = { id: string; createdAt: Date };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

export function encodeDirectMessageCursor(
  userId: string,
  peerId: string,
  anchor: MessageAnchor,
) {
  return Buffer.from(
    JSON.stringify({
      pair: [userId, peerId].sort(),
      id: anchor.id,
      createdAt: anchor.createdAt.toISOString(),
    }),
  ).toString("base64url");
}

export function decodeDirectMessageCursor(
  cursor: string,
  userId: string,
  peerId: string,
): MessageAnchor | null {
  if (cursor.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(cursor)) return null;
  try {
    const value: unknown = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    );
    if (!value || typeof value !== "object") return null;
    const payload = value as Record<string, unknown>;
    const pair = [userId, peerId].sort();
    if (
      !Array.isArray(payload.pair) ||
      payload.pair.length !== 2 ||
      payload.pair[0] !== pair[0] ||
      payload.pair[1] !== pair[1]
    )
      return null;
    if (
      typeof payload.id !== "string" ||
      !uuid.test(payload.id) ||
      typeof payload.createdAt !== "string"
    )
      return null;
    const createdAt = new Date(payload.createdAt);
    if (
      !Number.isFinite(createdAt.getTime()) ||
      createdAt.toISOString() !== payload.createdAt
    )
      return null;
    return { id: payload.id, createdAt };
  } catch {
    return null;
  }
}
