import type { SetStateAction } from "react";
import type { HuddleChannel, HuddleMember, HuddlePermission, HuddleServer, HuddleServerRole } from "@/lib/api";

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
	updateServer: (input: { name?: string; iconUrl?: string | null }) => Promise<void>;
	setChannelAccess: (channelId: string, roleIds: string[]) => Promise<void>;
	createServer: (value: string) => Promise<void>;
	createChannel: (value: string, type?: HuddleChannel["type"]) => Promise<void>;
	joinServer: (value: string) => Promise<void>;
	createInvite: (durationHours?: number) => Promise<void>;
	leaveServer: () => Promise<void>;
	changeMemberRole: (member: HuddleMember) => Promise<void>;
	removeMember: (member: HuddleMember) => Promise<void>;
	banMember: (member: HuddleMember) => Promise<void>;
	clearError: () => void;
};
