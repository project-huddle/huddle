import { describe, expect, test } from "bun:test";
import { Invite } from "./invite";
import { Server } from "./server";

describe("server domain", () => {
  test("allows a user to join once", () => {
    const server = Server.restore({
      id: "server-1",
      name: "Community",
      ownerId: "owner-1",
      createdAt: "2026-08-21T00:00:00.000Z",
      memberIds: ["owner-1"],
    });

    expect(server.join("member-1")).toEqual({ type: "joined" });
    expect(server.join("member-1")).toEqual({ type: "already-member" });
  });

  test("knows when an invite has expired", () => {
    const invite = Invite.restore({
      code: "invite-1",
      serverId: "server-1",
      expiresAt: new Date("2026-08-21T12:00:00.000Z"),
    });

    expect(invite.isActiveAt(new Date("2026-08-21T11:59:59.000Z"))).toBeTrue();
    expect(invite.isActiveAt(new Date("2026-08-21T12:00:00.000Z"))).toBeFalse();
  });
});
