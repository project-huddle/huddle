import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Database } from "bun:sqlite";
import { config } from "./config";

mkdirSync(dirname(config.databasePath), { recursive: true });
export const db = new Database(config.databasePath, { create: true, strict: true });
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, display_name TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL, created_at TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
  CREATE TABLE IF NOT EXISTS servers (id TEXT PRIMARY KEY, name TEXT NOT NULL, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS server_members (server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at TEXT NOT NULL, PRIMARY KEY (server_id, user_id));
  CREATE TABLE IF NOT EXISTS invites (code TEXT PRIMARY KEY, server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE, created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at TEXT NOT NULL, expires_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS channels (id TEXT PRIMARY KEY, server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE, name TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'text', created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, channel_id TEXT REFERENCES channels(id), content TEXT NOT NULL, created_at TEXT NOT NULL, edited_at TEXT, deleted_at TEXT, reply_to_id TEXT REFERENCES messages(id), reactions_json TEXT NOT NULL DEFAULT '{}', media_url TEXT, media_type TEXT, media_alt TEXT);
  CREATE INDEX IF NOT EXISTS messages_created_idx ON messages(channel_id, created_at DESC, id DESC);
  CREATE INDEX IF NOT EXISTS server_members_user_idx ON server_members(user_id);
  CREATE INDEX IF NOT EXISTS channels_server_idx ON channels(server_id, created_at);
`);

const messageColumns = db.query("PRAGMA table_info(messages)").all() as Array<{ name: string }>;
for (const [name, definition] of [["media_url", "TEXT"], ["media_type", "TEXT"], ["media_alt", "TEXT"], ["channel_id", "TEXT REFERENCES channels(id)"], ["edited_at", "TEXT"], ["deleted_at", "TEXT"], ["reply_to_id", "TEXT REFERENCES messages(id)"], ["reactions_json", "TEXT NOT NULL DEFAULT '{}' "]] as const) {
  if (!messageColumns.some((column) => column.name === name)) db.exec(`ALTER TABLE messages ADD COLUMN ${name} ${definition}`);
}
const memberColumns = db.query("PRAGMA table_info(server_members)").all() as Array<{ name: string }>;
if (!memberColumns.some((column) => column.name === "role")) db.exec("ALTER TABLE server_members ADD COLUMN role TEXT NOT NULL DEFAULT 'member'");
db.exec("UPDATE server_members SET role = 'owner' WHERE user_id IN (SELECT owner_id FROM servers WHERE servers.id = server_members.server_id)");

export type User = { id: string; email: string; displayName: string; createdAt: string };
export type AuthUser = User & { passwordHash: string };
export type MessageMedia = { url: string; type: "image" | "gif"; alt: string };
export type ChatMessage = { id: string; content: string; createdAt: string; editedAt: string | null; deletedAt: string | null; replyToId: string | null; reactions: Record<string, number>; author: User; media: MessageMedia | null; channelId: string };
export type Server = { id: string; name: string; ownerId: string; createdAt: string };
export type Channel = { id: string; serverId: string; name: string; type: "text" };
export type ServerRole = "owner" | "moderator" | "member";
export type ServerMember = User & { joinedAt: string; role: ServerRole; isOwner: boolean };
export type ServerInvite = { code: string; serverId: string; expiresAt: string };

const userColumns = `id, email, display_name AS displayName, created_at AS createdAt`;
export function findUserByEmail(email: string): AuthUser | null { return db.query(`SELECT ${userColumns}, password_hash AS passwordHash FROM users WHERE email = ?`).get(email) as AuthUser | null; }
export function createUser(email: string, displayName: string, passwordHash: string): User { const user = { id: crypto.randomUUID(), email, displayName, createdAt: new Date().toISOString() }; db.query("INSERT INTO users (id, email, display_name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)").run(user.id, user.email, user.displayName, passwordHash, user.createdAt); createServer(user, "Minha comunidade"); return user; }
export function createSession(userId: string, tokenHash: string, expiresAt: number): void { db.query("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now()); db.query("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)").run(tokenHash, userId, expiresAt, new Date().toISOString()); }
export function userForSession(tokenHash: string): User | null { return db.query(`SELECT users.id, users.email, users.display_name AS displayName, users.created_at AS createdAt FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > ?`).get(tokenHash, Date.now()) as User | null; }
export function deleteSession(tokenHash: string): void { db.query("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash); }

export function createServer(user: User, name: string): { server: Server; channel: Channel } {
  const createdAt = new Date().toISOString();
  const server = { id: crypto.randomUUID(), name, ownerId: user.id, createdAt };
  const channel = { id: crypto.randomUUID(), serverId: server.id, name: "geral", type: "text" as const };
  db.transaction(() => { db.query("INSERT INTO servers (id, name, owner_id, created_at) VALUES (?, ?, ?, ?)").run(server.id, name, user.id, createdAt); db.query("INSERT INTO server_members (server_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)").run(server.id, user.id, createdAt); db.query("INSERT INTO channels (id, server_id, name, type, created_at) VALUES (?, ?, ?, ?, ?)").run(channel.id, server.id, channel.name, channel.type, createdAt); })();
  return { server, channel };
}
export function listServers(userId: string): Server[] { return db.query("SELECT s.id, s.name, s.owner_id AS ownerId, s.created_at AS createdAt FROM servers s JOIN server_members m ON m.server_id = s.id WHERE m.user_id = ? ORDER BY s.created_at").all(userId) as Server[]; }
export function listChannels(userId: string, serverId: string): Channel[] { return db.query("SELECT c.id, c.server_id AS serverId, c.name, c.type FROM channels c JOIN server_members m ON m.server_id = c.server_id WHERE c.server_id = ? AND m.user_id = ? ORDER BY c.created_at").all(serverId, userId) as Channel[]; }
export function isServerMember(userId: string, serverId: string): boolean { return Boolean(db.query("SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?").get(serverId, userId)); }
export function serverForUser(userId: string, serverId: string): Server | null { return db.query("SELECT s.id, s.name, s.owner_id AS ownerId, s.created_at AS createdAt FROM servers s JOIN server_members m ON m.server_id = s.id WHERE s.id = ? AND m.user_id = ?").get(serverId, userId) as Server | null; }
export function serverMembers(userId: string, serverId: string): ServerMember[] | null {
  if (!isServerMember(userId, serverId)) return null;
  return db.query("SELECT u.id, u.email, u.display_name AS displayName, u.created_at AS createdAt, m.created_at AS joinedAt, m.role, (u.id = s.owner_id) AS isOwner FROM server_members m JOIN users u ON u.id = m.user_id JOIN servers s ON s.id = m.server_id WHERE m.server_id = ? ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'moderator' THEN 1 ELSE 2 END, u.display_name").all(serverId) as ServerMember[];
}
export function roleForUser(userId: string, serverId: string): ServerRole | null { const row = db.query("SELECT role FROM server_members WHERE user_id = ? AND server_id = ?").get(userId, serverId) as { role: ServerRole } | null; return row?.role ?? null; }
export function canManageServer(userId: string, serverId: string): boolean { return ["owner", "moderator"].includes(roleForUser(userId, serverId) ?? ""); }
export function setMemberRole(actorId: string, serverId: string, memberId: string, role: "moderator" | "member"): "ok" | "forbidden" | "missing" {
  const server = serverForUser(actorId, serverId);
  if (!server || server.ownerId !== actorId) return server ? "forbidden" : "missing";
  if (!isServerMember(memberId, serverId) || memberId === server.ownerId) return "missing";
  db.query("UPDATE server_members SET role = ? WHERE server_id = ? AND user_id = ?").run(role, serverId, memberId);
  return "ok";
}
export function removeMember(actorId: string, serverId: string, memberId: string): "ok" | "forbidden" | "missing" {
  const server = serverForUser(actorId, serverId);
  if (!server || server.ownerId !== actorId) return server ? "forbidden" : "missing";
  if (!isServerMember(memberId, serverId) || memberId === server.ownerId) return "missing";
  db.query("DELETE FROM server_members WHERE server_id = ? AND user_id = ?").run(serverId, memberId);
  return "ok";
}
export function createInvite(userId: string, serverId: string): ServerInvite | null {
  const server = serverForUser(userId, serverId);
  if (!server || !canManageServer(userId, serverId)) return null;
  const invite = { code: crypto.randomUUID().replaceAll("-", "").slice(0, 10), serverId, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000).toISOString() };
  db.query("INSERT INTO invites (code, server_id, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?)").run(invite.code, serverId, userId, new Date().toISOString(), invite.expiresAt);
  return invite;
}
export function joinServer(userId: string, code: string): Server | null {
  const invite = db.query("SELECT server_id AS serverId, expires_at AS expiresAt FROM invites WHERE code = ?").get(code) as { serverId: string; expiresAt: string } | null;
  if (!invite || Date.parse(invite.expiresAt) <= Date.now()) return null;
  if (!isServerMember(userId, invite.serverId)) db.query("INSERT INTO server_members (server_id, user_id, created_at) VALUES (?, ?, ?)").run(invite.serverId, userId, new Date().toISOString());
  return db.query("SELECT id, name, owner_id AS ownerId, created_at AS createdAt FROM servers WHERE id = ?").get(invite.serverId) as Server | null;
}
export function leaveServer(userId: string, serverId: string): "left" | "owner" | "missing" {
  const server = serverForUser(userId, serverId);
  if (!server) return "missing";
  if (server.ownerId === userId) return "owner";
  db.query("DELETE FROM server_members WHERE server_id = ? AND user_id = ?").run(serverId, userId);
  return "left";
}
export function createChannel(userId: string, serverId: string, name: string): Channel | null { if (!canManageServer(userId, serverId)) return null; const channel = { id: crypto.randomUUID(), serverId, name, type: "text" as const }; db.query("INSERT INTO channels (id, server_id, name, type, created_at) VALUES (?, ?, ?, ?, ?)").run(channel.id, serverId, name, channel.type, new Date().toISOString()); return channel; }
export function channelForUser(userId: string, channelId: string): Channel | null { return db.query("SELECT c.id, c.server_id AS serverId, c.name, c.type FROM channels c JOIN server_members m ON m.server_id = c.server_id WHERE c.id = ? AND m.user_id = ?").get(channelId, userId) as Channel | null; }
export function firstChannelForUser(userId: string): Channel | null { return db.query("SELECT c.id, c.server_id AS serverId, c.name, c.type FROM channels c JOIN server_members m ON m.server_id = c.server_id WHERE m.user_id = ? ORDER BY c.created_at LIMIT 1").get(userId) as Channel | null; }

function hydrateMessage(row: any): ChatMessage { return { id: row.id, channelId: row.channelId, content: row.deletedAt ? "" : row.content, createdAt: row.createdAt, editedAt: row.editedAt ?? null, deletedAt: row.deletedAt ?? null, replyToId: row.replyToId ?? null, reactions: JSON.parse(row.reactionsJson || "{}") as Record<string, number>, author: { id: row.userId, email: row.email, displayName: row.displayName, createdAt: row.userCreatedAt }, media: row.mediaUrl && row.mediaType && !row.deletedAt ? { url: row.mediaUrl, type: row.mediaType, alt: row.mediaAlt ?? "Imagem enviada" } : null }; }
export function saveMessage(user: User, channelId: string, content: string, media: MessageMedia | null = null, replyToId: string | null = null): ChatMessage { const message = { id: crypto.randomUUID(), content, createdAt: new Date().toISOString(), editedAt: null, deletedAt: null, replyToId, reactions: {}, author: user, media, channelId }; db.query("INSERT INTO messages (id, user_id, channel_id, content, created_at, reply_to_id, reactions_json, media_url, media_type, media_alt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(message.id, user.id, channelId, content, message.createdAt, replyToId, "{}", media?.url ?? null, media?.type ?? null, media?.alt ?? null); return message; }
export function messageHistory(channelId: string, limit: number, before?: string): ChatMessage[] { const rows = db.query(`SELECT m.id, m.channel_id AS channelId, m.content, m.created_at AS createdAt, m.edited_at AS editedAt, m.deleted_at AS deletedAt, m.reply_to_id AS replyToId, m.reactions_json AS reactionsJson, m.media_url AS mediaUrl, m.media_type AS mediaType, m.media_alt AS mediaAlt, u.id AS userId, u.email, u.display_name AS displayName, u.created_at AS userCreatedAt FROM messages m JOIN users u ON u.id = m.user_id WHERE m.channel_id = ? AND (? IS NULL OR m.created_at < ?) ORDER BY m.created_at DESC, m.id DESC LIMIT ?`).all(channelId, before ?? null, before ?? null, limit) as any[]; return rows.reverse().map(hydrateMessage); }
export function messageForUser(userId: string, messageId: string): any | null { return db.query("SELECT m.*, u.id AS userId, u.email, u.display_name AS displayName, u.created_at AS userCreatedAt FROM messages m JOIN users u ON u.id = m.user_id JOIN server_members sm ON sm.user_id = ? JOIN channels c ON c.id = m.channel_id AND c.server_id = sm.server_id WHERE m.id = ?").get(userId, messageId) as any | null; }
export function editMessage(userId: string, messageId: string, content: string): ChatMessage | null { const row = messageForUser(userId, messageId); if (!row || row.user_id !== userId || row.deleted_at) return null; const editedAt = new Date().toISOString(); db.query("UPDATE messages SET content = ?, edited_at = ? WHERE id = ?").run(content, editedAt, messageId); return hydrateMessage({ ...row, content, editedAt }); }
export function deleteMessage(userId: string, messageId: string): ChatMessage | null { const row = messageForUser(userId, messageId); if (!row || row.user_id !== userId || row.deleted_at) return null; const deletedAt = new Date().toISOString(); db.query("UPDATE messages SET content = '', media_url = NULL, media_type = NULL, media_alt = NULL, deleted_at = ? WHERE id = ?").run(deletedAt, messageId); return hydrateMessage({ ...row, content: "", mediaUrl: null, mediaType: null, mediaAlt: null, deletedAt }); }
export function reactMessage(userId: string, messageId: string, emoji: string): ChatMessage | null { if (!/\p{Extended_Pictographic}/u.test(emoji) || emoji.length > 8) return null; const row = messageForUser(userId, messageId); if (!row || row.deleted_at) return null; const reactions = JSON.parse(row.reactions_json || "{}") as Record<string, number>; reactions[emoji] = reactions[emoji] ? 0 : 1; if (!reactions[emoji]) delete reactions[emoji]; db.query("UPDATE messages SET reactions_json = ? WHERE id = ?").run(JSON.stringify(reactions), messageId); return hydrateMessage({ ...row, reactionsJson: JSON.stringify(reactions) }); }
