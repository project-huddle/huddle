import { ArrowLeft, MessageCircle } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { ChatComposer } from "@/components/chat/message-composer";
import { MessageList } from "@/components/message-list";
import { UserAvatar } from "@/components/user-avatar";
import type { ChatMessage, User } from "@/lib/api";
import type { useSocialHub } from "@/hooks/use-social-hub";

type Props = {
	currentUser: User;
	social: ReturnType<typeof useSocialHub>;
	onBack: () => void;
	callAction?: ReactNode;
};

export function DirectConversation({
	currentUser,
	social,
	onBack,
	callAction,
}: Props) {
	const end = useRef<HTMLDivElement>(null);
	const {
		selected,
		messages,
		sending,
		loading,
		sendMessage,
		status,
		setStatus,
	} = social;
	useEffect(() => {
		end.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	if (!selected) {
		return (
			<section className="hidden flex-1 place-items-center p-8 text-center md:grid">
				<div>
					<MessageCircle className="mx-auto mb-4 size-12 text-(--brand)" />
					<h1 className="text-2xl font-black">Suas conversas</h1>
					<p className="mt-2 text-(--muted-text)">
						Escolha um contato ou adicione um amigo para começar.
					</p>
				</div>
			</section>
		);
	}

	const chatMessages: ChatMessage[] = messages.map((message) => ({
		...message,
		author: message.senderId === currentUser.id ? currentUser : selected,
		channelId: selected.id,
		media: message.media,
		editedAt: null,
		deletedAt: null,
		replyToId: null,
		reactions: {},
	}));

	return (
		<section className="flex min-h-0 min-w-0 flex-1 flex-col">
			<header className="flex h-19 shrink-0 items-center gap-3 border-b border-(--line) px-4 sm:px-7">
				<button
					type="button"
					onClick={onBack}
					aria-label="Voltar aos contatos"
					className="rounded-xl p-2 md:hidden"
				>
					<ArrowLeft className="size-5" />
				</button>
				<UserAvatar user={selected} className="size-10" />
				<div className="min-w-0 flex-1">
					<h1 className="truncate font-bold">
						{selected.displayName}
					</h1>
					<p className="text-xs text-(--muted-text)">
						Mensagem privada
					</p>
				</div>
				{callAction}
			</header>
			<div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-7">
				<div className="mx-auto max-w-4xl">
					{loading && <p role="status">Carregando conversa...</p>}
					{!loading && messages.length === 0 && (
						<p className="py-8 text-center text-sm text-(--muted-text)">
							Este é o início da sua conversa com{" "}
							{selected.displayName}.
						</p>
					)}
					<MessageList
						currentUserId={currentUser.id}
						messages={chatMessages}
						members={[]}
						readOnly
					/>
					<div ref={end} />
				</div>
			</div>
			<ChatComposer
				key={selected.id}
				transport={{
					connected: !loading && !sending,
					error: status,
					setError: setStatus,
					sendMessage,
				}}
				placeholder={`Mensagem para ${selected.displayName}`}
				sendLabel="Enviar mensagem privada"
			/>
		</section>
	);
}
