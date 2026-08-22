import { Elysia } from "elysia";
import { config } from "@/config";
import { corsHeaders, error } from "@/http";
import { clientAddress, FixedWindowRateLimiter } from "@/rate-limit";

export function security() {
  const requestLimiter = new FixedWindowRateLimiter(config.requestsPerMinute);
  const authLimiter = new FixedWindowRateLimiter(config.authAttemptsPerMinute);
  return new Elysia({ name: "http-security" }).onRequest(
    ({ request, server, set }) => {
      set.headers["X-Content-Type-Options"] = "nosniff";
      set.headers["X-Frame-Options"] = "DENY";
      set.headers["Referrer-Policy"] = "no-referrer";
      set.headers["Permissions-Policy"] =
        "camera=(), microphone=(), geolocation=()";
      set.headers["Cache-Control"] = "no-store";
      for (const [key, value] of corsHeaders(request)) set.headers[key] = value;

      const contentType = request.headers.get("content-type")?.toLowerCase();
      const declaredLength = Number(request.headers.get("content-length"));
      if (
        contentType?.includes("application/json") &&
        Number.isFinite(declaredLength) &&
        declaredLength > config.maxJsonBytes
      )
        return error(400, "INVALID_INPUT", "The request is invalid.");

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
    },
  );
}
