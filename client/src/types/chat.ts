import type { SetStateAction } from "react";
import type { HuddleChannel, HuddleMember, HuddlePermission, HuddleServer, HuddleServerRole, User } from "@/lib/api";

export type ChatDialog =
	| "add-server"
	| "create-server"
	| "create-channel"
	| "create-invite";

export type ChatStoreState = {
	servers: HuddleServer[];
	channels: HuddleChannel[];
	members: HuddleMember[];
	membersServerId: string;
	serverId: string;
	channelId: string;
	replyTo: string | null;
	creating: boolean;
	mobileNavOpen: boolean;
	socialOpen: boolean;
	settingsOpen: boolean;
	serverSettingsOpen: boolean;
	roles: HuddleServerRole[];
	permissions: HuddlePermission[];
	dialog: ChatDialog | null;
	dialogValue: string;
	inviteUrl: string | null;
	error: string | null;
	voiceUsers: Record<string, User[]>;
	voicePresenceRevisions: Record<string, number>;
	onlineUsers: Record<string, boolean>;
	unreadByChannel: Record<string, number>;
	unreadByServer: Record<string, number>;
	mentionedChannels: Record<string, number>;
	seenNotificationIds: Record<string, true>;
	setServers: (value: SetStateAction<HuddleServer[]>) => void;
	setChannels: (value: SetStateAction<HuddleChannel[]>) => void;
	setMembers: (value: SetStateAction<HuddleMember[]>) => void;
	setServerId: (value: SetStateAction<string>) => void;
	setChannelId: (value: SetStateAction<string>) => void;
	setReplyTo: (value: string | null) => void;
	setCreating: (value: boolean) => void;
	setInviteUrl: (value: string | null) => void;
	openDialog: (dialog: ChatDialog) => void;
	closeDialog: () => void;
	setDialogValue: (value: string) => void;
	setMobileNavOpen: (value: boolean) => void;
	setSocialOpen: (value: boolean) => void;
	setSettingsOpen: (value: boolean) => void;
	setServerSettingsOpen: (value: boolean) => void;
	reset: () => void;
	loadServers: () => Promise<void>;
	loadChannels: () => Promise<void>;
	loadMembers: () => Promise<void>;
	loadRoles: () => Promise<void>;
	createRole: (input: { name: string; color: string; permissions: string[] }) => Promise<void>;
	updateRole: (roleId: string, input: { name?: string; color?: string; permissions?: string[] }) => Promise<void>;
	deleteRole: (roleId: string) => Promise<void>;
	assignRole: (memberId: string, roleId: string, assign: boolean) => Promise<void>;
	updateServer: (input: { name?: string; iconUrl?: string | null }) => Promise<boolean>;
	deleteServer: () => Promise<void>;
	transferOwnership: (memberId: string) => Promise<boolean>;
	setChannelAccess: (channelId: string, roleIds: string[]) => Promise<boolean>;
	createServer: (value: string) => Promise<void>;
	createChannel: (value: string, type?: HuddleChannel["type"]) => Promise<void>;
	joinServer: (value: string) => Promise<void>;
	createInvite: (durationHours?: number) => Promise<void>;
	leaveServer: () => Promise<void>;
	removeMember: (member: HuddleMember) => Promise<void>;
	banMember: (member: HuddleMember) => Promise<void>;
	clearError: () => void;
	setVoiceUsers: (channelId: string, users: User[], revision?: number) => void;
	setPresence: (userId: string, online: boolean) => void;
	setPresenceSnapshot: (userIds: string[]) => void;
	markChannelUnread: (messageId: string, channelId: string, serverId: string, mentioned: boolean) => void;
	clearChannelUnread: (channelId: string) => void;
};
