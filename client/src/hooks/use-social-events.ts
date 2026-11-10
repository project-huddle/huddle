import { useEffect, useRef } from "react";
import { api, websocketUrl } from "@/lib/api";

export type SocialEvent = {
	type: string;
	[key: string]: unknown;
};

export function useSocialEvents(
	token: string,
	onEvent: (event: SocialEvent) => void,
) {
	const handler = useRef(onEvent);
	handler.current = onEvent;

	useEffect(() => {
		let disposed = false;
		let socket: WebSocket | null = null;
		let retry: ReturnType<typeof setTimeout> | undefined;

		const scheduleReconnect = () => {
			if (!disposed) retry = setTimeout(() => void connect(), 3000);
		};
		const connect = async () => {
			try {
				const { ticket } = await api<{ ticket: string }>(
					"/auth/ws-ticket",
					{ method: "POST" },
					token,
				);
				if (disposed) return;
				socket = new WebSocket(websocketUrl(ticket));
				socket.onmessage = ({ data }) => {
					if (disposed) return;
					try {
						handler.current(
							JSON.parse(String(data)) as SocialEvent,
						);
					} catch (cause) {
						console.error("Unable to process social event", cause);
					}
				};
				socket.onclose = scheduleReconnect;
			} catch {
				scheduleReconnect();
			}
		};
		void connect();
		return () => {
			disposed = true;
			clearTimeout(retry);
			socket?.close();
		};
	}, [token]);
}
