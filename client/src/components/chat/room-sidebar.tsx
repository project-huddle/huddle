import { Mic, MicOff, MonitorUp, PhoneCall, PhoneOff, UserPlus, Users, Video, VideoOff } from "lucide-react";

import { UserAvatar } from "@/components/user-avatar";
import { useRealtime } from "@/hooks/use-realtime";
import type { HuddleMember } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { useChatStore } from "@/stores/chat-store";
import { useShallow } from "zustand/react/shallow";

export function RoomSidebar({ realtime }: { realtime: ReturnType<typeof useRealtime> }) {
	const user = useAuthStore((state) => state.user)!;
	const { members, servers, serverId, createInvite, changeMemberRole, removeMember, setCallRoomOpen } = useChatStore(useShallow((state) => ({ members: state.members, servers: state.servers, serverId: state.serverId, createInvite: state.createInvite, changeMemberRole: state.changeMemberRole, removeMember: state.removeMember, setCallRoomOpen: state.setCallRoomOpen })));
	const activeServer = servers.find(({ id }) => id === serverId);
	const onCreateInvite = () => void createInvite();
	const onChangeMemberRole = (member: HuddleMember) => void changeMemberRole(member);
	const onRemoveMember = (member: HuddleMember) => { if (window.confirm(`Remover ${member.displayName} do servidor?`)) void removeMember(member); };
	const onOpenCall = () => setCallRoomOpen(true);
	return (
<aside className="hidden min-h-0 flex-col bg-[var(--panel)] lg:flex">
					<div className="border-b border-[var(--ink)]/10 p-6">
						<p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted-text)]">
							Nossa sala
						</p>
						<div className="mt-4 flex items-center gap-3">
							<UserAvatar user={user} />
							<div className="min-w-0">
								<p className="truncate font-bold">
									{user.displayName}
								</p>
								<p className="text-xs text-[var(--muted-text)]">
									você está por aqui
								</p>
							</div>
						</div>
					</div>
					<div className="flex-1 overflow-y-auto p-6">
						<div className="mb-5">
							<div className="mb-3 flex items-center justify-between">
								<p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted-text)]">
									Membros · {members.length}
								</p>
								<button
									onClick={onCreateInvite}
									className="text-[var(--muted-text)] hover:text-[var(--ink)]"
									aria-label="Criar convite"
								>
									<UserPlus className="size-4" />
								</button>
							</div>
							<div className="space-y-2">
								{members.map((member) => (
									<div
										key={member.id}
										className="group flex items-center gap-2"
									>
										<UserAvatar
											user={member}
											className="size-8 rounded-[10px]"
										/>
										<div className="min-w-0 flex-1">
											<p className="truncate text-sm font-semibold">
												{member.displayName}
											</p>
											<p className="text-[10px] text-[var(--muted-text)]">
												{member.role === "owner"
													? "proprietário"
													: member.role ===
														  "moderator"
														? "moderador"
														: "membro"}
											</p>
										</div>
										{activeServer?.ownerId === user.id &&
											!member.isOwner && (
												<div className="hidden gap-1 group-hover:flex">
													<button
														onClick={() =>
																	onChangeMemberRole(
																member,
															)
														}
														className="rounded px-1.5 py-1 text-[10px] font-bold hover:bg-[var(--surface)]"
														title="Alternar moderador"
													>
														{member.role ===
														"moderator"
															? "membro"
															: "mod"}
													</button>
													<button
														onClick={() =>
																	onRemoveMember(
																member,
															)
														}
														className="rounded px-1.5 py-1 text-[10px] font-bold text-[#b54e42] hover:bg-[#fff0ea]"
														title="Remover membro"
													>
														×
													</button>
												</div>
											)}
									</div>
								))}
							</div>
						</div>
						<div className="rounded-[26px] bg-[var(--solid)] p-5 text-[var(--on-solid)]">
							<div className="flex items-center">
								<div className="grid size-10 place-items-center rounded-2xl bg-[var(--surface)]/10">
									<PhoneCall className="size-5" />
								</div>
								<span className="ml-auto size-2 rounded-full bg-[var(--brand)]" />
							</div>
							<h2 className="mt-8 text-2xl font-black tracking-[-0.04em]">
								Chamada da sala
							</h2>
							<p className="mt-1 text-sm leading-relaxed text-[var(--on-solid)]/55">
								Entre quando quiser. Quem estiver por perto
								aparece aqui.
							</p>
							{!realtime.inCall ? (
								<button
									disabled={
										!realtime.connected || realtime.joining
									}
									onClick={realtime.joinCall}
									className="mt-5 w-full rounded-2xl bg-[var(--brand)] px-4 py-3 text-sm font-black text-[var(--ink)] disabled:opacity-50"
								>
									{realtime.joining
										? "entrando..."
										: "entrar na chamada"}
								</button>
							) : (
								<>
									<div className="mt-5 flex items-center gap-2 text-sm">
										<Users className="size-4" />{" "}
										{realtime.peers.length + 1} na chamada
									</div>
									<button
										onClick={() => onOpenCall()}
										className="mt-3 w-full rounded-2xl bg-[var(--brand)] px-4 py-3 text-sm font-black text-[var(--ink)]"
									>
										Abrir sala da chamada
									</button>
									<div className="mt-3 grid grid-cols-4 gap-2">
										<button
											onClick={realtime.toggleMute}
											className={cn(
												"grid aspect-square place-items-center rounded-2xl",
												realtime.muted
													? "bg-[#d76b5b]"
													: "bg-[var(--surface)]/10",
											)}
											aria-label="Alternar microfone"
										>
											{realtime.muted ? (
												<MicOff />
											) : (
												<Mic />
											)}
										</button>
										<button
											onClick={realtime.toggleCamera}
											className={cn(
												"grid aspect-square place-items-center rounded-2xl",
												realtime.cameraOff
													? "bg-[#d76b5b]"
													: "bg-[var(--surface)]/10",
											)}
											aria-label="Alternar câmera"
										>
											{realtime.cameraOff ? (
												<VideoOff />
											) : (
												<Video />
											)}
										</button>
										<button
											onClick={realtime.toggleShare}
											className={cn(
												"grid aspect-square place-items-center rounded-2xl",
												realtime.sharing
													? "bg-[#8fb996]"
													: "bg-[var(--surface)]/10",
											)}
											aria-label="Compartilhar tela"
										>
											<MonitorUp />
										</button>
										<button
											onClick={realtime.leaveCall}
											className="grid aspect-square place-items-center rounded-2xl bg-[#d76b5b]"
											aria-label="Sair da chamada"
										>
											<PhoneOff />
										</button>
									</div>
								</>
							)}
						</div>
						{realtime.inCall && (
							<div className="mt-5 space-y-2">
								{realtime.peers.map(
									({ user: peer, sharing }) => (
										<button
											type="button"
											onClick={() =>
												onOpenCall()
											}
											key={peer.id}
											className="flex w-full items-center gap-2 rounded-xl p-2 text-left hover:bg-[var(--surface)]"
										>
											<UserAvatar
												user={peer}
												className="size-7 rounded-lg"
											/>
											<span className="min-w-0 flex-1 truncate text-sm font-semibold">
												{peer.displayName}
											</span>
											{sharing && (
												<MonitorUp className="size-4 text-[var(--brand)]" />
											)}
										</button>
									),
								)}
							</div>
						)}
					</div>
					<div className="p-6 text-xs leading-relaxed text-[var(--muted-text)]">
						Feito para poucas pessoas.
						<br />
						Sem algoritmos, sem plateia.
					</div>
				</aside>
	);
}
