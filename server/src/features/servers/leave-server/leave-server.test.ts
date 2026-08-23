import { describe, expect, test } from "bun:test";
import { leaveServer } from "./leave-server";

describe("leave-server", () => {
  test("revokes access after leaving", async () => {
    const revoked: string[] = [];
    const result = await leaveServer(
      {
        async leaveServer() {
          return "left";
        },
      },
      "user-1",
      "server-1",
      async (userId) => {
        revoked.push(userId);
      },
    );
    expect(result).toEqual({ type: "success" });
    expect(revoked).toEqual(["user-1"]);
  });

  test("does not revoke access when the owner tries to leave", async () => {
    let revoked = false;
    const result = await leaveServer(
      {
        async leaveServer() {
          return "owner";
        },
      },
      "user-1",
      "server-1",
      async () => {
        revoked = true;
      },
    );
    expect(result).toEqual({ type: "owner" });
    expect(revoked).toBe(false);
  });
});
