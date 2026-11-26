import { useCallback, useEffect, useRef, useState } from "react";
import { api, type User } from "@/shared/api/api";
import { useRealtime } from "@/features/realtime/hooks/use-realtime-session";
import { useSocialEvents } from "@/features/social/hooks/use-social-events";

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
	const endedCallIds = useRef(new Set<string>());
	const currentToken = useRef(token);
	currentToken.current = token;

	const rememberEnded = useCallback((callId: string) => {
		endedCallIds.current.add(callId);
		if (endedCallIds.current.size > 100) {
			const oldest = endedCallIds.current.values().next().value;
			if (oldest) endedCallIds.current.delete(oldest);
		}
	}, []);

	useEffect(() => {
		setCall(null);
		setError(null);
		setBusy(false);
		acceptedCallId.current = null;
		endedCallIds.current.clear();
	}, [token]);
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
			rememberEnded(incoming.id);
			setCall((current) =>
				current?.id === incoming.id ? null : current,
			);
			return;
		}
		if (
			event.type === "direct_call_ringing" ||
			event.type === "direct_call_accepted"
		) {
			if (endedCallIds.current.has(incoming.id)) return;
			setError(null);
			setCall((current) =>
				current?.id === incoming.id && current.status === "accepted"
					? current
					: incoming,
			);
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
			if (
				currentToken.current !== token ||
				endedCallIds.current.has(result.call.id)
			) return;
			setCall((current) =>
				current?.id === result.call.id && current.status === "accepted"
					? current
					: result.call,
			);
		} catch (cause) {
			if (currentToken.current !== token) return;
			setError(
				cause instanceof Error
					? cause.message
					: "Não foi possível iniciar a chamada.",
			);
		} finally {
			if (currentToken.current === token) setBusy(false);
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
			if (
				currentToken.current !== token ||
				endedCallIds.current.has(result.call.id)
			) return;
			setCall((current) =>
				current?.id === result.call.id && current.status === "accepted"
					? current
					: result.call,
			);
		} catch (cause) {
			if (currentToken.current !== token) return;
			setError(
				cause instanceof Error
					? cause.message
					: "Não foi possível aceitar a chamada.",
			);
		} finally {
			if (currentToken.current === token) setBusy(false);
		}
	};
	const end = useCallback(async () => {
		if (!call) return;
		rememberEnded(call.id);
		try {
			await api(`/direct-calls/${call.id}`, { method: "DELETE" }, token);
		} catch (cause) {
			if (currentToken.current !== token) return;
			setError(
				cause instanceof Error
					? cause.message
					: "Não foi possível encerrar a chamada.",
			);
		} finally {
			if (currentToken.current === token)
				setCall((current) =>
					current?.id === call.id ? null : current,
				);
		}
	}, [call, token, rememberEnded]);

	return { call, error, busy, start, accept, end, realtime };
}
