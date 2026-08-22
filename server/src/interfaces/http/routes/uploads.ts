import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { Elysia, t } from "elysia";
import { config } from "@/bootstrap/config";
import { error, json } from "@/interfaces/http/responses";
import { authenticatedRoutes } from "../plugins/auth";

mkdirSync(config.uploadsPath, { recursive: true });
const imageExtensions = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
} as const;
type ImageType = keyof typeof imageExtensions;

function detectedImageType(bytes: Uint8Array): ImageType | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.slice(0, 8).every((value, index) => value === pngSignature[index]))
    return "image/png";
  const header = new TextDecoder().decode(bytes.slice(0, 12));
  if (header.startsWith("GIF87a") || header.startsWith("GIF89a"))
    return "image/gif";
  if (header.startsWith("RIFF") && header.slice(8) === "WEBP")
    return "image/webp";
  return null;
}

export const uploadRoutes = new Elysia({ name: "upload-routes" })
  .use(authenticatedRoutes("authenticated-upload-routes"))
  .post(
    "/uploads",
    async ({ request, body }) => {
      const declaredLength = Number(request.headers.get("content-length"));
      if (
        Number.isFinite(declaredLength) &&
        declaredLength > config.maxUploadBytes + 64 * 1024
      )
        return error(
          413,
          "FILE_TOO_LARGE",
          "Images must be no larger than 8 MB.",
        );
      const upload = body.file;
      if (upload.size < 1 || upload.size > config.maxUploadBytes)
        return error(
          413,
          "FILE_TOO_LARGE",
          "Images must be no larger than 8 MB.",
        );
      const bytes = new Uint8Array(await upload.arrayBuffer());
      const imageType = detectedImageType(bytes);
      if (!imageType)
        return error(
          415,
          "UNSUPPORTED_FILE",
          "Only JPEG, PNG, GIF and WebP images are supported.",
        );
      const filename = `${crypto.randomUUID()}.${imageExtensions[imageType]}`;
      await Bun.write(join(config.uploadsPath, filename), bytes);
      const mediaType = imageType === "image/gif" ? "gif" : "image";
      return json(
        {
          media: {
            url: `/media/${filename}`,
            type: mediaType,
            alt: upload.name.slice(0, 160) || "Imagem enviada",
          },
        },
        201,
      );
    },
    { body: t.Object({ file: t.File() }), parse: "multipart/form-data" },
  );
