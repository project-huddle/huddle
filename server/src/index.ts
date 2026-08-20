import { config } from "./config";
import { createRuntimeServer } from "./runtime";

export const server = createRuntimeServer();

console.log(`huddle server listening on http://${config.host}:${server.port}`);
