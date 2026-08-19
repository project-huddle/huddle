const browserOrigin = typeof window === "undefined" ? "http://localhost:3000" : window.location.origin
export const API_URL = new URL(import.meta.env.VITE_API_URL || browserOrigin, browserOrigin).toString().replace(/\/$/, "")

export type User = {
  id: string
  email: string
  displayName: string
  createdAt: string
}

export type ChatMessage = {
  id: string
  content: string
  createdAt: string
  author: User
  media: MessageMedia | null
  channelId: string
  editedAt: string | null
  deletedAt: string | null
  replyToId: string | null
  reactions: Record<string, number>
}

export type HuddleServer = { id: string; name: string; ownerId: string; createdAt: string }
export type HuddleChannel = { id: string; serverId: string; name: string; type: "text" }
export type HuddleRole = "owner" | "moderator" | "member"
export type HuddleMember = User & { joinedAt: string; role: HuddleRole; isOwner: boolean }

export type MessageMedia = {
  url: string
  type: "image" | "gif"
  alt: string
}

export type GifResult = MessageMedia & { id: string; previewUrl: string }

type ApiError = { error?: { message?: string } }

export async function api<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as ApiError
    throw new Error(payload.error?.message ?? "Não foi possível concluir a solicitação.")
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export function websocketUrl(token: string) {
  const url = new URL(API_URL)
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
  url.pathname = "/ws"
  url.search = new URLSearchParams({ token }).toString()
  return url.toString()
}

export function resolveMediaUrl(path: string) {
  return new URL(path, `${API_URL}/`).toString()
}
