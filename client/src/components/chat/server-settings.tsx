import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { api, type HuddlePermission, type HuddleServerRole } from "@/lib/api";
import { requireCredentials } from "@/lib/chat-store";
import { useChatStore } from "@/stores/chat-store";
import { useAuthStore } from "@/stores/auth-store";
import { useShallow } from "zustand/react/shallow";

type Tab = "overview" | "roles" | "members" | "channels";

export function ServerSettings({ open, onClose }: { open: boolean; onClose: () => void }) {
	const user = useAuthStore((state) => state.user);
	const { server, channels, members, roles, permissions, loadRoles, updateServer, deleteServer, transferOwnership, createRole, updateRole, deleteRole, assignRole, removeMember, banMember, setChannelAccess } = useChatStore(useShallow((state) => ({
		server: state.servers.find(({ id }) => id === state.serverId), channels: state.channels, members: state.members, roles: state.roles, permissions: state.permissions,
		loadRoles: state.loadRoles, updateServer: state.updateServer, deleteServer: state.deleteServer, transferOwnership: state.transferOwnership, createRole: state.createRole, updateRole: state.updateRole, deleteRole: state.deleteRole, assignRole: state.assignRole, removeMember: state.removeMember, banMember: state.banMember, setChannelAccess: state.setChannelAccess,
	})));
	const [tab, setTab] = useState<Tab>("overview");
	const [name, setName] = useState("");
	const [iconUrl, setIconUrl] = useState<string | null>(null);
	const [roleId, setRoleId] = useState<string | null>(null);
	const [roleName, setRoleName] = useState("");
	const [roleColor, setRoleColor] = useState("#64748b");
	const [rolePermissions, setRolePermissions] = useState<string[]>([]);
	const [channelId, setChannelId] = useState("");
	const [channelRoles, setChannelRoles] = useState<string[]>([]);
	const [newOwnerId, setNewOwnerId] = useState("");
	const [saving, setSaving] = useState(false);
	const [channelAccessStatus, setChannelAccessStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
	const [serverStatus, setServerStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

	useEffect(() => { if (open) void loadRoles(); }, [open, loadRoles]);
	useEffect(() => { setName(server?.name ?? ""); setIconUrl(server?.iconUrl ?? null); }, [server?.id, server?.name, server?.iconUrl]);
	useEffect(() => { setNewOwnerId(""); }, [server?.id]);
	const selectedRole = roles.find(({ id }) => id === roleId);
	const groupedPermissions = useMemo(() => permissions.reduce<Record<string, HuddlePermission[]>>((groups, permission) => { (groups[permission.category] ??= []).push(permission); return groups; }, {}), [permissions]);
	const allPermissionKeys = useMemo(() => permissions.map(({ key }) => key), [permissions]);
	const allPermissionsSelected = allPermissionKeys.length > 0 && allPermissionKeys.every((key) => rolePermissions.includes(key));

	const selectRole = (role: HuddleServerRole | null) => { setRoleId(role?.id ?? null); setRoleName(role?.name ?? ""); setRoleColor(role?.color ?? "#64748b"); setRolePermissions(role?.permissions ?? []); };
	const selectChannel = (id: string) => { setChannelId(id); setChannelRoles(channels.find(({ id: channelId }) => channelId === id)?.roleIds ?? []); setChannelAccessStatus(null); };
	const saveChannelAccess = async () => {
		if (!channelId || saving) return;
		setSaving(true);
		setChannelAccessStatus(null);
		try {
			const saved = await setChannelAccess(channelId, channelRoles);
			setChannelAccessStatus(saved
				? { type: "success", message: "Acesso do canal salvo com sucesso." }
				: { type: "error", message: "Não foi possível salvar o acesso. Tente novamente." });
		} catch {
			setChannelAccessStatus({ type: "error", message: "Não foi possível salvar o acesso. Tente novamente." });
		} finally {
			setSaving(false);
		}
	};
	const saveServer = async () => {
		if (saving) return;
		setSaving(true);
		setServerStatus(null);
		try {
			const saved = await updateServer({ name, iconUrl });
			setServerStatus(saved
				? { type: "success", message: "Configurações do servidor salvas com sucesso." }
				: { type: "error", message: "Não foi possível salvar o servidor. Tente novamente." });
		} catch {
			setServerStatus({ type: "error", message: "Não foi possível salvar o servidor. Tente novamente." });
		} finally {
			setSaving(false);
		}
	};
	const feedback = tab === "channels" ? channelAccessStatus : tab === "overview" ? serverStatus : null;
	const saveRole = async () => { if (!roleName.trim()) return; setSaving(true); if (roleId) await updateRole(roleId, { name: roleName.trim(), color: roleColor, permissions: rolePermissions }); else await createRole({ name: roleName.trim(), color: roleColor, permissions: rolePermissions }); setSaving(false); selectRole(null); };
	const uploadIcon = async (file?: File) => { if (!file) return; const { token } = requireCredentials(); const form = new FormData(); form.append("file", file); const result = await api<{ media: { url: string } }>("/uploads", { method: "POST", body: form }, token); setIconUrl(result.media.url); };

	const isOwner = server?.ownerId === user?.id;
	const transferOwnershipToMember = async () => {
		if (!newOwnerId) return;
		if (!window.confirm("Transferir a propriedade deste servidor? Essa ação não pode ser desfeita automaticamente.")) return;
		if (await transferOwnership(newOwnerId)) onClose();
	};
	const deleteCurrentServer = async () => {
		if (!window.confirm(`Excluir ${server?.name ?? "este servidor"}? Todos os canais, mensagens e membros serão removidos.`)) return;
		await deleteServer();
	};

	return <Modal wide open={open} onClose={onClose} title={`Configurações de ${server?.name ?? "servidor"}`} description="Gerencie identidade, cargos, membros e canais privados.">
		{feedback && <div role={feedback.type === "error" ? "alert" : "status"} aria-live="polite" className={`mb-5 rounded-xl border px-4 py-3 text-sm font-bold ${feedback.type === "success" ? "border-green-600/25 bg-green-600/10 text-green-800" : "border-red-600/25 bg-red-600/10 text-red-700"}`}>{feedback.message}</div>}
		<div className="grid gap-5 md:grid-cols-[150px_minmax(0,1fr)]">
			<nav className="flex gap-1 overflow-x-auto md:block md:space-y-1">{(["overview", "roles", "members", "channels"] as Tab[]).map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={`w-full rounded-xl px-3 py-2 text-left text-sm font-bold ${tab === item ? "bg-(--brand)/20" : "hover:bg-(--surface)"}`}>{({ overview: "Visão geral", roles: "Cargos", members: "Membros", channels: "Canais" } as Record<Tab, string>)[item]}</button>)}</nav>
			<div className="min-w-0">
				{tab === "overview" && <section className="space-y-5"><div className="space-y-4"><label className="block text-sm font-bold">Nome<input value={name} onChange={(event) => { setServerStatus(null); setName(event.target.value); }} className="mt-2 h-11 w-full rounded-xl border border-(--line) bg-(--surface) px-3 font-normal" /></label><label className="block text-sm font-bold">Ícone<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void uploadIcon(event.target.files?.[0])} className="mt-2 block w-full text-sm font-normal" /></label>{iconUrl && <img src={new URL(iconUrl, window.location.origin).toString()} alt="Ícone do servidor" className="size-16 rounded-2xl object-cover" />}<button type="button" disabled={saving} onClick={() => void saveServer()} className="rounded-xl bg-(--solid) px-4 py-2 text-sm font-bold text-(--on-solid) disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Salvando..." : "Salvar servidor"}</button>{serverStatus && <p role={serverStatus.type === "error" ? "alert" : "status"} aria-live="polite" className={`text-sm ${serverStatus.type === "success" ? "text-green-700" : "text-red-600"}`}>{serverStatus.message}</p>}</div>{isOwner && <div className="space-y-3 border-t border-(--line) pt-5"><div><h3 className="text-sm font-black">Transferir propriedade</h3><p className="mt-1 text-sm text-(--muted-text)">O novo proprietário precisa ser membro. Você continuará com os cargos e permissões que já possui.</p></div><div className="flex flex-wrap gap-2"><select value={newOwnerId} onChange={(event) => setNewOwnerId(event.target.value)} className="h-10 min-w-48 flex-1 rounded-xl border border-(--line) bg-(--surface) px-3 text-sm"><option value="">Selecione um membro</option>{members.filter((member) => member.id !== server?.ownerId).map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}</select><button type="button" disabled={!newOwnerId} onClick={() => void transferOwnershipToMember()} className="rounded-xl bg-(--solid) px-4 py-2 text-sm font-bold text-(--on-solid) disabled:cursor-not-allowed disabled:opacity-50">Transferir</button></div></div>}{isOwner && <div className="space-y-3 border border-red-200 pt-5"><div><h3 className="text-sm font-black text-red-600">Zona de perigo</h3><p className="mt-1 text-sm text-(--muted-text)">Excluir o servidor remove permanentemente seus canais, mensagens e membros.</p></div><button type="button" onClick={() => void deleteCurrentServer()} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white">Excluir servidor</button></div>}</section>}
				{tab === "roles" && <section className="space-y-4"><div className="flex gap-2 overflow-x-auto">{roles.map((role) => <button key={role.id} type="button" onClick={() => selectRole(role)} className={`shrink-0 rounded-xl border px-3 py-2 text-sm font-bold ${roleId === role.id ? "border-(--brand)" : "border-(--line)"}`}><span className="mr-2 inline-block size-2 rounded-full" style={{ backgroundColor: role.color }} />{role.name}</button>)}<button type="button" onClick={() => selectRole(null)} className="rounded-xl bg-(--surface) px-3 py-2 text-sm font-bold">+ Novo cargo</button></div>{(roleId !== null || !selectedRole) && <><label className="block text-sm font-bold">Nome<input value={roleName} onChange={(event) => setRoleName(event.target.value)} className="mt-2 h-10 w-full rounded-xl border border-(--line) bg-(--surface) px-3 font-normal" /></label><label className="block text-sm font-bold">Cor<input type="color" value={roleColor} onChange={(event) => setRoleColor(event.target.value)} className="ml-3 h-8 w-12" /></label><div className="flex items-center justify-between"><span className="text-sm font-bold">Permissões</span><button type="button" onClick={() => setRolePermissions(allPermissionsSelected ? [] : allPermissionKeys)} className="rounded-lg bg-(--surface) px-3 py-1.5 text-xs font-bold hover:bg-(--brand)/20">{allPermissionsSelected ? "Desmarcar todos" : "Selecionar todos"}</button></div><div className="max-h-56 space-y-3 overflow-y-auto rounded-xl border border-(--line) p-3">{Object.entries(groupedPermissions).map(([category, items]) => <fieldset key={category}><legend className="text-xs font-black uppercase tracking-wider text-(--muted-text)">{category}</legend>{items.map((permission) => <label key={permission.key} className="mt-2 flex gap-2 text-sm"><input type="checkbox" checked={rolePermissions.includes(permission.key)} onChange={(event) => setRolePermissions((current) => event.target.checked ? [...current, permission.key] : current.filter((key) => key !== permission.key))} />{permission.label}</label>)}</fieldset>)}</div><div className="flex gap-2"><button type="button" disabled={saving || !roleName.trim()} onClick={() => void saveRole()} className="rounded-xl bg-(--solid) px-4 py-2 text-sm font-bold text-(--on-solid)">{saving ? "Salvando..." : "Salvar cargo"}</button>{selectedRole && !selectedRole.isDefault && <button type="button" onClick={() => void deleteRole(selectedRole.id)} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white">Excluir</button>}</div></>}</section>}
				{tab === "members" && <section className="space-y-3">{members.map((member) => <div key={member.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-(--line) p-3"><span className="mr-auto text-sm font-bold">{member.displayName}{member.id === server?.ownerId && <span className="ml-2 text-xs text-(--brand)">Owner</span>}</span>{roles.filter(({ isDefault }) => !isDefault).map((role) => <label key={role.id} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={member.roles?.some(({ id }) => id === role.id) ?? false} onChange={(event) => void assignRole(member.id, role.id, event.target.checked)} />{role.name}</label>)}{member.id !== server?.ownerId && <><button type="button" onClick={() => { if (window.confirm(`Remover ${member.displayName}?`)) void removeMember(member); }} className="rounded-lg px-2 py-1 text-xs font-bold text-red-600">Remover</button><button type="button" onClick={() => { if (window.confirm(`Banir ${member.displayName}?`)) void banMember(member); }} className="rounded-lg bg-red-600 px-2 py-1 text-xs font-bold text-white">Banir</button></>}</div>)}</section>}
				{tab === "channels" && <section className="space-y-3"><select value={channelId} onChange={(event) => selectChannel(event.target.value)} className="h-11 w-full rounded-xl border border-(--line) bg-(--surface) px-3"><option value="">Selecione um canal</option>{channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.type === "voice" ? "🔊" : "#"} {channel.name}</option>)}</select>{channelId && <><p className="text-sm text-(--muted-text)">Sem cargos selecionados, o canal é público.</p><div className="space-y-2">{roles.map((role) => <label key={role.id} className="flex gap-2 text-sm"><input type="checkbox" checked={channelRoles.includes(role.id)} onChange={(event) => { setChannelAccessStatus(null); setChannelRoles((current) => event.target.checked ? [...current, role.id] : current.filter((id) => id !== role.id)); }} />{role.name}</label>)}</div><button type="button" disabled={saving} onClick={() => void saveChannelAccess()} className="rounded-xl bg-(--solid) px-4 py-2 text-sm font-bold text-(--on-solid) disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Salvando..." : "Salvar acesso"}</button>{channelAccessStatus && <p role={channelAccessStatus.type === "error" ? "alert" : "status"} aria-live="polite" className={`text-sm ${channelAccessStatus.type === "success" ? "text-green-700" : "text-red-600"}`}>{channelAccessStatus.message}</p>}</>}</section>}
			</div>
		</div>
	</Modal>;
}
