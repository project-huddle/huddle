import { Elysia } from "elysia";
import { createCallIceConfig } from "@/app/call-ice-config";
import { config } from "@/bootstrap/config";
import { authenticatedRoutes } from "../plugins/auth";
import { json } from "../responses";

export const callIceConfigRoutes = new Elysia({ name: "call-ice-config-routes" })
  .use(authenticatedRoutes("authenticated-call-ice-config-routes"))
  .get("/calls/ice-config", ({ currentUser }) => {
    const iceConfig = createCallIceConfig(currentUser.id, config, Date.now());
    return json(iceConfig, 200, new Headers({ "Cache-Control": "no-store" }));
  });
