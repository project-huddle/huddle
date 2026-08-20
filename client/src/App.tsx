import { useAuthStore } from "@/stores/auth-store";
import ChatPage from "@/views/chat-page";
import LoginPage from "@/views/login-page";

export default function App() {
	const user = useAuthStore((state) => state.user);
	const token = useAuthStore((state) => state.token);
	const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

	if (!isAuthenticated || !user || !token) {
		return <LoginPage />;
	}

	return <ChatPage />;
}
