import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, Volume2 } from "lucide-react";

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
	const setChannelId = useChatStore((state) => state.setChannelId);
	const socialOpen = useChatStore((state) => state.socialOpen);
	const settingsOpen = useChatStore((state) => state.settingsOpen);
	const setSocialOpen = useChatStore((state) => state.setSocialOpen);
	const setSettingsOpen = useChatStore((state) => state.setSettingsOpen);
	const loadServers = useChatStore((state) => state.loadServers);
	const loadChannels = useChatStore((state) => state.loadChannels);
	const loadMembers = useChatStore((state) => state.loadMembers);
	const [callChannelId, setCallChannelId] = useState("");
	const previousChannelId = useRef("");
	const messageChannelId = activeChannel?.type === "text" ? channelId : "";
	const messageRealtime = useRealtime(token, messageChannelId, "text");
	const callRealtime = useRealtime(token, callChannelId, "voice");
	const {
		connected: callConnected,
		inCall,
		joinCall,
		joining,
	} = callRealtime;
	const conversationRealtime = activeChannel?.type === "voice"
		? callRealtime
		: messageRealtime;

	useEffect(() => {
		if (previousChannelId.current === channelId) return;
		previousChannelId.current = channelId;
		if (activeChannel?.type === "voice") setCallChannelId(channelId);
	}, [activeChannel?.type, channelId]);

	useEffect(() => {
		if (!callChannelId || !callConnected || inCall || joining) return;
		void joinCall();
	}, [callChannelId, callConnected, inCall, joinCall, joining]);

	useEffect(() => { void loadServers(); }, [loadServers]);
	useEffect(() => { void loadChannels(); }, [serverId, loadChannels]);
	useEffect(() => { void loadMembers(); }, [serverId, loadMembers]);

	return (
		<main className="chat-page relative h-svh overflow-hidden bg-(--canvas) text-(--ink)">
			<div className="grid h-full w-full grid-cols-1 lg:grid-cols-[82px_240px_minmax(0,1fr)_300px]">
				<ServerRail />
				<ChannelSidebar />
				<ChatConversation realtime={conversationRealtime} />

				<RoomSidebar />
			</div>

			<MobileNavigation />
			{callRealtime.inCall && activeChannel?.id !== callChannelId && (
				<div className="fixed bottom-4 right-4 z-40 flex items-center gap-3 rounded-2xl border border-(--line) bg-(--solid) p-3 text-(--on-solid) shadow-2xl">
					<button type="button" onClick={() => setChannelId(callChannelId)} className="flex min-w-0 items-center gap-3 text-left">
						<span className="grid size-10 place-items-center rounded-xl bg-(--brand) text-(--ink)"><Volume2 className="size-5" /></span>
						<span className="min-w-0">
							<strong className="block text-sm">Chamada ativa</strong>
							<span className="block text-xs text-(--on-solid)/55">{callRealtime.peers.length + 1} conectados</span>
						</span>
					</button>
					<button type="button" onClick={callRealtime.toggleMute} className={`grid size-9 place-items-center rounded-xl ${callRealtime.muted ? "bg-[#d75a4a]" : "bg-white/10"}`} aria-label={callRealtime.muted ? "Ativar microfone" : "Silenciar"}>
						{callRealtime.muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
					</button>
					<button type="button" onClick={() => { callRealtime.leaveCall(); setCallChannelId(""); }} className="grid size-9 place-items-center rounded-xl bg-[#d75a4a]" aria-label="Sair da chamada"><PhoneOff className="size-4" /></button>
				</div>
			)}
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
