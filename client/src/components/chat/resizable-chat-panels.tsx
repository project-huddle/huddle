import { useRef, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";

import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ChannelSidebar } from "./chanel-sidebar";

const DESKTOP_QUERY = "(min-width: 1024px)";

function subscribeToViewport(onChange: () => void) {
	const query = window.matchMedia(DESKTOP_QUERY);
	query.addEventListener("change", onChange);
	return () => query.removeEventListener("change", onChange);
}

function isDesktopViewport() {
	return window.matchMedia(DESKTOP_QUERY).matches;
}

export function ResizableChatPanels({ children }: { children: ReactNode }) {
	const isDesktop = useSyncExternalStore(subscribeToViewport, isDesktopViewport);
	const sidebarRef = useRef<PanelImperativeHandle>(null);

	return (
		<ResizablePanelGroup orientation="horizontal" disabled={!isDesktop} className="min-h-0 min-w-0">
			<ResizablePanel
				id="channel-sidebar"
				panelRef={sidebarRef}
				defaultSize="240px"
				minSize={isDesktop ? "220px" : "0px"}
				maxSize={isDesktop ? "400px" : "0px"}
				className="[&>aside]:h-full"
			>
				<ChannelSidebar />
			</ResizablePanel>
			<ResizableHandle
				className="hidden bg-(--ink)/10 transition-colors hover:bg-(--brand) focus-visible:bg-(--brand) lg:flex"
				aria-label="Redimensionar lista de canais"
				onDoubleClick={() => sidebarRef.current?.resize("240px")}
			/>
			<ResizablePanel id="conversation" minSize={isDesktop ? "360px" : "0px"} className="flex min-h-0 flex-col [&>section]:flex-1">
				{children}
			</ResizablePanel>
		</ResizablePanelGroup>
	);
}
