import { useAuthStore } from "@/stores/auth-store"
import ChatPage from "@/views/chat-page"
import LoginPage from "@/views/login-page"

export default function App() {
  const { user, token, isAuthenticated, logout } = useAuthStore()

  if (!isAuthenticated || !user || !token) {
    return <LoginPage />
  }

  return <ChatPage user={user} token={token} onLogout={logout} />
}
