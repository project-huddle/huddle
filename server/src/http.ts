import { config } from "./config";

export function json(data: unknown, status = 200, headers?: Headers): Response {
  return Response.json(data, { status, headers });
}

export function error(status: number, code: string, message: string): Response {
  return json({ error: { code, message } }, status);
}

export function corsHeaders(request: Request): Headers {
  const headers = new Headers();
  const origin = request.headers.get("origin");
  if (origin && config.corsOrigins.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
    headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PATCH, DELETE, OPTIONS",
    );
  }
  return headers;
}
