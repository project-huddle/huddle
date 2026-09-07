import { useAuthStore } from "@/stores/auth-store";

export function requireCredentials() {
	const { token, user } = useAuthStore.getState();
	if (!token || !user) throw new Error("Sessão inválida.");
	return { token, user };
}

export function errorMessage(cause: unknown, fallback: string) {
	return cause instanceof Error ? cause.message : fallback;
}
