import { useChatStore } from "@/stores/chat-store";
import { useAuthStore } from "@/stores/auth-store";
import { useShallow } from "zustand/react/shallow";
import { BrandMark } from "../brand-logo";
import { Plus, Settings, UserPlus, X } from "lucide-react";
import ServerButton from "./server-button";
import NavButton from "./nav-button";
import ChannelButton from "./channel-button";
import { UserAvatar } from "../user-avatar";

function getMemberRoleLabel(role: string) {
    switch (role) {
        case "owner":
            return "proprietário";

        case "moderator":
            return "moderador";

        default:
            return "membro";
    }
}

export default function MobileNavigation() {
    const user = useAuthStore((state) => state.user);
    const {
        mobileNavOpen,
        setMobileNavOpen,
        servers,
        channels,
        members,
        serverId,
        channelId,
        selectServer,
        selectChannel,
        openDialog,
        createInvite,
        setSettingsOpen,
    } = useChatStore(
        useShallow((state) => ({
            mobileNavOpen: state.mobileNavOpen,
            setMobileNavOpen: state.setMobileNavOpen,
            servers: state.servers,
            channels: state.channels,
            members: state.members,
            serverId: state.serverId,
            channelId: state.channelId,
            selectServer: state.setServerId,
            selectChannel: state.setChannelId,
            openDialog: state.openDialog,
            createInvite: state.createInvite,
            setSettingsOpen: state.setSettingsOpen,
        })),
    );

    const activeServer = servers.find((server) => server.id === serverId);
    const createInviteAction = () => {
        if (activeServer?.ownerId === user?.id) openDialog("create-invite");
        else void createInvite();
    };
    const textChannels = channels.filter((channel) => channel.type === "text");
    const voiceChannels = channels.filter((channel) => channel.type === "voice");

    const handleClose = () => {
        setMobileNavOpen(false);
    };

    const handleSelectServer = (id: string) => {
        selectServer(id);
        handleClose();
    };

    const handleSelectChannel = (id: string) => {
        selectChannel(id);
        handleClose();
    };

    const handleAddServer = () => {
        openDialog("add-server");
        handleClose();
    };

    const handleCreateChannel = () => {
        openDialog("create-channel");
    };

    if (!mobileNavOpen) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 z-50 lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Navegação do servidor"
        >
            <button
                type="button"
                className="absolute inset-0 bg-(--solid)/45 backdrop-blur-sm"
                onClick={handleClose}
                aria-label="Fechar navegação"
            />

            <aside className="relative flex h-full w-[min(88vw,360px)] flex-col bg-(--panel) shadow-2xl">
                <header className="flex h-19 shrink-0 items-center gap-3 border-b border-(--ink)/10 px-4">
                    <BrandMark className="size-10" />

                    <div className="min-w-0 flex-1">
                        <p className="truncate font-black">
                            {activeServer?.name ?? "huddle"}
                        </p>

                        <p className="text-xs text-(--muted-text)">
                            navegação
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={handleClose}
                        className="grid size-9 place-items-center rounded-xl bg-(--surface)"
                        aria-label="Fechar"
                    >
                        <X className="size-4" />
                    </button>
                </header>

                <div className="flex min-h-0 flex-1">
                    <div className="flex w-18 shrink-0 flex-col items-center gap-3 bg-(--solid) py-4">
                        <BrandMark className="size-10" />

                        {servers.map((server) => (
                            <ServerButton
                                key={server.id}
                                id={server.id}
                                name={server.name}
                                active={server.id === serverId}
                                onSelect={handleSelectServer}
                                size="small"
                            />
                        ))}

                        <button
                            type="button"
                            onClick={handleAddServer}
                            className="grid size-10 place-items-center rounded-[13px] bg-(--surface)/10 text-(--brand)"
                            aria-label="Adicionar servidor"
                        >
                            <Plus className="size-5" />
                        </button>
                    </div>

                    <div className="min-w-0 flex-1 overflow-y-auto p-4">
                        <div className="mb-5 flex items-center gap-2">
                            <strong className="min-w-0 flex-1 truncate">
                                {activeServer?.name ?? "Servidor"}
                            </strong>

                            <NavButton
                                label="Criar convite"
                                onClick={createInviteAction}
                            >
                                <UserPlus />
                            </NavButton>
                        </div>

                        <section className="mb-6">
                            <div className="mb-2 flex items-center justify-between">
                                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-(--muted-text)">
                                    Canais de texto
                                </p>

                                <button
                                    type="button"
                                    onClick={handleCreateChannel}
                                    aria-label="Criar canal"
                                >
                                    <Plus className="size-4" />
                                </button>
                            </div>

                            {textChannels.map((channel) => (
                                <ChannelButton
                                    key={channel.id}
                                    id={channel.id}
                                    name={channel.name}
                                    active={channel.id === channelId}
                                    type={channel.type}
                                    onSelect={handleSelectChannel}
                                    variant="mobile"
                                />
                            ))}

                            <div className="mb-2 mt-5 flex items-center justify-between">
                                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-(--muted-text)">
                                    Canais de voz
                                </p>

                            </div>

                            {voiceChannels.map((channel) => (
                                <ChannelButton
                                    key={channel.id}
                                    id={channel.id}
                                    name={channel.name}
                                    active={channel.id === channelId}
                                    type={channel.type}
                                    onSelect={handleSelectChannel}
                                    variant="mobile"
                                />
                            ))}
                        </section>

                        <section>
                            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.16em] text-(--muted-text)">
                                Membros · {members?.length ?? 0}
                            </p>

                            {members?.map((member) => (
                                <div
                                    key={member.id}
                                    className="mb-3 flex items-center gap-2"
                                >
                                    <UserAvatar
                                        user={member}
                                        className="size-8 rounded-[10px]"
                                    />

                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold">
                                            {member.displayName}
                                        </p>

                                        <p className="text-[10px] text-(--muted-text)">
                                            {getMemberRoleLabel(member.role)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </section>
                    </div>
                </div>

                {user && (
                    <button
                        type="button"
                        onClick={() => {
                            setSettingsOpen(true);
                            handleClose();
                        }}
                        className="m-3 flex items-center gap-3 rounded-2xl border border-(--ink)/10 bg-(--surface) p-3 text-left"
                        aria-label="Abrir configurações do perfil"
                    >
                        <UserAvatar user={user} className="size-10 rounded-xl" />
                        <span className="min-w-0 flex-1">
                            <strong className="block truncate text-sm">{user.displayName}</strong>
                            <span className="block truncate text-[11px] text-(--muted-text)">{user.email}</span>
                        </span>
                        <Settings className="size-4 text-(--muted-text)" />
                    </button>
                )}
            </aside>
        </div>
    );
}
