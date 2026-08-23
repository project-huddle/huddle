import { describe, expect, test } from "bun:test";
import { createInvite } from "./create-invite";

const invite = {
  code: "abc1234567",
  serverId: "server-1",
  expiresAt: "2026-08-30T00:00:00.000Z",
};

describe("create-invite", () => {
  test("returns the created invite", async () => {
    const result = await createInvite(
      {
        async createInvite() {
          return invite;
        },
      },
      "user-1",
      "server-1",
    );
    expect(result).toEqual({ type: "success", invite });
  });

  test("maps an unauthorized repository result", async () => {
    const result = await createInvite(
      {
        async createInvite() {
          return null;
        },
      },
      "user-1",
      "server-1",
    );
    expect(result).toEqual({ type: "forbidden" });
  });
});
