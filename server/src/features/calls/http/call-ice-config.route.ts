import { Elysia } from "elysia";
import { createCallIceConfig } from "@/features/calls/application/call-ice-config";
import { config } from "@/bootstrap/config";
import { authenticatedRoutes } from "../../../interfaces/http/plugins/auth";
import { json } from "../../../interfaces/http/responses";

export const callIceConfigRoutes = new Elysia({ name: "call-ice-config-routes" })
  .use(authenticatedRoutes("authenticated-call-ice-config-routes"))
  .get("/calls/ice-config", ({ currentUser }) => {
    const iceConfig = createCallIceConfig(currentUser.id, config, Date.now());
    return json(iceConfig, 200, new Headers({ "Cache-Control": "no-store" }));
  });
