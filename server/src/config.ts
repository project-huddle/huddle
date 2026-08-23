import { resolve } from "node:path";

function integer(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new Error(`${name} must be an integer between 1 and 65535`);
  }
  return value;
}

function positiveInteger(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function boolean(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be true or false`);
}

export const config = {
  host: process.env.HOST ?? "0.0.0.0",
  port: integer("PORT", 3000),
  trustProxy: boolean("TRUST_PROXY", false),
  uploadsPath: resolve(process.env.UPLOADS_PATH ?? "data/uploads"),
  corsOrigins: new Set(
    (process.env.CORS_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  ),
  sessionLifetimeSeconds: 60 * 60 * 24 * 30,
  maxMessageLength: 2_000,
  maxHistoryLimit: 100,
  maxUploadBytes: 8 * 1024 * 1024,
  maxJsonBytes: positiveInteger("MAX_JSON_BYTES", 16 * 1024),
  authAttemptsPerMinute: positiveInteger("AUTH_ATTEMPTS_PER_MINUTE", 20),
  requestsPerMinute: positiveInteger("REQUESTS_PER_MINUTE", 300),
  tenorApiKey: process.env.TENOR_API_KEY?.trim() || null,
  tenorClientKey: process.env.TENOR_CLIENT_KEY?.trim() || "huddle",
};
