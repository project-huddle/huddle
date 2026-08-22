import { join } from "node:path";
import { Elysia, t } from "elysia";
import { config } from "@/config";
import { error, json } from "@/http";

export const publicRoutes = new Elysia({ name: "public-routes" })
  .get("/health", () =>
    json({ status: "ok", timestamp: new Date().toISOString() }),
  )
  .get(
    "/media/:filename",
    async ({ params }) => {
      const file = Bun.file(join(config.uploadsPath, params.filename));
      if (!(await file.exists()))
        return error(404, "NOT_FOUND", "Media not found.");
      return new Response(file, {
        headers: {
          "Content-Type": file.type,
          "Cache-Control": "public, max-age=31536000, immutable",
          "X-Content-Type-Options": "nosniff",
        },
      });
    },
    {
      params: t.Object({
        filename: t.String({ pattern: "^[a-f0-9-]+\\.(jpg|png|gif|webp)$" }),
      }),
    },
  );
