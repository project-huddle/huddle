import { Hash, LogOut, MessageCircle, Plus, UserPlus, Users, X } from "lucide-react";

import { BrandMark } from "@/components/brand-logo";
import { UserAvatar } from "@/components/user-avatar";
import { cn, getInitials } from "@/lib/utils";
import { useChatStore } from "@/stores/chat-store";
import { useShallow } from "zustand/react/shallow";

export function ServerRail() {
	const { servers, serverId, creating, onSelectServer, onOpenDialog, setSocialOpen } = useChatStore(useShallow((state) => ({
		servers: state.servers, serverId: state.serverId, creating: state.creating,
		onSelectServer: state.setServerId, onOpenDialog: state.openDialog, setSocialOpen: state.setSocialOpen,
	})));
	const onOpenSocial = () => setSocialOpen(true);
	return <aside className="hidden flex-col items-center gap-3 border-r border-[var(--ink)]/10 bg-[var(--solid)] py-5 lg:flex">
		<BrandMark className="size-11" />
		<button onClick={onOpenSocial} className="grid size-11 place-items-center rounded-[15px] bg-[var(--surface)]/10 text-[var(--on-solid)] hover:bg-[var(--brand)] hover:text-[var(--ink)]" aria-label="Amigos e mensagens privadas"><MessageCircle className="size-5" /></button>
		{servers.map((server) => <button key={server.id} onClick={() => onSelectServer(server.id)} title={server.name} className={cn("grid size-11 place-items-center rounded-[15px] text-sm font-black transition", server.id === serverId ? "bg-[var(--brand)] text-[var(--ink)]" : "bg-[var(--surface)]/10 text-[var(--on-solid)] hover:bg-[var(--surface)]/20")}>{getInitials(server.name)}</button>)}
		<button onClick={() => onOpenDialog("create-server")} disabled={creating} className="grid size-11 place-items-center rounded-[15px] bg-[var(--surface)]/10 text-[var(--brand)] hover:bg-[var(--surface)]/20" aria-label="Criar servidor"><Plus className="size-5" /></button>
	</aside>;
}

export function ChannelSidebar() {
	const { servers, serverId, channels, channelId, onSelectChannel, onOpenDialog, onCreateInvite, leaveServer } = useChatStore(useShallow((state) => ({
		servers: state.servers, serverId: state.serverId, channels: state.channels, channelId: state.channelId,
		onSelectChannel: state.setChannelId, onOpenDialog: state.openDialog,
		onCreateInvite: state.createInvite, leaveServer: state.leaveServer,
	})));
	const activeServer = servers.find(({ id }) => id === serverId);
	const onLeaveServer = () => { if (window.confirm(`Sair de ${activeServer?.name ?? "este servidor"}?`)) void leaveServer(); };
	return <aside className="hidden min-h-0 flex-col border-r border-[var(--ink)]/10 bg-[var(--panel)] lg:flex">
		<div className="flex h-19 items-center border-b border-[var(--ink)]/10 px-4"><strong className="truncate text-sm">{activeServer?.name ?? "Servidores"}</strong><div className="ml-auto flex gap-1">
			<NavButton label="Criar convite" onClick={onCreateInvite}><UserPlus /></NavButton><NavButton label="Entrar com convite" onClick={() => onOpenDialog("join-server")}><Users /></NavButton><NavButton label="Sair do servidor" onClick={onLeaveServer}><LogOut /></NavButton><NavButton label="Criar servidor" onClick={() => onOpenDialog("create-server")}><Plus /></NavButton>
		</div></div>
		<div className="p-3"><div className="flex items-center px-2 pb-2"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted-text)]">Canais de texto</p><button onClick={() => onOpenDialog("create-channel")} className="ml-auto text-[var(--muted-text)] hover:text-[var(--ink)]" aria-label="Criar canal"><Plus className="size-3.5" /></button></div>
			{channels.map((channel) => <button key={channel.id} onClick={() => onSelectChannel(channel.id)} className={cn("flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm", channel.id === channelId ? "bg-[var(--surface)] font-bold shadow-sm" : "text-[var(--muted-text)] hover:bg-[var(--surface)]/60")}><Hash className="size-4" />{channel.name}</button>)}
		</div>
	</aside>;
}

function NavButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
	return <button onClick={onClick} className="grid size-8 place-items-center rounded-lg hover:bg-[var(--surface)] [&>svg]:size-4" aria-label={label}>{children}</button>;
}

export function MobileNavigation() {
	const props = useChatStore(useShallow((state) => ({
		mobileNavOpen: state.mobileNavOpen, setMobileNavOpen: state.setMobileNavOpen,
		servers: state.servers, channels: state.channels, members: state.members,
		serverId: state.serverId, channelId: state.channelId, setServerId: state.setServerId,
		setChannelId: state.setChannelId, openDialog: state.openDialog, createInvite: state.createInvite,
	})));
	const open = props.mobileNavOpen;
	const onClose = () => props.setMobileNavOpen(false);
	const activeServer = props.servers.find(({ id }) => id === props.serverId);
	if (!open) return null;
	const selectServer = (id: string) => { props.setServerId(id); onClose(); };
	const selectChannel = (id: string) => { props.setChannelId(id); onClose(); };
	return <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navegação do servidor">
		<button className="absolute inset-0 bg-[var(--solid)]/45 backdrop-blur-sm" onClick={onClose} aria-label="Fechar navegação" />
		<aside className="relative flex h-full w-[min(88vw,360px)] flex-col bg-[var(--panel)] shadow-2xl">
			<div className="flex h-19 shrink-0 items-center gap-3 border-b border-[var(--ink)]/10 px-4"><BrandMark className="size-10" /><div className="min-w-0 flex-1"><p className="truncate font-black">{activeServer?.name ?? "huddle"}</p><p className="text-xs text-[var(--muted-text)]">navegação</p></div><button onClick={onClose} className="grid size-9 place-items-center rounded-xl bg-[var(--surface)]" aria-label="Fechar"><X className="size-4" /></button></div>
			<div className="flex min-h-0 flex-1"><div className="flex w-18 shrink-0 flex-col items-center gap-3 bg-[var(--solid)] py-4"><BrandMark className="size-10" />{props.servers.map((server) => <button key={server.id} onClick={() => selectServer(server.id)} title={server.name} className={cn("grid size-10 place-items-center rounded-[13px] text-xs font-black", server.id === props.serverId ? "bg-[var(--brand)] text-[var(--ink)]" : "bg-[var(--surface)]/10 text-[var(--on-solid)]")}>{getInitials(server.name)}</button>)}<button onClick={() => props.openDialog("create-server")} className="grid size-10 place-items-center rounded-[13px] bg-[var(--surface)]/10 text-[var(--brand)]" aria-label="Criar servidor"><Plus /></button></div>
				<div className="min-w-0 flex-1 overflow-y-auto p-4"><div className="mb-5 flex items-center gap-2"><strong className="min-w-0 flex-1 truncate">{activeServer?.name ?? "Servidor"}</strong><NavButton label="Criar convite" onClick={props.createInvite}><UserPlus /></NavButton><NavButton label="Entrar com convite" onClick={() => props.openDialog("join-server")}><Users /></NavButton></div>
					<div className="mb-6"><div className="mb-2 flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted-text)]">Canais</p><button onClick={() => props.openDialog("create-channel")} aria-label="Criar canal"><Plus className="size-4" /></button></div>{props.channels.map((channel) => <button key={channel.id} onClick={() => selectChannel(channel.id)} className={cn("mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-3 text-left text-sm", channel.id === props.channelId ? "bg-[var(--surface)] font-bold shadow-sm" : "text-[var(--muted-text)] hover:bg-[var(--surface)]/60")}><Hash />{channel.name}</button>)}</div>
					<div><p className="mb-3 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted-text)]">Membros · {props.members?.length ?? 0}</p>{props.members?.map((member) => <div key={member.id} className="mb-3 flex items-center gap-2"><UserAvatar user={member} className="size-8 rounded-[10px]" /><div className="min-w-0"><p className="truncate text-sm font-semibold">{member.displayName}</p><p className="text-[10px] text-[var(--muted-text)]">{member.role === "owner" ? "proprietário" : member.role === "moderator" ? "moderador" : "membro"}</p></div></div>)}</div>
				</div></div>
		</aside>
	</div>;
}
