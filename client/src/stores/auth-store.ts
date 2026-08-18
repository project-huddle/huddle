import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { api, type User } from "@/lib/api"

type AuthState = {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: (email: string, password: string, remember: boolean) => Promise<void>
  register: (email: string, displayName: string, password: string) => Promise<void>
  logout: () => void
  clearError: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      login: async (email, password, remember) => {
        set({ isLoading: true, error: null })

        try {
          const result = await api<{ user: User; session: { token: string } }>("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
          })

          set({
            user: result.user,
            token: result.session.token,
            isAuthenticated: true,
            isLoading: false,
          })
          if (!remember) useAuthStore.persist.clearStorage()
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : "Ocorreu um erro inesperado.",
            isLoading: false,
          })
          throw error
        }
      },
      register: async (email, displayName, password) => {
        set({ isLoading: true, error: null })
        try {
          const result = await api<{ user: User; session: { token: string } }>("/auth/register", {
            method: "POST",
            body: JSON.stringify({ email, displayName, password }),
          })
          set({ user: result.user, token: result.session.token, isAuthenticated: true, isLoading: false })
        } catch (error) {
          set({ error: error instanceof Error ? error.message : "Ocorreu um erro inesperado.", isLoading: false })
          throw error
        }
      },
      logout: () => {
        const token = useAuthStore.getState().token
        if (token) void api("/auth/logout", { method: "POST" }, token).catch(() => undefined)
        set({ user: null, token: null, isAuthenticated: false, error: null })
      },
      clearError: () => set({ error: null }),
    }),
    {
      name: "auth-session",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ user, token, isAuthenticated }) => ({ user, token, isAuthenticated }),
      migrate: (persisted) => {
        const state = persisted as Partial<AuthState>
        if (!state.user || !state.token) {
          return { user: null, token: null, isAuthenticated: false }
        }
        return state
      },
    }
  )
)
