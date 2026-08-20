import { Elysia, t } from "elysia";
import { config } from "../../config";
import { corsHeaders, error, securityHeaders } from "../../http";
import { clientAddress, FixedWindowRateLimiter } from "../../rate-limit";
import {
  hasValidWebSocketTicket,
  realtimeWebSocket,
} from "../realtime/realtime-gateway";
import { routeRequest } from "./router";

export function createHttpApplication() {
  const requestLimiter = new FixedWindowRateLimiter(config.requestsPerMinute);
  const authLimiter = new FixedWindowRateLimiter(config.authAttemptsPerMinute);

  return new Elysia({ name: "huddle-http" })
    .onRequest(({ request, server, set }) => {
      set.headers["X-Content-Type-Options"] = "nosniff";
      set.headers["X-Frame-Options"] = "DENY";
      set.headers["Referrer-Policy"] = "no-referrer";
      set.headers["Permissions-Policy"] =
        "camera=(), microphone=(), geolocation=()";
      set.headers["Cache-Control"] = "no-store";
      for (const [key, value] of corsHeaders(request)) set.headers[key] = value;

      const pathname = new URL(request.url).pathname;
      const limiter =
        pathname === "/auth/login" || pathname === "/auth/register"
          ? authLimiter
          : requestLimiter;
      if (limiter.consume(clientAddress(request, server))) return;

      const response = error(
        429,
        "RATE_LIMITED",
        "Too many requests. Try again later.",
      );
      response.headers.set("Retry-After", "60");
      return response;
    })
    .onError(({ error: cause }) => {
      console.error(cause);
      return error(500, "INTERNAL_ERROR", "An unexpected error occurred.");
    })
    .ws("/ws", {
      query: t.Object({ ticket: t.Optional(t.String({ minLength: 1 })) }),
      beforeHandle({ request, query, status }) {
        const origin = request.headers.get("origin");
        if (origin && !config.corsOrigins.has(origin))
          return status(403, {
            code: "ORIGIN_NOT_ALLOWED",
            message: "WebSocket origin is not allowed.",
          });
        if (!hasValidWebSocketTicket(query.ticket))
          return status(401, {
            code: "UNAUTHORIZED",
            message: "A valid one-time WebSocket ticket is required.",
          });
      },
      parse(_ws, message) {
        if (typeof message === "string") return message;
        if (message instanceof ArrayBuffer)
          return new TextDecoder().decode(message);
        if (ArrayBuffer.isView(message))
          return new TextDecoder().decode(
            new Uint8Array(
              message.buffer,
              message.byteOffset,
              message.byteLength,
            ),
          );
        return JSON.stringify(message);
      },
      ...realtimeWebSocket,
    })
    .all("*", async ({ request }) => {
      const response = await routeRequest(request);
      if (!response) return;
      for (const [key, value] of corsHeaders(request))
        response.headers.set(key, value);
      return securityHeaders(response);
    });
}
