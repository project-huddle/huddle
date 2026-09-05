import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { api, setUnauthorizedHandler, type User } from "@/lib/api";

const signedOutState = {
	user: null,
	token: null,
	isAuthenticated: false,
	error: null,
	twoFactorChallenge: null,
};

type AuthState = {
	user: User | null;
	token: string | null;
	isAuthenticated: boolean;
	isSessionValidated: boolean;
	isLoading: boolean;
	error: string | null;
	twoFactorChallenge: string | null;
	login: (
		email: string,
		password: string,
		remember: boolean,
	) => Promise<void>;
	register: (
		email: string,
		displayName: string,
		password: string,
	) => Promise<void>;
	verifyTwoFactor: (code: string) => Promise<void>;
	logout: () => void;
	validateSession: () => Promise<void>;
	invalidateSession: () => void;
	clearError: () => void;
	updateUser: (user: User) => void;
};

export const useAuthStore = create<AuthState>()(
	persist(
		(set) => ({
			user: null,
			token: null,
			isAuthenticated: false,
			isSessionValidated: false,
			isLoading: false,
			error: null,
			twoFactorChallenge: null,
			login: async (email, password, remember) => {
				set({ isLoading: true, error: null });

				try {
					const result = await api<{
						user?: User;
						session?: { token: string };
						requiresTwoFactor?: boolean;
						challengeId?: string;
					}>("/auth/login", {
						method: "POST",
						body: JSON.stringify({ email, password }),
					});

					if (result.requiresTwoFactor && result.challengeId) {
						set({
							twoFactorChallenge: result.challengeId,
							isLoading: false,
						});
						return;
					}
					if (!result.user || !result.session)
						throw new Error("Resposta de autenticação inválida.");
					set({
						user: result.user,
						token: result.session.token,
						isAuthenticated: true,
						isSessionValidated: true,
						isLoading: false,
					});
					if (!remember) useAuthStore.persist.clearStorage();
				} catch (error) {
					set({
						error:
							error instanceof Error
								? error.message
								: "Ocorreu um erro inesperado.",
						isLoading: false,
					});
					throw error;
				}
			},
			verifyTwoFactor: async (code) => {
				const challengeId = useAuthStore.getState().twoFactorChallenge;
				if (!challengeId) return;
				set({ isLoading: true, error: null });
				try {
					const result = await api<{
						user: User;
						session: { token: string };
					}>("/auth/2fa/verify", {
						method: "POST",
						body: JSON.stringify({ challengeId, code }),
					});
					set({
						user: result.user,
						token: result.session.token,
						isAuthenticated: true,
						isSessionValidated: true,
						isLoading: false,
						twoFactorChallenge: null,
					});
				} catch (error) {
					set({
						error:
							error instanceof Error
								? error.message
								: "Código inválido.",
						isLoading: false,
					});
					throw error;
				}
			},
			register: async (email, displayName, password) => {
				set({ isLoading: true, error: null });
				try {
					const result = await api<{
						user: User;
						session: { token: string };
					}>("/auth/register", {
						method: "POST",
						body: JSON.stringify({ email, displayName, password }),
					});
					set({
						user: result.user,
						token: result.session.token,
						isAuthenticated: true,
						isSessionValidated: true,
						isLoading: false,
					});
				} catch (error) {
					set({
						error:
							error instanceof Error
								? error.message
								: "Ocorreu um erro inesperado.",
						isLoading: false,
					});
					throw error;
				}
			},
			logout: () => {
				const token = useAuthStore.getState().token;
				if (token)
					void api("/auth/logout", { method: "POST" }, token).catch(
						() => undefined,
					);
				set({ ...signedOutState, isSessionValidated: true });
			},
			validateSession: async () => {
				const token = useAuthStore.getState().token;
				if (!token) {
					set({ ...signedOutState, isSessionValidated: true });
					return;
				}

				try {
					const { user } = await api<{ user: User }>("/auth/me", {}, token);
					set({ user, isAuthenticated: true, isSessionValidated: true });
				} catch {
					set({ ...signedOutState, isSessionValidated: true });
				}
			},
			invalidateSession: () => {
				set({ ...signedOutState, isSessionValidated: true });
			},
			clearError: () => set({ error: null }),
			updateUser: (user) => set({ user }),
		}),
		{
			name: "auth-session",
			version: 1,
			storage: createJSONStorage(() => localStorage),
			partialize: ({ user, token, isAuthenticated }) => ({
				user,
				token,
				isAuthenticated,
			}),
			migrate: (persisted) => {
				const state = persisted as Partial<AuthState>;
				if (!state.user || !state.token) {
					return { user: null, token: null, isAuthenticated: false };
				}
				return state;
			},
		},
	),
);

setUnauthorizedHandler((rejectedToken) => {
	const activeToken = useAuthStore.getState().token;
	if (rejectedToken === activeToken) {
		useAuthStore.getState().invalidateSession();
	}
});
