import { Elysia, t } from "elysia";
import { config } from "../../../config";
import { error, json } from "../../../http";
import { authenticatedRoutes } from "../plugins/auth";

type TenorPayload = {
  results?: Array<{
    id: string;
    content_description?: string;
    media_formats?: { tinygif?: { url?: string }; gif?: { url?: string } };
  }>;
};

export const gifRoutes = new Elysia({ name: "gif-routes" })
  .use(authenticatedRoutes("authenticated-gif-routes"))
  .get(
    "/gifs/search",
    async ({ query }) => {
      if (!config.tenorApiKey)
        return error(
          503,
          "GIF_PROVIDER_UNAVAILABLE",
          "GIF search is not configured.",
        );
      const search = (query.q ?? "").trim().slice(0, 80);
      if (!search) return json({ results: [] });
      const endpoint = new URL("https://tenor.googleapis.com/v2/search");
      endpoint.search = new URLSearchParams({
        q: search,
        key: config.tenorApiKey,
        client_key: config.tenorClientKey,
        limit: "18",
        locale: "pt_BR",
        contentfilter: "medium",
        media_filter: "tinygif,gif",
      }).toString();
      const response = await fetch(endpoint);
      if (!response.ok)
        return error(
          502,
          "GIF_PROVIDER_ERROR",
          "The GIF provider could not complete the search.",
        );
      const payload = (await response.json()) as TenorPayload;
      const results = (payload.results ?? []).flatMap((item) => {
        const url = item.media_formats?.gif?.url;
        const previewUrl = item.media_formats?.tinygif?.url ?? url;
        if (!url || !previewUrl) return [];
        return [
          {
            id: item.id,
            url,
            previewUrl,
            alt: item.content_description ?? "GIF do Tenor",
          },
        ];
      });
      return json({ results });
    },
    { query: t.Object({ q: t.Optional(t.String()) }) },
  );
