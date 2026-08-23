import { describe, expect, test } from "bun:test";
import { removeMember } from "./remove-member";

describe("remove-member", () => {
  test("revokes access only after a successful removal", async () => {
    const revoked: string[] = [];
    const result = await removeMember(
      {
        async removeMember() {
          return "ok";
        },
      },
      "owner",
      "server",
      "member",
      async (userId) => {
        revoked.push(userId);
      },
    );
    expect(result).toEqual({ type: "success" });
    expect(revoked).toEqual(["member"]);
  });

  test("does not revoke access when the repository rejects the operation", async () => {
    let revoked = false;
    const result = await removeMember(
      {
        async removeMember() {
          return "missing";
        },
      },
      "owner",
      "server",
      "member",
      async () => {
        revoked = true;
      },
    );
    expect(result).toEqual({ type: "missing" });
    expect(revoked).toBe(false);
  });
});
