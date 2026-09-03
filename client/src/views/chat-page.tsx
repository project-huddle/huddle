import { useCallback, useEffect } from "react";

import { useRealtime } from "@/hooks/use-realtime";
import { CallRoom } from "@/components/call-room";
import { SocialHub } from "@/components/social-hub";
import { ProfileSettings } from "@/components/profile-settings";
import { ChannelSidebar, MobileNavigation, ServerRail } from "@/components/chat/chat-navigation";
import { RoomSidebar } from "@/components/chat/room-sidebar";
import { ChatDialogs } from "@/components/chat/chat-dialogs";
import { ChatConversation } from "@/components/chat/chat-conversation";
import { useChatStore } from "@/stores/chat-store";
import { useAuthStore } from "@/stores/auth-store";

export default function ChatPage() {
	const user = useAuthStore((state) => state.user)!;
	const token = useAuthStore((state) => state.token)!;
	const updateUser = useAuthStore((state) => state.updateUser);
	const serverId = useChatStore((state) => state.serverId);
	const channelId = useChatStore((state) => state.channelId);
	const callRoomOpen = useChatStore((state) => state.callRoomOpen);
	const socialOpen = useChatStore((state) => state.socialOpen);
	const settingsOpen = useChatStore((state) => state.settingsOpen);
	const setCallRoomOpen = useChatStore((state) => state.setCallRoomOpen);
	const setSocialOpen = useChatStore((state) => state.setSocialOpen);
	const setSettingsOpen = useChatStore((state) => state.setSettingsOpen);
	const loadServers = useChatStore((state) => state.loadServers);
	const loadChannels = useChatStore((state) => state.loadChannels);
	const loadMembers = useChatStore((state) => state.loadMembers);
	const realtime = useRealtime(token, channelId);

	useEffect(() => { void loadServers(); }, [loadServers]);
	useEffect(() => { void loadChannels(); }, [serverId, loadChannels]);
	useEffect(() => { void loadMembers(); }, [serverId, loadMembers]);

	useEffect(() => {
		if (realtime.inCall) setCallRoomOpen(true);
		else setCallRoomOpen(false);
	}, [realtime.inCall, setCallRoomOpen]);

	const closeCallRoom = useCallback(() => {
		realtime.leaveCall();
		setCallRoomOpen(false);
	}, [realtime.leaveCall, setCallRoomOpen]);

	return (
		<main className="chat-page relative h-svh overflow-hidden bg-(--canvas) text-(--ink)">
			<div className="grid h-full w-full grid-cols-1 lg:grid-cols-[82px_240px_minmax(0,1fr)_300px]">
				<ServerRail />
				<ChannelSidebar />
				<ChatConversation realtime={realtime} />

				<RoomSidebar realtime={realtime} />
			</div>

			<MobileNavigation />
			<CallRoom
				open={callRoomOpen}
				onClose={closeCallRoom}
				inCall={realtime.inCall}
				user={user}
				peers={realtime.peers}
				muted={realtime.muted}
				cameraOff={realtime.cameraOff}
				sharing={realtime.sharing}
				localMediaStream={realtime.localMediaStream}
				localDisplayStream={realtime.localDisplayStream}
				onToggleMute={realtime.toggleMute}
				onToggleCamera={realtime.toggleCamera}
				onToggleShare={realtime.toggleShare}
				onLeave={realtime.leaveCall}
			/>
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
				onUpdated={updateUser}
			/>
			<ChatDialogs />
		</main>
	);
}
