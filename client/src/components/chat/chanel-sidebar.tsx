import { useChatStore } from "@/stores/chat-store";
import { useShallow } from "zustand/react/shallow";
import NavButton from "./nav-button";
import { LogOut, Plus, UserPlus } from "lucide-react";
import ChannelButton from "./channel-button";

export function ChannelSidebar() {
    const {
        servers,
        serverId,
        channels,
        channelId,
        selectChannel,
        openDialog,
        createInvite,
        leaveServer,
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
        })),
    );

    const activeServer = servers.find((server) => server.id === serverId);

    const handleCreateChannel = () => {
        openDialog("create-channel");
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

            <div className="p-3">
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

                {channels.map((channel) => (
                    <ChannelButton
                        key={channel.id}
                        id={channel.id}
                        name={channel.name}
                        active={channel.id === channelId}
                        onSelect={selectChannel}
                    />
                ))}
            </div>
        </aside>
    );
}
