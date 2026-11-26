import { join } from "node:path";
import { Elysia, t } from "elysia";
import { canAccessMedia } from "@/features/media/application/media-access";
import { config } from "@/bootstrap/config";
import { authenticate } from "../../../interfaces/http/authentication";
import { error } from "../../../interfaces/http/responses";

const contentTypes: Record<string, string> = { jpg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" };

export const mediaRoutes = new Elysia({name: "media-routes"}).get("/media/:filename", async ({request, params}) => {
  const user = await authenticate(request);
  if (!(await canAccessMedia(`/media/${params.filename}`, user?.id ?? null))) {
    return error(404, "NOT_FOUND", "Media not found.");
  }
  const file = Bun.file(join(config.uploadsPath, params.filename));
  if (!(await file.exists())) return error(404, "NOT_FOUND", "Media not found.");
  const extension = params.filename.split(".").at(-1) ?? "";
  return new Response(file, { headers: {
    "Content-Type": contentTypes[extension] ?? "application/octet-stream",
    "Cache-Control": "private, no-store",
    "Vary": "Authorization",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": "inline",
  }});
}, {params: t.Object({filename: t.String({pattern:"^[a-f0-9-]+\\.(jpg|png|gif|webp)$"})})});
