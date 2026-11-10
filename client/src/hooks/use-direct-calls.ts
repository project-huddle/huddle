import { useCallback, useEffect, useRef, useState } from "react";
import { api, type User } from "@/lib/api";
import { useRealtime } from "@/hooks/use-realtime";
import { useSocialEvents } from "@/hooks/use-social-events";

type DirectCall = {
	id: string;
	caller: User;
	recipient: User;
	status: "ringing" | "accepted";
};

export function useDirectCalls(token: string, onAccepted: () => void) {
	const [call, setCall] = useState<DirectCall | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const acceptedHandler = useRef(onAccepted);
	acceptedHandler.current = onAccepted;
	const acceptedCallId = useRef<string | null>(null);
	const realtime = useRealtime(
		token,
		call?.status === "accepted" ? call.id : "",
		"voice",
		"direct",
	);

	useEffect(() => {
		if (call?.status !== "accepted" || acceptedCallId.current === call.id)
			return;
		acceptedCallId.current = call.id;
		acceptedHandler.current();
	}, [call]);

	useSocialEvents(token, (event) => {
		if (!event.type.startsWith("direct_call_")) return;
		const incoming = event.call as DirectCall;
		if (!incoming?.id) return;
		if (event.type === "direct_call_ended") {
			setCall((current) =>
				current?.id === incoming.id ? null : current,
			);
			return;
		}
		if (
			event.type === "direct_call_ringing" ||
			event.type === "direct_call_accepted"
		) {
			setError(null);
			setCall(incoming);
		}
	});

	const start = async (recipient: User) => {
		if (call || busy) return;
		setBusy(true);
		setError(null);
		try {
			const result = await api<{ call: DirectCall }>(
				"/direct-calls",
				{
					method: "POST",
					body: JSON.stringify({ recipientId: recipient.id }),
				},
				token,
			);
			setCall(result.call);
		} catch (cause) {
			setError(
				cause instanceof Error
					? cause.message
					: "Não foi possível iniciar a chamada.",
			);
		} finally {
			setBusy(false);
		}
	};
	const accept = async () => {
		if (!call || busy) return;
		setBusy(true);
		setError(null);
		try {
			const result = await api<{ call: DirectCall }>(
				`/direct-calls/${call.id}/accept`,
				{ method: "POST" },
				token,
			);
			setCall(result.call);
		} catch (cause) {
			setError(
				cause instanceof Error
					? cause.message
					: "Não foi possível aceitar a chamada.",
			);
		} finally {
			setBusy(false);
		}
	};
	const end = useCallback(async () => {
		if (!call) return;
		try {
			await api(`/direct-calls/${call.id}`, { method: "DELETE" }, token);
		} catch (cause) {
			setError(
				cause instanceof Error
					? cause.message
					: "Não foi possível encerrar a chamada.",
			);
		} finally {
			setCall(null);
		}
	}, [call, token]);

	return { call, error, busy, start, accept, end, realtime };
}
