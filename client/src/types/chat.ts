import type { SetStateAction } from "react";
import type { HuddleChannel, HuddleMember, HuddleServer } from "@/lib/api";

export type ChatDialog =
	| "add-server"
	| "create-server"
	| "create-channel"
	| "create-voice-channel"
	| "join-server";

export type ChatStoreState = {
	servers: HuddleServer[];
	channels: HuddleChannel[];
	members: HuddleMember[];
	serverId: string;
	channelId: string;
	replyTo: string | null;
	creating: boolean;
	mobileNavOpen: boolean;
	callRoomOpen: boolean;
	socialOpen: boolean;
	settingsOpen: boolean;
	dialog: ChatDialog | null;
	dialogValue: string;
	inviteCode: string | null;
	error: string | null;
	setServers: (value: SetStateAction<HuddleServer[]>) => void;
	setChannels: (value: SetStateAction<HuddleChannel[]>) => void;
	setMembers: (value: SetStateAction<HuddleMember[]>) => void;
	setServerId: (value: SetStateAction<string>) => void;
	setChannelId: (value: SetStateAction<string>) => void;
	setReplyTo: (value: string | null) => void;
	setCreating: (value: boolean) => void;
	setInviteCode: (value: string | null) => void;
	openDialog: (dialog: ChatDialog) => void;
	closeDialog: () => void;
	setDialogValue: (value: string) => void;
	setMobileNavOpen: (value: boolean) => void;
	setCallRoomOpen: (value: boolean) => void;
	setSocialOpen: (value: boolean) => void;
	setSettingsOpen: (value: boolean) => void;
	reset: () => void;
	loadServers: () => Promise<void>;
	loadChannels: () => Promise<void>;
	loadMembers: () => Promise<void>;
	createServer: (value: string) => Promise<void>;
	createChannel: (value: string, type?: HuddleChannel["type"]) => Promise<void>;
	joinServer: (value: string) => Promise<void>;
	createInvite: () => Promise<void>;
	leaveServer: () => Promise<void>;
	changeMemberRole: (member: HuddleMember) => Promise<void>;
	removeMember: (member: HuddleMember) => Promise<void>;
	clearError: () => void;
};
