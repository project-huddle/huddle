const maxMessageLength = 2_000;

type MessageMedia = {
  url: string;
  type: "image" | "gif";
  alt: string;
};

export function validEmail(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

export function messageContent(
  value: unknown,
  allowEmpty = false,
): string | null {
  if (typeof value !== "string") return allowEmpty ? "" : null;
  const content = value.trim();
  return (allowEmpty || content) && content.length <= maxMessageLength
    ? content
    : null;
}

export function messageMedia(value: unknown): MessageMedia | null {
  const candidate =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : null;
  const type =
    candidate?.type === "image" || candidate?.type === "gif"
      ? candidate.type
      : null;
  const url = typeof candidate?.url === "string" ? candidate.url : "";
  const local = /^\/media\/[a-f0-9-]+\.(jpg|png|gif|webp)$/.test(url);
  let tenor = false;
  try {
    const parsed = new URL(url);
    tenor =
      parsed.protocol === "https:" && parsed.hostname === "media.tenor.com";
  } catch {
    // Local media URLs are intentionally relative.
  }
  if (!type || (!local && !(type === "gif" && tenor))) return null;
  return {
    type,
    url,
    alt:
      typeof candidate?.alt === "string"
        ? candidate.alt.slice(0, 160)
        : "Imagem enviada",
  };
}
