import { Elysia } from "elysia";
import { authenticate } from "@/auth";

export class NotAuthenticatedError extends Error {
  constructor() {
    super("A valid bearer token is required.");
    this.name = "NotAuthenticatedError";
  }
}

export function authenticatedRoutes(name: string) {
  return new Elysia({ name }).derive({ as: "scoped" }, async ({ request }) => {
    const currentUser = await authenticate(request);
    if (!currentUser) throw new NotAuthenticatedError();
    return { currentUser };
  });
}
