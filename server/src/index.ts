import { config } from "./bootstrap/config";
import { createRuntimeServer } from "./bootstrap/runtime";

export const server = createRuntimeServer();

console.log(`huddle server listening on http://${config.host}:${server.port}`);
