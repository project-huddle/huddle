import { api, type GifResult } from "./api";

type GiphyPayload = {
	data: Array<{
		id: string;
		title: string;
		images: {
			original?: { url: string };
			fixed_width?: { url: string };
			fixed_width_small?: { url: string };
		};
	}>;
};

export async function searchGiphy(
	query: string,
	token: string,
): Promise<GifResult[]> {
	const { apiKey } = await api<{ apiKey: string }>("/gifs/config", {}, token);
	const endpoint = new URL("https://api.giphy.com/v1/gifs/search");
	endpoint.search = new URLSearchParams({
		api_key: apiKey,
		q: query,
		limit: "18",
		rating: "pg-13",
		lang: "pt",
	}).toString();
	const response = await fetch(endpoint, {
		signal: AbortSignal.timeout(10_000),
	});
	if (!response.ok)
		throw new Error(
			"Não foi possível buscar GIFs. Tente novamente em instantes.",
		);
	const payload = (await response.json()) as GiphyPayload;
	return payload.data.flatMap((gif) => {
		const url = gif.images.original?.url;
		const previewUrl =
			gif.images.fixed_width_small?.url ??
			gif.images.fixed_width?.url ??
			url;
		if (!url || !previewUrl) return [];
		return [
			{
				id: gif.id,
				type: "gif",
				url,
				previewUrl,
				alt: gif.title || "GIF do GIPHY",
			},
		];
	});
}
