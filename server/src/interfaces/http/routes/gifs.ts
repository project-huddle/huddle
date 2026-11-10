import { Elysia } from "elysia";
import { config } from "@/bootstrap/config";
import { error, json } from "@/interfaces/http/responses";
import { authenticatedRoutes } from "../plugins/auth";

export const gifRoutes = new Elysia({ name: "gif-routes" })
  .use(authenticatedRoutes("authenticated-gif-routes"))
  .get("/gifs/config", () => {
    if (!config.giphyApiKey)
      return error(
        503,
        "GIF_PROVIDER_UNAVAILABLE",
        "A busca de GIFs está indisponível no momento.",
      );
    // GIPHY requires browser-side searches; this is a public integration key.
    return json({ apiKey: config.giphyApiKey });
  });
