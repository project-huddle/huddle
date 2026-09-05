import { useEffect, useRef } from "react";

import { useRealtime } from "@/hooks/use-realtime";
import { SocialHub } from "@/components/social-hub";
import { ProfileSettings } from "@/components/profile-settings";
import { RoomSidebar } from "@/components/chat/room-sidebar";
import { ChatDialogs } from "@/components/chat/chat-dialogs";
import { ChatConversation } from "@/components/chat/chat-conversation";
import { useChatStore } from "@/stores/chat-store";
import { useAuthStore } from "@/stores/auth-store";
import MobileNavigation from "@/components/chat/mobile-navigation";
import { ServerRail } from "@/components/chat/server-rail";
import { ChannelSidebar } from "@/components/chat/chanel-sidebar";

export default function ChatPage() {
	const user = useAuthStore((state) => state.user)!;
	const token = useAuthStore((state) => state.token)!;
	const updateUser = useAuthStore((state) => state.updateUser);
	const logout = useAuthStore((state) => state.logout);
	const serverId = useChatStore((state) => state.serverId);
	const channelId = useChatStore((state) => state.channelId);
	const activeChannel = useChatStore((state) => state.channels.find(({ id }) => id === state.channelId));
	const socialOpen = useChatStore((state) => state.socialOpen);
	const settingsOpen = useChatStore((state) => state.settingsOpen);
	const setSocialOpen = useChatStore((state) => state.setSocialOpen);
	const setSettingsOpen = useChatStore((state) => state.setSettingsOpen);
	const loadServers = useChatStore((state) => state.loadServers);
	const loadChannels = useChatStore((state) => state.loadChannels);
	const loadMembers = useChatStore((state) => state.loadMembers);
	const realtime = useRealtime(token, channelId, activeChannel?.type ?? "text");
	const { joinCall } = realtime;
	const autoJoinedChannelId = useRef("");

	useEffect(() => {
		if (activeChannel?.type !== "voice") {
			autoJoinedChannelId.current = "";
			return;
		}
		if (
			autoJoinedChannelId.current === channelId ||
			!realtime.connected ||
			realtime.inCall ||
			realtime.joining
		)
			return;
		autoJoinedChannelId.current = channelId;
		void joinCall();
	}, [activeChannel?.type, channelId, joinCall, realtime.connected, realtime.inCall, realtime.joining]);

	useEffect(() => { void loadServers(); }, [loadServers]);
	useEffect(() => { void loadChannels(); }, [serverId, loadChannels]);
	useEffect(() => { void loadMembers(); }, [serverId, loadMembers]);

	return (
		<main className="chat-page relative h-svh overflow-hidden bg-(--canvas) text-(--ink)">
			<div className="grid h-full w-full grid-cols-1 lg:grid-cols-[82px_240px_minmax(0,1fr)_300px]">
				<ServerRail />
				<ChannelSidebar />
				<ChatConversation realtime={realtime} />

				<RoomSidebar />
			</div>

			<MobileNavigation />
			<SocialHub
				currentUser={user}
				token={token}
				open={socialOpen}
				onClose={() => setSocialOpen(false)}
			/>
			<ProfileSettings
				token={token}
				open={settingsOpen}
				onClose={() => setSettingsOpen(false)}
				onLogout={logout}
				onUpdated={updateUser}
			/>
			<ChatDialogs />
		</main>
	);
}
