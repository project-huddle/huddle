import { config } from "./config";

export function json(data: unknown, status = 200, headers?: Headers): Response {
  return Response.json(data, { status, headers });
}

export function error(status: number, code: string, message: string): Response {
  return json({ error: { code, message } }, status);
}

export async function body(
  request: Request,
): Promise<Record<string, unknown> | null> {
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .includes("application/json")
  )
    return null;
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > config.maxJsonBytes)
    return null;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > config.maxJsonBytes)
      return null;
    const value: unknown = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function securityHeaders(response: Response): Response {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  response.headers.set(
    "Cache-Control",
    response.headers.get("Cache-Control") ?? "no-store",
  );
  return response;
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
