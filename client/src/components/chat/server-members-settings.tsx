import type { useServerSettings } from "@/hooks/use-server-settings";

export function ServerMembersSettings({
	settings,
}: {
	settings: ReturnType<typeof useServerSettings>;
}) {
	const {
		server,
		members,
		roles,
		assignRole,
		removeMember,
		banMember,
	} = settings;
	return (
		<section className="space-y-3">
			{members.map((member) => (
				<div
					key={member.id}
					className="flex flex-wrap items-center gap-2 rounded-xl border border-(--line) p-3"
				>
					<span className="mr-auto text-sm font-bold">
						{member.displayName}
						{member.id === server?.ownerId && (
							<span className="ml-2 text-xs text-(--brand)">
								Owner
							</span>
						)}
					</span>
					{roles
						.filter(({ isDefault }) => !isDefault)
						.map((role) => (
							<label
								key={role.id}
								className="flex items-center gap-1 text-xs"
							>
								<input
									type="checkbox"
									checked={
										member.roles?.some(
											({ id }) => id === role.id,
										) ?? false
									}
									onChange={(event) =>
										void assignRole(
											member.id,
											role.id,
											event.target.checked,
										)
									}
								/>
								{role.name}
							</label>
						))}
					{member.id !== server?.ownerId && (
						<>
							<button
								type="button"
								onClick={() => {
									if (
										window.confirm(
											`Remover ${member.displayName}?`,
										)
									)
										void removeMember(member);
								}}
								className="rounded-lg px-2 py-1 text-xs font-bold text-red-600"
							>
								Remover
							</button>
							<button
								type="button"
								onClick={() => {
									if (
										window.confirm(
											`Banir ${member.displayName}?`,
										)
									)
										void banMember(member);
								}}
								className="rounded-lg bg-red-600 px-2 py-1 text-xs font-bold text-white"
							>
								Banir
							</button>
						</>
					)}
				</div>
			))}
		</section>
	);
}
