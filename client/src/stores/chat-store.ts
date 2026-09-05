import { create } from "zustand";

import type { HuddleChannel, HuddleMember, HuddleServer } from "@/lib/api";
import { api } from "@/lib/api";
import type { ChatStoreState } from "@/types/chat";
import { channelNameSchema, inviteCodeSchema, serverNameSchema } from "@/schemas/chat-schema";
import { errorMessage as message, requireCredentials as credentials } from "@/lib/chat-store";

type ChatState = ChatStoreState;

const initialState = {
	servers: [],
	channels: [],
	members: [],
	membersServerId: "",
	serverId: "",
	channelId: "",
	replyTo: null,
	creating: false,
	mobileNavOpen: false,
	socialOpen: false,
	settingsOpen: false,
	dialog: null,
	dialogValue: "",
	inviteUrl: null,
	error: null,
} satisfies Omit<ChatState, keyof ChatActions>;

type ChatActions = Pick<ChatState,
	| "setServers" | "setChannels" | "setMembers" | "setServerId" | "setChannelId"
	| "setReplyTo" | "setCreating" | "setInviteUrl" | "openDialog"
	| "closeDialog" | "setDialogValue" | "setMobileNavOpen"
	| "setSocialOpen" | "setSettingsOpen" | "reset"
	| "loadServers" | "loadChannels" | "loadMembers" | "createServer" | "createChannel"
	| "joinServer" | "createInvite" | "leaveServer" | "changeMemberRole" | "removeMember" | "clearError"
>;

export const useChatStore = create<ChatState>((set) => ({
	...initialState,
	setServers: (value) => set((state) => ({ servers: typeof value === "function" ? value(state.servers) : value })),
	setChannels: (value) => set((state) => ({ channels: typeof value === "function" ? value(state.channels) : value })),
	setMembers: (value) => set((state) => ({ members: typeof value === "function" ? value(state.members) : value, membersServerId: state.serverId })),
	setServerId: (value) => set((state) => {
		const serverId = typeof value === "function" ? value(state.serverId) : value;
		if (serverId === state.serverId) return state;
		return { serverId, channels: [], members: [], channelId: "", replyTo: null };
	}),
	setChannelId: (value) => set((state) => ({ channelId: typeof value === "function" ? value(state.channelId) : value })),
	setReplyTo: (replyTo) => set({ replyTo }),
	setCreating: (creating) => set({ creating }),
	setInviteUrl: (inviteUrl) => set({ inviteUrl }),
	openDialog: (dialog) => set({ dialog, dialogValue: dialog === "create-invite" ? "2" : "" }),
	closeDialog: () => set({ dialog: null }),
	setDialogValue: (dialogValue) => set({ dialogValue }),
	setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
	setSocialOpen: (socialOpen) => set({ socialOpen }),
	setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
	reset: () => set(initialState),
	clearError: () => set({ error: null }),
	loadServers: async () => {
		try {
			const { token } = credentials();
			const { servers } = await api<{
				servers: HuddleServer[];
			}>("/servers", {}, token);
			set((state) => ({ servers, serverId: state.serverId || servers[0]?.id || "" }));
		}
		catch (cause) {
			set({ error: message(cause, "Não foi possível carregar os servidores.") });
		}
	},
	loadChannels: async () => {
		const { serverId } = useChatStore.getState();
		if (!serverId) return;
		try {
			const { token } = credentials();
			const { channels } = await api<{
				channels: HuddleChannel[];
			}>(`/servers/${serverId}/channels`, {}, token);
			set((state) => {
				if (state.serverId !== serverId) return state;
				const selectedExists = channels.some(({ id }) => id === state.channelId);
				const channelId = selectedExists ? state.channelId : channels[0]?.id ?? "";
				return { channels, channelId };
			});
		}
		catch (cause) {
			set({ error: message(cause, "Não foi possível carregar os canais.") });
		}
	},
	loadMembers: async () => {
		const { serverId } = useChatStore.getState();
		if (!serverId) return;
		try {
			const { token } = credentials();
			const { members } = await api<{
				members: HuddleMember[];
			}>(`/servers/${serverId}/members`, {}, token);
			set((state) => state.serverId === serverId ? { members, membersServerId: serverId } : state);
		}
		catch {
			set((state) => state.serverId === serverId ? { members: [], membersServerId: "" } : state);
		}
	},
	createServer: async (raw) => {
		const parsed = serverNameSchema.safeParse(raw);
		if (!parsed.success) {
			return set({ error: parsed.error.issues[0]?.message });
		}
		if (useChatStore.getState().creating) return;
		set({ creating: true, error: null });
		try {
			const { token } = credentials();
			const result = await api<{
				server: HuddleServer;
				channel: HuddleChannel;
			}>("/servers", { method: "POST", body: JSON.stringify({ name: parsed.data }) }, token);
			set((state) => ({
				servers: [...state.servers, result.server],
				serverId: result.server.id,
				channels: [result.channel],
				channelId: result.channel.id,
				dialog: null,
			}));
		}
		catch (cause) {
			set({ error: message(cause, "Não foi possível criar o servidor.") });
		}
		finally {
			set({ creating: false });
		}
	},
	createChannel: async (raw, type = "text") => {
		const parsed = channelNameSchema.safeParse(raw);
		const { serverId, creating } = useChatStore.getState();
		if (!parsed.success) {
			return set({ error: parsed.error.issues[0]?.message });
		}
		if (!serverId || creating) return;
		set({ creating: true, error: null });
		try {
			const { token } = credentials();
			const { channel } = await api<{
				channel: HuddleChannel;
			}>(`/servers/${serverId}/channels`, { method: "POST", body: JSON.stringify({ name: parsed.data, type }) }, token);
			set((state) => ({ channels: [...state.channels, channel], channelId: channel.id, dialog: null }));
		}
		catch (cause) {
			set({ error: message(cause, "Não foi possível criar o canal.") });
		}
		finally {
			set({ creating: false });
		}
	},
	joinServer: async (raw) => {
		const parsed = inviteCodeSchema.safeParse(raw);
		if (!parsed.success) {
			return set({ error: parsed.error.issues[0]?.message });
		}
		try {
			const { token } = credentials();
			const { server } = await api<{
				server: HuddleServer;
			}>("/invites/join", { method: "POST", body: JSON.stringify({ code: parsed.data }) }, token);
			set((state) => ({
				servers: state.servers.some(({ id }) => id === server.id)
					? state.servers
					: [...state.servers, server],
				serverId: server.id,
				dialog: null,
			}));
		}
		catch (cause) {
			set({ error: message(cause, "Não foi possível entrar no servidor.") });
		}
	},
	createInvite: async (durationHours = 2) => {
		const { serverId } = useChatStore.getState();
		if (!serverId) return;
		try {
			const { token } = credentials();
			const result = await api<{
				invite: { code: string };
				url: string;
			}>(`/servers/${serverId}/invites`, {
				method: "POST",
				body: JSON.stringify({ durationHours }),
			}, token);
			const url = new URL(result.url, window.location.origin).toString();
			await navigator.clipboard?.writeText(url);
			set({ inviteUrl: url });
		}
		catch (cause) {
			set({ error: message(cause, "Não foi possível criar o convite.") });
		}
	},
	leaveServer: async () => {
		const { serverId, servers } = useChatStore.getState();
		if (!serverId) return;
		try {
			const { token } = credentials();
			await api(`/servers/${serverId}/leave`, { method: "POST" }, token);
			const remaining = servers.filter(({ id }) => id !== serverId);
			set({ servers: remaining, serverId: remaining[0]?.id ?? "", channels: [], members: [], channelId: "" });
		}
		catch (cause) {
			set({ error: message(cause, "Não foi possível sair do servidor.") });
		}
	},
	changeMemberRole: async (member) => {
		const { serverId, servers } = useChatStore.getState();
		const active = servers.find(({ id }) => id === serverId);
		const { token, user } = credentials();
		if (!serverId || active?.ownerId !== user.id || member.isOwner) return;
		const role = member.role === "moderator" ? "member" : "moderator";
		try {
			await api(`/servers/${serverId}/members/${member.id}`, { method: "PATCH", body: JSON.stringify({ role }) }, token);
			set((state) => ({ members: state.members.map((item) => item.id === member.id ? { ...item, role } : item) }));
		}
		catch (cause) {
			set({ error: message(cause, "Não foi possível alterar o cargo.") });
		}
	},
	removeMember: async (member) => {
		const { serverId } = useChatStore.getState();
		if (!serverId) return;
		try {
			const { token } = credentials();
			await api(`/servers/${serverId}/members/${member.id}`, { method: "DELETE" }, token);
			set((state) => ({ members: state.members.filter(({ id }) => id !== member.id) }));
		}
		catch (cause) {
			set({ error: message(cause, "Não foi possível remover o membro.") });
		}
	},
}));
