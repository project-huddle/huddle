import { describe, expect, test } from "bun:test";
import { createListServersHandler } from "./list-servers";

describe("list-servers", () => {
  test("delegates the authenticated user to the repository", async () => {
    const calls: string[] = [];
    const servers = [
      {
        id: "server-1",
        name: "Huddle",
        ownerId: "user-1",
        createdAt: "2026-08-22T00:00:00.000Z",
      },
    ];
    const listServers = createListServersHandler({
      repository: {
        async listServers(userId) {
          calls.push(userId);
          return servers;
        },
      },
    });

    await expect(listServers("user-1")).resolves.toEqual(servers);
    expect(calls).toEqual(["user-1"]);
  });
});
