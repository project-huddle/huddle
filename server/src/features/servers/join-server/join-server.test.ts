import { describe, expect, test } from "bun:test";
import { createJoinServer } from "./join-server";
import type { JoinServerRepository } from "./join-server.port";

function createRepository(): JoinServerRepository & { addedMembers: string[] } {
  return {
    addedMembers: [],
    async findInvite(code) {
      if (code !== "invite1") return null;
      return {
        code,
        serverId: "server-1",
        expiresAt: new Date("2026-08-22T00:00:00.000Z"),
      };
    },
    async findServer() {
      return {
        id: "server-1",
        name: "Community",
        ownerId: "owner-1",
        createdAt: "2026-08-21T00:00:00.000Z",
        memberIds: ["owner-1"],
      };
    },
    async addMember(serverId, userId) {
      this.addedMembers.push(`${serverId}:${userId}`);
      return "joined";
    },
  };
}

describe("join-server", () => {
  test("loads the invite, decides in the domain and persists membership", async () => {
    const repository = createRepository();
    const joinServer = createJoinServer({ repository });

    const result = await joinServer({
      userId: "member-1",
      code: " INVITE1 ",
      now: new Date("2026-08-21T12:00:00.000Z"),
    });

    expect(result).toEqual({
      type: "success",
      server: {
        id: "server-1",
        name: "Community",
        ownerId: "owner-1",
        createdAt: "2026-08-21T00:00:00.000Z",
      },
    });
    expect(repository.addedMembers).toEqual(["server-1:member-1"]);
  });

  test("does not persist an already existing membership", async () => {
    const repository = createRepository();
    repository.findServer = async () => ({
      id: "server-1",
      name: "Community",
      ownerId: "owner-1",
      createdAt: "2026-08-21T00:00:00.000Z",
      memberIds: ["owner-1", "member-1"],
    });
    const joinServer = createJoinServer({ repository });

    const result = await joinServer({
      userId: "member-1",
      code: "invite1",
      now: new Date("2026-08-21T12:00:00.000Z"),
    });

    expect(result.type).toBe("success");
    expect(repository.addedMembers).toHaveLength(0);
  });

  test("returns an explicit result for malformed codes", async () => {
    const repository = createRepository();
    const joinServer = createJoinServer({ repository });

    await expect(
      joinServer({ userId: "member-1", code: "bad" }),
    ).resolves.toEqual({ type: "invalid-code" });
  });
});
