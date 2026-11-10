import type { useServerSettings } from "@/hooks/use-server-settings";

export function ServerRolesSettings({
	settings,
}: {
	settings: ReturnType<typeof useServerSettings>;
}) {
	const {
		roles,
		roleId,
		roleName,
		setRoleName,
		roleColor,
		setRoleColor,
		rolePermissions,
		setRolePermissions,
		saving,
		selectedRole,
		groupedPermissions,
		allPermissionKeys,
		allPermissionsSelected,
		selectRole,
		saveRole,
		deleteRole,
	} = settings;
	return (
		<section className="space-y-4">
			<div className="flex gap-2 overflow-x-auto">
				{roles.map((role) => (
					<button
						key={role.id}
						type="button"
						onClick={() => selectRole(role)}
						className={`shrink-0 rounded-xl border px-3 py-2 text-sm font-bold ${roleId === role.id ? "border-(--brand)" : "border-(--line)"}`}
					>
						<span
							className="mr-2 inline-block size-2 rounded-full"
							style={{
								backgroundColor: role.color,
							}}
						/>
						{role.name}
					</button>
				))}
				<button
					type="button"
					onClick={() => selectRole(null)}
					className="rounded-xl bg-(--surface) px-3 py-2 text-sm font-bold"
				>
					+ Novo cargo
				</button>
			</div>
			{(roleId !== null || !selectedRole) && (
				<>
					<label className="block text-sm font-bold">
						Nome
						<input
							value={roleName}
							onChange={(event) =>
								setRoleName(event.target.value)
							}
							className="mt-2 h-10 w-full rounded-xl border border-(--line) bg-(--surface) px-3 font-normal"
						/>
					</label>
					<label className="block text-sm font-bold">
						Cor
						<input
							type="color"
							value={roleColor}
							onChange={(event) =>
								setRoleColor(event.target.value)
							}
							className="ml-3 h-8 w-12"
						/>
					</label>
					<div className="flex items-center justify-between">
						<span className="text-sm font-bold">Permissões</span>
						<button
							type="button"
							onClick={() =>
								setRolePermissions(
									allPermissionsSelected
										? []
										: allPermissionKeys,
								)
							}
							className="rounded-lg bg-(--surface) px-3 py-1.5 text-xs font-bold hover:bg-(--brand)/20"
						>
							{allPermissionsSelected
								? "Desmarcar todos"
								: "Selecionar todos"}
						</button>
					</div>
					<div className="max-h-56 space-y-3 overflow-y-auto rounded-xl border border-(--line) p-3">
						{Object.entries(groupedPermissions).map(
							([category, items]) => (
								<fieldset key={category}>
									<legend className="text-xs font-black uppercase tracking-wider text-(--muted-text)">
										{category}
									</legend>
									{items.map((permission) => (
										<label
											key={permission.key}
											className="mt-2 flex gap-2 text-sm"
										>
											<input
												type="checkbox"
												checked={rolePermissions.includes(
													permission.key,
												)}
												onChange={(event) =>
													setRolePermissions(
														(current) =>
															event.target.checked
																? [
																		...current,
																		permission.key,
																	]
																: current.filter(
																		(key) =>
																			key !==
																			permission.key,
																	),
													)
												}
											/>
											{permission.label}
										</label>
									))}
								</fieldset>
							),
						)}
					</div>
					<div className="flex gap-2">
						<button
							type="button"
							disabled={saving || !roleName.trim()}
							onClick={() => void saveRole()}
							className="rounded-xl bg-(--solid) px-4 py-2 text-sm font-bold text-(--on-solid)"
						>
							{saving ? "Salvando..." : "Salvar cargo"}
						</button>
						{selectedRole && !selectedRole.isDefault && (
							<button
								type="button"
								onClick={() => void deleteRole(selectedRole.id)}
								className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white"
							>
								Excluir
							</button>
						)}
					</div>
				</>
			)}
		</section>
	);
}
