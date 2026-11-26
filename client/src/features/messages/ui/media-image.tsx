import { useEffect, useState, type ImgHTMLAttributes } from "react";
import { API_URL, resolveMediaUrl } from "@/shared/api/api";
import { useAuthStore } from "@/features/auth/state/auth-store";

type Props = ImgHTMLAttributes<HTMLImageElement> & {src: string};

/** Local attachments use authenticated blobs; bearer tokens never enter image URLs. */
export function MediaImage({src, alt, ...props}: Props) {
  const token = useAuthStore((state) => state.token);
  const [loaded, setLoaded] = useState<{source:string; url:string} | null>(null);
  const local = src.startsWith("/media/");
  useEffect(() => {
    if (!local) return;
    const abort = new AbortController();
    let objectUrl: string | null = null;
    void fetch(`${API_URL}${src}`, {
      headers: token ? {Authorization: `Bearer ${token}`} : {},
      cache: "no-store", signal: abort.signal,
    }).then(async (response) => {
      if (!response.ok) return;
      const blob = await response.blob();
      if (abort.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setLoaded({source:src,url:objectUrl});
    }).catch(() => { /* Aborted and inaccessible media remain unavailable. */ });
    return () => {abort.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl);};
  }, [src, token, local]);
  const imageUrl = local ? (loaded?.source === src ? loaded.url : undefined) : resolveMediaUrl(src);
  return <img {...props} src={imageUrl} alt={alt} />;
}
