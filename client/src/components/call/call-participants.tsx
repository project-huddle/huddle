import { MicOff } from "lucide-react";

import { StreamVideo } from "@/components/call/call-media";
import { UserAvatar } from "@/components/user-avatar";
import type { User } from "@/lib/api";

export function Participant({ user, stream, cameraOff = false, muted = false, self = false }: { user: User; stream: MediaStream | null; cameraOff?: boolean; muted?: boolean; self?: boolean }) {
	return <div className="relative flex min-h-28 items-end overflow-hidden rounded-2xl bg-(--solid) p-3 text-(--on-solid)">
		{stream && !cameraOff
			? <StreamVideo stream={stream} muted={self} className="absolute inset-0 size-full object-cover" />
			: <UserAvatar user={user} className="absolute left-1/2 top-1/2 size-12 -translate-x-1/2 -translate-y-1/2" />}
		<span className="relative rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold">{user.displayName}</span>
		{muted && <MicOff className="relative ml-auto size-4" />}
	</div>;
}
