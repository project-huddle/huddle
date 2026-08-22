import { config } from "./config";
import { createServerApplication } from "./bootstrap/server";

export function createRuntimeServer() {
  const application = createServerApplication().listen({
    hostname: config.host,
    port: config.port,
  });
  if (!application.server)
    throw new Error("Elysia failed to start the server.");
  return application.server;
}
