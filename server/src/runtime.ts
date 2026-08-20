import { config } from "./config";
import { createHttpApplication } from "./interfaces/http/application";

export function createRuntimeServer() {
  const application = createHttpApplication().listen({
    hostname: config.host,
    port: config.port,
  });
  if (!application.server)
    throw new Error("Elysia failed to start the server.");
  return application.server;
}
