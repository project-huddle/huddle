import { MicOff, Volume2, X } from "lucide-react";
import { useState } from "react";

import { StreamVideo } from "@/components/call/call-media";
import { UserAvatar } from "@/components/user-avatar";
import type { User } from "@/lib/api";

export function Participant({ user, stream, cameraOff = false, muted = false, speaking = false, self = false, volume = 100, onVolumeChange, onMute }: { user: User; stream: MediaStream | null; cameraOff?: boolean; muted?: boolean; speaking?: boolean; self?: boolean; volume?: number; onVolumeChange?: (value: number) => void; onMute?: () => void }) {
	const [volumeOpen, setVolumeOpen] = useState(false);
	return <div onContextMenu={(event) => { if (!self) { event.preventDefault(); setVolumeOpen(true); } }} className={`relative flex min-h-28 items-end overflow-hidden rounded-2xl bg-(--solid) p-3 text-(--on-solid) ${speaking ? "ring-2 ring-(--brand) ring-offset-2 ring-offset-(--canvas)" : ""}`}>
		{stream && !cameraOff
			? <StreamVideo stream={stream} muted={self} className="absolute inset-0 size-full object-cover" />
			: <UserAvatar user={user} className="absolute left-1/2 top-1/2 size-12 -translate-x-1/2 -translate-y-1/2" />}
		<span className="relative rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold">{user.displayName}</span>
		{muted && <MicOff className="relative ml-auto size-4" />}
		{!self && onMute && <button type="button" onClick={onMute} className="relative ml-2 rounded-full bg-black/50 p-1" title={muted ? "Remover mute" : "Silenciar participante"}><Volume2 className="size-3" /></button>}
		{volumeOpen && !self && <div role="dialog" aria-label={`Volume de ${user.displayName}`} className="absolute bottom-12 left-2 z-10 w-52 rounded-xl border border-white/15 bg-[#18202a] p-3 shadow-xl"><div className="mb-2 flex items-center gap-2 text-xs font-bold"><Volume2 className="size-3" /> Volume <span className="ml-auto">{volume}%</span><button type="button" onClick={() => setVolumeOpen(false)} aria-label="Fechar volume"><X className="size-3" /></button></div><input aria-label={`Volume de ${user.displayName}`} type="range" min="0" max="200" value={volume} onChange={(event) => onVolumeChange?.(Number(event.target.value))} className="w-full accent-(--brand)" /><div className="mt-1 flex justify-between text-[10px] text-white/50"><span>0%</span><span>100% normal</span><span>200%</span></div></div>}
	</div>;
}
