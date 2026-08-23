import { describe, expect, test } from "bun:test";
import { getServer } from "./get-server";

const server = {
  id: "server-1",
  name: "Huddle",
  ownerId: "user-1",
  createdAt: "2026-08-22T00:00:00.000Z",
};

describe("get-server", () => {
  test("returns a server accessible to the user", async () => {
    const result = await getServer(
      {
        async getServer() {
          return server;
        },
      },
      "user-1",
      "server-1",
    );
    expect(result).toEqual({ type: "success", server });
  });

  test("returns forbidden when the server is inaccessible", async () => {
    const result = await getServer(
      {
        async getServer() {
          return null;
        },
      },
      "user-1",
      "server-1",
    );
    expect(result).toEqual({ type: "forbidden" });
  });
});
