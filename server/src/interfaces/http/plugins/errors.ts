import { Elysia } from "elysia";
import { error } from "@/interfaces/http/responses";
import { NotAuthenticatedError } from "./auth";

export const errorHandling = new Elysia({ name: "http-errors" }).onError(
  { as: "global" },
  ({ code, error: cause, set }) => {
    if (cause instanceof NotAuthenticatedError)
      return error(401, "UNAUTHORIZED", cause.message);
    if (code === "NOT_FOUND")
      return error(404, "NOT_FOUND", "Route not found.");
    if (code === "VALIDATION" || code === "PARSE")
      return error(400, "INVALID_INPUT", "The request is invalid.");
    console.error(cause);
    set.status = 500;
    return error(500, "INTERNAL_ERROR", "An unexpected error occurred.");
  },
);
