const turnUrl = import.meta.env.VITE_TURN_URL as string | undefined;
const turnUsername = import.meta.env.VITE_TURN_USERNAME as string | undefined;
const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL as string | undefined;

export const rtcConfig: RTCConfiguration = {
	iceServers: [
		{ urls: "stun:stun.l.google.com:19302" },
		...(turnUrl ? [{ urls: turnUrl, username: turnUsername, credential: turnCredential }] : []),
	],
};

export function mediaErrorMessage(cause: unknown, action: "camera" | "microphone" | "screen") {
	if (!window.isSecureContext || !navigator.mediaDevices) {
		return "Microfone e compartilhamento de tela exigem HTTPS (ou localhost).";
	}
	const name = cause instanceof DOMException ? cause.name : "";
	if (name === "NotAllowedError") {
		if (action === "microphone") return "O acesso ao microfone foi negado. Libere a permissão do site no navegador.";
		if (action === "camera") return "O acesso à câmera foi negado. Libere a permissão do site no navegador.";
		return "O compartilhamento de tela foi cancelado ou bloqueado pelo navegador.";
	}
	if (name === "NotFoundError") {
		if (action === "microphone") return "Nenhum microfone foi encontrado.";
		if (action === "camera") return "Nenhuma câmera foi encontrada.";
		return "Nenhuma fonte de tela está disponível para compartilhar.";
	}
	if (name === "NotReadableError") {
		if (action === "microphone") return "O microfone está sendo usado por outro aplicativo.";
		if (action === "camera") return "A câmera está sendo usada por outro aplicativo.";
		return "O navegador não conseguiu capturar a tela selecionada.";
	}
	if (action === "microphone") return "Não foi possível acessar o microfone.";
	if (action === "camera") return "Não foi possível acessar a câmera.";
	return "Não foi possível compartilhar a tela.";
}
