import { useEffect } from "react";
import { useAuthStore } from "@/features/auth/state/auth-store";
import ChatPage from "@/features/workspace/pages/chat-page";
import LoginPage from "@/features/auth/pages/login-page";
import InvitePage from "@/features/servers/pages/invite-page";

export default function App() {
	const user = useAuthStore((state) => state.user);
	const token = useAuthStore((state) => state.token);
	const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
	const isSessionValidated = useAuthStore(
		(state) => state.isSessionValidated,
	);
	const validateSession = useAuthStore((state) => state.validateSession);

	useEffect(() => {
		void validateSession();
	}, [validateSession]);

	if (!isSessionValidated) return null;
	if (window.location.pathname.startsWith("/invite/")) return <InvitePage />;

	if (!isAuthenticated || !user || !token) {
		return <LoginPage />;
	}

	return <ChatPage />;
}
