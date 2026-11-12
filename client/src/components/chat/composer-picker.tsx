import { lazy, Suspense } from "react";
import { Search, X } from "lucide-react";
import type { useMessageComposer } from "@/hooks/use-message-composer";
const EmojiPicker = lazy(() => import("./emoji-picker"));

type Props = Pick<
	ReturnType<typeof useMessageComposer>,
	| "picker"
	| "setPicker"
	| "gifQuery"
	| "setGifQuery"
	| "gifs"
	| "gifLoading"
	| "searchGifs"
	| "setMedia"
> & { insertEmoji: (emoji: string) => void };
export function ComposerPicker({
	picker,
	setPicker,
	gifQuery,
	setGifQuery,
	gifs,
	gifLoading,
	searchGifs,
	setMedia,
	insertEmoji,
}: Props) {
	if (!picker) return null;
	return (
		<div className="absolute bottom-[calc(100%+10px)] left-0 z-20 w-full max-w-md rounded-[24px] border border-(--line) bg-(--surface) p-3 shadow-[0_20px_50px_rgb(40_45_51_/_15%)]">
			<div className="mb-3 flex items-center justify-between px-1">
				<strong className="text-sm">
					{picker === "emoji" ? "Escolha um emoji" : "Buscar GIF"}
				</strong>
				<button onClick={() => setPicker(null)}>
					<X className="size-4" />
				</button>
			</div>
			{picker === "emoji" ? (
				<Suspense
					fallback={
						<p role="status" className="p-4 text-sm">
							Carregando emojis...
						</p>
					}
				>
					<EmojiPicker onSelect={insertEmoji} />
				</Suspense>
			) : (
				<>
					<form onSubmit={searchGifs} className="mb-3 flex gap-2">
						<div className="flex flex-1 items-center gap-2 rounded-xl bg-(--canvas) px-3">
							<Search className="size-4" />
							<input
								value={gifQuery}
								onChange={(event) =>
									setGifQuery(event.target.value)
								}
								placeholder="reação, festa, café..."
								className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"
							/>
						</div>
						<button className="rounded-xl bg-(--solid) px-4 text-sm font-bold text-(--on-solid)">
							{gifLoading ? "..." : "buscar"}
						</button>
					</form>
					<div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto">
						{gifs.map((gif) => (
							<button
								key={gif.id}
								onClick={() => {
									setMedia({
										url: gif.url,
										type: "gif",
										alt: gif.alt,
									});
									setPicker(null);
								}}
								className="overflow-hidden rounded-xl bg-(--panel)"
							>
								<img
									src={gif.previewUrl}
									alt={gif.alt}
									className="aspect-square size-full object-cover"
								/>
							</button>
						))}
					</div>
					{!gifs.length && (
						<p className="py-7 text-center text-xs text-(--muted-text)">
							Digite algo para procurar.
						</p>
					)}
					<p className="mt-3 text-center text-[10px] font-bold text-(--muted-text)">
						Powered by GIPHY
					</p>
				</>
			)}
		</div>
	);
}
