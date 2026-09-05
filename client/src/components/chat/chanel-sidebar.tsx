import { useChatStore } from "@/stores/chat-store";
import { useAuthStore } from "@/stores/auth-store";
import { useShallow } from "zustand/react/shallow";
import NavButton from "./nav-button";
import { LogOut, Plus, Settings, UserPlus } from "lucide-react";
import ChannelButton from "./channel-button";
import { UserAvatar } from "@/components/user-avatar";

export function ChannelSidebar() {
    const user = useAuthStore((state) => state.user);
    const {
        servers,
        serverId,
        channels,
        channelId,
        selectChannel,
        openDialog,
        createInvite,
        leaveServer,
        setSettingsOpen,
    } = useChatStore(
        useShallow((state) => ({
            servers: state.servers,
            serverId: state.serverId,
            channels: state.channels,
            channelId: state.channelId,
            selectChannel: state.setChannelId,
            openDialog: state.openDialog,
            createInvite: state.createInvite,
            leaveServer: state.leaveServer,
            setSettingsOpen: state.setSettingsOpen,
        })),
    );

    const activeServer = servers.find((server) => server.id === serverId);
    const textChannels = channels.filter((channel) => channel.type === "text");
    const voiceChannels = channels.filter((channel) => channel.type === "voice");

    const handleCreateChannel = () => {
        openDialog("create-channel");
    };

    const handleCreateVoiceChannel = () => {
        openDialog("create-voice-channel");
    };

    const handleLeaveServer = () => {
        const serverName = activeServer?.name ?? "este servidor";
        const confirmed = window.confirm(`Sair de ${serverName}?`);

        if (confirmed) {
            void leaveServer();
        }
    };

    return (
        <aside className="hidden min-h-0 flex-col border-r border-(--ink)/10 bg-(--panel) lg:flex">
            <header className="flex h-19 items-center border-b border-(--ink)/10 px-4">
                <strong className="truncate text-sm">
                    {activeServer?.name ?? "Servidores"}
                </strong>

                <div className="ml-auto flex gap-1">
                    <NavButton label="Criar convite" onClick={createInvite}>
                        <UserPlus />
                    </NavButton>

                    <NavButton label="Sair do servidor" onClick={handleLeaveServer}>
                        <LogOut />
                    </NavButton>

                </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <div className="flex items-center px-2 pb-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-(--muted-text)">
                        Canais de texto
                    </p>

                    <button
                        type="button"
                        onClick={handleCreateChannel}
                        className="ml-auto text-(--muted-text) hover:text-(--ink)"
                        aria-label="Criar canal"
                    >
                        <Plus className="size-3.5" />
                    </button>
                </div>

                {textChannels.map((channel) => (
                    <ChannelButton
                        key={channel.id}
                        id={channel.id}
                        name={channel.name}
                        active={channel.id === channelId}
                        type={channel.type}
                        onSelect={selectChannel}
                    />
                ))}

                <div className="flex items-center px-2 pb-2 pt-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-(--muted-text)">
                        Canais de voz
                    </p>

                    <button
                        type="button"
                        onClick={handleCreateVoiceChannel}
                        className="ml-auto text-(--muted-text) hover:text-(--ink)"
                        aria-label="Criar canal de voz"
                    >
                        <Plus className="size-3.5" />
                    </button>
                </div>

                {voiceChannels.map((channel) => (
                    <ChannelButton
                        key={channel.id}
                        id={channel.id}
                        name={channel.name}
                        active={channel.id === channelId}
                        type={channel.type}
                        onSelect={selectChannel}
                    />
                ))}
            </div>

            {user && (
                <button
                    type="button"
                    onClick={() => setSettingsOpen(true)}
                    className="m-3 flex items-center gap-3 rounded-2xl border border-(--ink)/10 bg-(--surface) p-3 text-left transition hover:border-(--brand)"
                    aria-label="Abrir configurações do perfil"
                >
                    <UserAvatar user={user} className="size-10 rounded-xl" />
                    <span className="min-w-0 flex-1">
                        <strong className="block truncate text-sm">
                            {user.displayName}
                        </strong>
                        <span className="block truncate text-[11px] text-(--muted-text)">
                            {user.email}
                        </span>
                    </span>
                    <Settings className="size-4 shrink-0 text-(--muted-text)" />
                </button>
            )}
        </aside>
    );
}
