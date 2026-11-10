import { useEffect, useMemo, useState } from "react";
import { api, type HuddlePermission, type HuddleServerRole } from "@/lib/api";
import { requireCredentials } from "@/lib/chat-store";
import { useChatStore } from "@/stores/chat-store";
import { useAuthStore } from "@/stores/auth-store";
import { useShallow } from "zustand/react/shallow";

export type ServerSettingsTab = "overview" | "roles" | "members" | "channels";

export function useServerSettings(open: boolean, onClose: () => void) {
	const user = useAuthStore((state) => state.user);
	const {
		server,
		channels,
		members,
		roles,
		permissions,
		loadRoles,
		updateServer,
		deleteServer,
		transferOwnership,
		createRole,
		updateRole,
		deleteRole,
		assignRole,
		removeMember,
		banMember,
		setChannelAccess,
	} = useChatStore(
		useShallow((state) => ({
			server: state.servers.find(({ id }) => id === state.serverId),
			channels: state.channels,
			members: state.members,
			roles: state.roles,
			permissions: state.permissions,
			loadRoles: state.loadRoles,
			updateServer: state.updateServer,
			deleteServer: state.deleteServer,
			transferOwnership: state.transferOwnership,
			createRole: state.createRole,
			updateRole: state.updateRole,
			deleteRole: state.deleteRole,
			assignRole: state.assignRole,
			removeMember: state.removeMember,
			banMember: state.banMember,
			setChannelAccess: state.setChannelAccess,
		})),
	);
	const [tab, setTab] = useState<ServerSettingsTab>("overview");
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
	const [channelAccessStatus, setChannelAccessStatus] = useState<{
		type: "success" | "error";
		message: string;
	} | null>(null);
	const [serverStatus, setServerStatus] = useState<{
		type: "success" | "error";
		message: string;
	} | null>(null);

	useEffect(() => {
		if (open) void loadRoles();
	}, [open, loadRoles]);
	useEffect(() => {
		setName(server?.name ?? "");
		setIconUrl(server?.iconUrl ?? null);
	}, [server?.id, server?.name, server?.iconUrl]);
	useEffect(() => {
		setNewOwnerId("");
	}, [server?.id]);
	const selectedRole = roles.find(({ id }) => id === roleId);
	const groupedPermissions = useMemo(
		() =>
			permissions.reduce<Record<string, HuddlePermission[]>>(
				(groups, permission) => {
					(groups[permission.category] ??= []).push(permission);
					return groups;
				},
				{},
			),
		[permissions],
	);
	const allPermissionKeys = useMemo(
		() => permissions.map(({ key }) => key),
		[permissions],
	);
	const allPermissionsSelected =
		allPermissionKeys.length > 0 &&
		allPermissionKeys.every((key) => rolePermissions.includes(key));

	const selectRole = (role: HuddleServerRole | null) => {
		setRoleId(role?.id ?? null);
		setRoleName(role?.name ?? "");
		setRoleColor(role?.color ?? "#64748b");
		setRolePermissions(role?.permissions ?? []);
	};
	const selectChannel = (id: string) => {
		setChannelId(id);
		setChannelRoles(
			channels.find(({ id: channelId }) => channelId === id)?.roleIds ??
				[],
		);
		setChannelAccessStatus(null);
	};
	const saveChannelAccess = async () => {
		if (!channelId || saving) return;
		setSaving(true);
		setChannelAccessStatus(null);
		try {
			const saved = await setChannelAccess(channelId, channelRoles);
			setChannelAccessStatus(
				saved
					? {
							type: "success",
							message: "Acesso do canal salvo com sucesso.",
						}
					: {
							type: "error",
							message:
								"Não foi possível salvar o acesso. Tente novamente.",
						},
			);
		} catch {
			setChannelAccessStatus({
				type: "error",
				message: "Não foi possível salvar o acesso. Tente novamente.",
			});
		} finally {
			setSaving(false);
		}
	};
	const saveServer = async () => {
		if (saving) return;
		const normalizedName = name.trim();
		if (normalizedName.length < 2 || normalizedName.length > 40) {
			setServerStatus({
				type: "error",
				message: "O nome deve ter entre 2 e 40 caracteres.",
			});
			return;
		}
		setSaving(true);
		setServerStatus(null);
		try {
			const saved = await updateServer({ name: normalizedName, iconUrl });
			setServerStatus(
				saved
					? {
							type: "success",
							message:
								"Configurações do servidor salvas com sucesso.",
						}
					: {
							type: "error",
							message:
								useChatStore.getState().error ??
								"Não foi possível salvar o servidor. Tente novamente.",
						},
			);
		} catch {
			setServerStatus({
				type: "error",
				message:
					useChatStore.getState().error ??
					"Não foi possível salvar o servidor. Tente novamente.",
			});
		} finally {
			setSaving(false);
		}
	};
	const saveRole = async () => {
		if (!roleName.trim()) return;
		setSaving(true);
		if (roleId)
			await updateRole(roleId, {
				name: roleName.trim(),
				color: roleColor,
				permissions: rolePermissions,
			});
		else
			await createRole({
				name: roleName.trim(),
				color: roleColor,
				permissions: rolePermissions,
			});
		setSaving(false);
		selectRole(null);
	};
	const uploadIcon = async (file?: File) => {
		if (!file) return;
		const { token } = requireCredentials();
		const form = new FormData();
		form.append("file", file);
		const result = await api<{ media: { url: string } }>(
			"/uploads",
			{ method: "POST", body: form },
			token,
		);
		setIconUrl(result.media.url);
	};

	const isOwner = server?.ownerId === user?.id;
	const transferOwnershipToMember = async () => {
		if (!newOwnerId) return;
		if (
			!window.confirm(
				"Transferir a propriedade deste servidor? Essa ação não pode ser desfeita automaticamente.",
			)
		)
			return;
		if (await transferOwnership(newOwnerId)) onClose();
	};
	const deleteCurrentServer = async () => {
		if (
			!window.confirm(
				`Excluir ${server?.name ?? "este servidor"}? Todos os canais, mensagens e membros serão removidos.`,
			)
		)
			return;
		await deleteServer();
	};

	return {
		server,
		channels,
		members,
		roles,
		tab,
		setTab,
		name,
		setName,
		iconUrl,
		roleId,
		roleName,
		setRoleName,
		roleColor,
		setRoleColor,
		rolePermissions,
		setRolePermissions,
		channelId,
		channelRoles,
		setChannelRoles,
		newOwnerId,
		setNewOwnerId,
		saving,
		channelAccessStatus,
		serverStatus,
		setServerStatus,
		setChannelAccessStatus,
		selectedRole,
		groupedPermissions,
		allPermissionKeys,
		allPermissionsSelected,
		selectRole,
		selectChannel,
		saveChannelAccess,
		saveServer,
		saveRole,
		uploadIcon,
		isOwner,
		transferOwnershipToMember,
		deleteCurrentServer,
		deleteRole,
		assignRole,
		removeMember,
		banMember,
	};
}
