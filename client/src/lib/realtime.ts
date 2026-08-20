const turnUrl = import.meta.env.VITE_TURN_URL as string | undefined;
const turnUsername = import.meta.env.VITE_TURN_USERNAME as string | undefined;
const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL as string | undefined;

export const rtcConfig: RTCConfiguration = {
	iceServers: [
		{ urls: "stun:stun.l.google.com:19302" },
		...(turnUrl ? [{ urls: turnUrl, username: turnUsername, credential: turnCredential }] : []),
	],
};

export function mediaErrorMessage(cause: unknown, action: "microphone" | "screen") {
	if (!window.isSecureContext || !navigator.mediaDevices) {
		return "Microfone e compartilhamento de tela exigem HTTPS (ou localhost).";
	}
	const name = cause instanceof DOMException ? cause.name : "";
	if (name === "NotAllowedError") {
		return action === "microphone"
			? "O acesso ao microfone foi negado. Libere a permissão do site no navegador."
			: "O compartilhamento de tela foi cancelado ou bloqueado pelo navegador.";
	}
	if (name === "NotFoundError") {
		return action === "microphone" ? "Nenhum microfone foi encontrado." : "Nenhuma fonte de tela está disponível para compartilhar.";
	}
	if (name === "NotReadableError") {
		return action === "microphone" ? "O microfone está sendo usado por outro aplicativo." : "O navegador não conseguiu capturar a tela selecionada.";
	}
	return action === "microphone" ? "Não foi possível acessar o microfone." : "Não foi possível compartilhar a tela.";
}
