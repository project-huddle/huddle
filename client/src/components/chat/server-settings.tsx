import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { api, type HuddlePermission, type HuddleServerRole } from "@/lib/api";
import { requireCredentials } from "@/lib/chat-store";
import { useChatStore } from "@/stores/chat-store";
import { useShallow } from "zustand/react/shallow";

type Tab = "overview" | "roles" | "members" | "channels";

export function ServerSettings({ open, onClose }: { open: boolean; onClose: () => void }) {
	const { server, channels, members, roles, permissions, loadRoles, updateServer, createRole, updateRole, deleteRole, assignRole, removeMember, banMember, setChannelAccess } = useChatStore(useShallow((state) => ({
		server: state.servers.find(({ id }) => id === state.serverId), channels: state.channels, members: state.members, roles: state.roles, permissions: state.permissions,
		loadRoles: state.loadRoles, updateServer: state.updateServer, createRole: state.createRole, updateRole: state.updateRole, deleteRole: state.deleteRole, assignRole: state.assignRole, removeMember: state.removeMember, banMember: state.banMember, setChannelAccess: state.setChannelAccess,
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
	const [saving, setSaving] = useState(false);

	useEffect(() => { if (open) void loadRoles(); }, [open, loadRoles]);
	useEffect(() => { setName(server?.name ?? ""); setIconUrl(server?.iconUrl ?? null); }, [server?.id, server?.name, server?.iconUrl]);
	const selectedRole = roles.find(({ id }) => id === roleId);
	const groupedPermissions = useMemo(() => permissions.reduce<Record<string, HuddlePermission[]>>((groups, permission) => { (groups[permission.category] ??= []).push(permission); return groups; }, {}), [permissions]);
	const allPermissionKeys = useMemo(() => permissions.map(({ key }) => key), [permissions]);
	const allPermissionsSelected = allPermissionKeys.length > 0 && allPermissionKeys.every((key) => rolePermissions.includes(key));

	const selectRole = (role: HuddleServerRole | null) => { setRoleId(role?.id ?? null); setRoleName(role?.name ?? ""); setRoleColor(role?.color ?? "#64748b"); setRolePermissions(role?.permissions ?? []); };
	const selectChannel = (id: string) => { setChannelId(id); setChannelRoles(channels.find(({ id: channelId }) => channelId === id)?.roleIds ?? []); };
	const saveRole = async () => { if (!roleName.trim()) return; setSaving(true); if (roleId) await updateRole(roleId, { name: roleName.trim(), color: roleColor, permissions: rolePermissions }); else await createRole({ name: roleName.trim(), color: roleColor, permissions: rolePermissions }); setSaving(false); selectRole(null); };
	const uploadIcon = async (file?: File) => { if (!file) return; const { token } = requireCredentials(); const form = new FormData(); form.append("file", file); const result = await api<{ media: { url: string } }>("/uploads", { method: "POST", body: form }, token); setIconUrl(result.media.url); };

	return <Modal wide open={open} onClose={onClose} title={`Configurações de ${server?.name ?? "servidor"}`} description="Gerencie identidade, cargos, membros e canais privados.">
		<div className="grid gap-5 md:grid-cols-[150px_minmax(0,1fr)]">
			<nav className="flex gap-1 overflow-x-auto md:block md:space-y-1">{(["overview", "roles", "members", "channels"] as Tab[]).map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={`w-full rounded-xl px-3 py-2 text-left text-sm font-bold ${tab === item ? "bg-(--brand)/20" : "hover:bg-(--surface)"}`}>{({ overview: "Visão geral", roles: "Cargos", members: "Membros", channels: "Canais" } as Record<Tab, string>)[item]}</button>)}</nav>
			<div className="min-w-0">
				{tab === "overview" && <section className="space-y-4"><label className="block text-sm font-bold">Nome<input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-(--line) bg-(--surface) px-3 font-normal" /></label><label className="block text-sm font-bold">Ícone<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void uploadIcon(event.target.files?.[0])} className="mt-2 block w-full text-sm font-normal" /></label>{iconUrl && <img src={new URL(iconUrl, window.location.origin).toString()} alt="Ícone do servidor" className="size-16 rounded-2xl object-cover" />}<button type="button" onClick={() => void updateServer({ name, iconUrl })} className="rounded-xl bg-(--solid) px-4 py-2 text-sm font-bold text-(--on-solid)">Salvar servidor</button></section>}
				{tab === "roles" && <section className="space-y-4"><div className="flex gap-2 overflow-x-auto">{roles.map((role) => <button key={role.id} type="button" onClick={() => selectRole(role)} className={`shrink-0 rounded-xl border px-3 py-2 text-sm font-bold ${roleId === role.id ? "border-(--brand)" : "border-(--line)"}`}><span className="mr-2 inline-block size-2 rounded-full" style={{ backgroundColor: role.color }} />{role.name}</button>)}<button type="button" onClick={() => selectRole(null)} className="rounded-xl bg-(--surface) px-3 py-2 text-sm font-bold">+ Novo cargo</button></div>{(roleId !== null || !selectedRole) && <><label className="block text-sm font-bold">Nome<input value={roleName} onChange={(event) => setRoleName(event.target.value)} className="mt-2 h-10 w-full rounded-xl border border-(--line) bg-(--surface) px-3 font-normal" /></label><label className="block text-sm font-bold">Cor<input type="color" value={roleColor} onChange={(event) => setRoleColor(event.target.value)} className="ml-3 h-8 w-12" /></label><div className="flex items-center justify-between"><span className="text-sm font-bold">Permissões</span><button type="button" onClick={() => setRolePermissions(allPermissionsSelected ? [] : allPermissionKeys)} className="rounded-lg bg-(--surface) px-3 py-1.5 text-xs font-bold hover:bg-(--brand)/20">{allPermissionsSelected ? "Desmarcar todos" : "Selecionar todos"}</button></div><div className="max-h-56 space-y-3 overflow-y-auto rounded-xl border border-(--line) p-3">{Object.entries(groupedPermissions).map(([category, items]) => <fieldset key={category}><legend className="text-xs font-black uppercase tracking-wider text-(--muted-text)">{category}</legend>{items.map((permission) => <label key={permission.key} className="mt-2 flex gap-2 text-sm"><input type="checkbox" checked={rolePermissions.includes(permission.key)} onChange={(event) => setRolePermissions((current) => event.target.checked ? [...current, permission.key] : current.filter((key) => key !== permission.key))} />{permission.label}</label>)}</fieldset>)}</div><div className="flex gap-2"><button type="button" disabled={saving || !roleName.trim()} onClick={() => void saveRole()} className="rounded-xl bg-(--solid) px-4 py-2 text-sm font-bold text-(--on-solid)">{saving ? "Salvando..." : "Salvar cargo"}</button>{selectedRole && !selectedRole.isDefault && <button type="button" onClick={() => void deleteRole(selectedRole.id)} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white">Excluir</button>}</div></>}</section>}
				{tab === "members" && <section className="space-y-3">{members.map((member) => <div key={member.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-(--line) p-3"><span className="mr-auto text-sm font-bold">{member.displayName}</span>{roles.filter(({ isDefault }) => !isDefault).map((role) => <label key={role.id} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={member.roles?.some(({ id }) => id === role.id) ?? false} onChange={(event) => void assignRole(member.id, role.id, event.target.checked)} />{role.name}</label>)}{!member.isOwner && <><button type="button" onClick={() => { if (window.confirm(`Remover ${member.displayName}?`)) void removeMember(member); }} className="rounded-lg px-2 py-1 text-xs font-bold text-red-600">Remover</button><button type="button" onClick={() => { if (window.confirm(`Banir ${member.displayName}?`)) void banMember(member); }} className="rounded-lg bg-red-600 px-2 py-1 text-xs font-bold text-white">Banir</button></>}</div>)}</section>}
				{tab === "channels" && <section className="space-y-3"><select value={channelId} onChange={(event) => selectChannel(event.target.value)} className="h-11 w-full rounded-xl border border-(--line) bg-(--surface) px-3"><option value="">Selecione um canal</option>{channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.type === "voice" ? "🔊" : "#"} {channel.name}</option>)}</select>{channelId && <><p className="text-sm text-(--muted-text)">Sem cargos selecionados, o canal é público.</p><div className="space-y-2">{roles.map((role) => <label key={role.id} className="flex gap-2 text-sm"><input type="checkbox" checked={channelRoles.includes(role.id)} onChange={(event) => setChannelRoles((current) => event.target.checked ? [...current, role.id] : current.filter((id) => id !== role.id))} />{role.name}</label>)}</div><button type="button" onClick={() => void setChannelAccess(channelId, channelRoles)} className="rounded-xl bg-(--solid) px-4 py-2 text-sm font-bold text-(--on-solid)">Salvar acesso</button></>}</section>}
			</div>
		</div>
	</Modal>;
}
