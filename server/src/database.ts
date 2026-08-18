import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Database } from "bun:sqlite";
import { config } from "./config";

mkdirSync(dirname(config.databasePath), { recursive: true });

export const db = new Database(config.databasePath, { create: true, strict: true });
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    media_url TEXT,
    media_type TEXT,
    media_alt TEXT
  );
  CREATE INDEX IF NOT EXISTS messages_created_idx ON messages(created_at DESC, id DESC);
`);

const messageColumns = db.query("PRAGMA table_info(messages)").all() as Array<{ name: string }>;
for (const [name, definition] of [["media_url", "TEXT"], ["media_type", "TEXT"], ["media_alt", "TEXT"]] as const) {
  if (!messageColumns.some((column) => column.name === name)) db.exec(`ALTER TABLE messages ADD COLUMN ${name} ${definition}`);
}

export type User = { id: string; email: string; displayName: string; createdAt: string };
export type AuthUser = User & { passwordHash: string };
export type MessageMedia = { url: string; type: "image" | "gif"; alt: string };
export type ChatMessage = { id: string; content: string; createdAt: string; author: User; media: MessageMedia | null };

const userColumns = `id, email, display_name AS displayName, created_at AS createdAt`;

export function findUserByEmail(email: string): AuthUser | null {
  return db.query(`SELECT ${userColumns}, password_hash AS passwordHash FROM users WHERE email = ?`).get(email) as AuthUser | null;
}

export function createUser(email: string, displayName: string, passwordHash: string): User {
  const user = { id: crypto.randomUUID(), email, displayName, createdAt: new Date().toISOString() };
  db.query("INSERT INTO users (id, email, display_name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(user.id, user.email, user.displayName, passwordHash, user.createdAt);
  return user;
}

export function createSession(userId: string, tokenHash: string, expiresAt: number): void {
  db.query("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now());
  db.query("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .run(tokenHash, userId, expiresAt, new Date().toISOString());
}

export function userForSession(tokenHash: string): User | null {
  return db.query(`SELECT users.id, users.email, users.display_name AS displayName, users.created_at AS createdAt
                   FROM sessions JOIN users ON users.id = sessions.user_id
                   WHERE sessions.token_hash = ? AND sessions.expires_at > ?`)
    .get(tokenHash, Date.now()) as User | null;
}

export function deleteSession(tokenHash: string): void {
  db.query("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
}

export function saveMessage(user: User, content: string, media: MessageMedia | null = null): ChatMessage {
  const message = { id: crypto.randomUUID(), content, createdAt: new Date().toISOString(), author: user, media };
  db.query("INSERT INTO messages (id, user_id, content, created_at, media_url, media_type, media_alt) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(message.id, user.id, message.content, message.createdAt, media?.url ?? null, media?.type ?? null, media?.alt ?? null);
  return message;
}

export function messageHistory(limit: number, before?: string): ChatMessage[] {
  const rows = db.query(`
    SELECT m.id, m.content, m.created_at AS createdAt, m.media_url AS mediaUrl,
           m.media_type AS mediaType, m.media_alt AS mediaAlt,
           u.id AS userId, u.email, u.display_name AS displayName, u.created_at AS userCreatedAt
    FROM messages m JOIN users u ON u.id = m.user_id
    WHERE (? IS NULL OR m.created_at < ?)
    ORDER BY m.created_at DESC, m.id DESC LIMIT ?
  `).all(before ?? null, before ?? null, limit) as Array<{
    id: string; content: string; createdAt: string; userId: string;
    email: string; displayName: string; userCreatedAt: string;
    mediaUrl: string | null; mediaType: "image" | "gif" | null; mediaAlt: string | null;
  }>;
  return rows.reverse().map((row) => ({
    id: row.id, content: row.content, createdAt: row.createdAt,
    author: { id: row.userId, email: row.email, displayName: row.displayName, createdAt: row.userCreatedAt },
    media: row.mediaUrl && row.mediaType ? { url: row.mediaUrl, type: row.mediaType, alt: row.mediaAlt ?? "Imagem enviada" } : null,
  }));
}
