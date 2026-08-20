/**
 * Compatibility facade. New code must import the repository for its aggregate
 * from `infra/database` instead of depending on the whole persistence layer.
 */
export { db } from "./infra/database/client";
export * from "./infra/database/identity-repository";
export * from "./infra/database/server-repository";
export * from "./infra/database/message-repository";
