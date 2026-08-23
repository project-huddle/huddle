import { describe, expect, test } from "bun:test";
import { createCreateServerHandler } from "./create-server";

describe("create-server", () => {
  test("normalizes the name before persisting", async () => {
    const calls: Array<{ ownerId: string; name: string }> = [];
    const createServer = createCreateServerHandler({
      repository: {
        async createServer(ownerId, name) {
          calls.push({ ownerId, name });
          return {
            server: {
              id: "server-1",
              name,
              ownerId,
              createdAt: "2026-08-22T00:00:00.000Z",
            },
            channel: {
              id: "channel-1",
              serverId: "server-1",
              name: "geral",
              type: "text",
            },
          };
        },
      },
    });

    const result = await createServer({
      userId: "user-1",
      name: "  Comunidade  ",
    });

    expect(result.type).toBe("success");
    expect(calls).toEqual([{ ownerId: "user-1", name: "Comunidade" }]);
  });

  test("rejects names outside the supported length", async () => {
    let persisted = false;
    const createServer = createCreateServerHandler({
      repository: {
        async createServer() {
          persisted = true;
          throw new Error("should not persist");
        },
      },
    });

    const result = await createServer({ userId: "user-1", name: " x " });

    expect(result).toEqual({ type: "invalid-name" });
    expect(persisted).toBe(false);
  });
});
