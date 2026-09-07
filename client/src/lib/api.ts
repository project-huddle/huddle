const browserOrigin =
	typeof window === "undefined"
		? "http://localhost:3000"
		: window.location.origin;
export const API_URL = new URL(
	import.meta.env.VITE_API_URL || browserOrigin,
	browserOrigin,
)
	.toString()
	.replace(/\/$/, "");

export type User = {
	id: string;
	email: string;
	displayName: string;
	avatarUrl: string | null;
	createdAt: string;
};

export type UserProfile = User & {
	emailVerifiedAt: string | null;
	countryCode: string | null;
	twoFactorEnabled: boolean;
};

export type ChatMessage = {
	id: string;
	content: string;
	createdAt: string;
	author: User;
	media: MessageMedia | null;
	channelId: string;
	editedAt: string | null;
	deletedAt: string | null;
	replyToId: string | null;
	reactions: Record<string, number>;
};

export type HuddleServer = {
	id: string;
	name: string;
	iconUrl: string | null;
	ownerId: string;
	createdAt: string;
};
export type HuddleChannel = {
	id: string;
	serverId: string;
	name: string;
	type: "text" | "voice";
	roleIds: string[];
};
export type HuddleRole = "owner" | "moderator" | "member";
export type HuddleServerRole = {
	id: string;
	serverId: string;
	name: string;
	color: string;
	position: number;
	isDefault: boolean;
	permissions: string[];
};
export type HuddlePermission = {
	key: string;
	label: string;
	description: string;
	category: string;
};
export type HuddleMember = User & {
	joinedAt: string;
	role: "owner" | "moderator" | "member";
	isOwner: boolean;
	roles?: Pick<HuddleServerRole, "id" | "name" | "color" | "position">[];
};
export type InvitePreview = {
	code: string;
	serverId: string;
	serverName: string;
	expiresAt: string;
};

export type MessageMedia = {
	url: string;
	type: "image" | "gif";
	alt: string;
};

export type GifResult = MessageMedia & { id: string; previewUrl: string };

type ApiError = { error?: { message?: string } };

let onUnauthorized: ((token: string) => void) | undefined;

export function setUnauthorizedHandler(handler: (token: string) => void) {
	onUnauthorized = handler;
}

export async function api<T>(
	path: string,
	options: RequestInit = {},
	token?: string,
): Promise<T> {
	const response = await fetch(`${API_URL}${path}`, {
		...options,
		headers: {
			...(options.body instanceof FormData
				? {}
				: { "Content-Type": "application/json" }),
			...(token ? { Authorization: `Bearer ${token}` } : {}),
			...options.headers,
		},
	});

	if (!response.ok) {
		const payload = (await response.json().catch(() => ({}))) as ApiError;
		if (response.status === 401 && token) onUnauthorized?.(token);
		let fallbackMessage = `Não foi possível concluir a solicitação (HTTP ${response.status}).`;
		if (response.status >= 500)
			fallbackMessage = "O servidor está indisponível no momento.";
		if (response.status === 429)
			fallbackMessage = "Muitas solicitações. Tente novamente em instantes.";
		throw new Error(
			payload.error?.message ??
			fallbackMessage,
		);
	}

	if (response.status === 204) return undefined as T;
	return response.json() as Promise<T>;
}

export function websocketUrl(ticket: string) {
	const url = new URL(API_URL);
	url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
	url.pathname = "/ws";
	url.search = new URLSearchParams({ ticket }).toString();
	return url.toString();
}

export function resolveMediaUrl(path: string) {
	return new URL(path, `${API_URL}/`).toString();
}
