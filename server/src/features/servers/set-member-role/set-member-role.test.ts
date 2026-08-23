import { describe, expect, test } from "bun:test";
import { setMemberRole } from "./set-member-role";

describe("set-member-role", () => {
  test("rejects unsupported roles before persistence", async () => {
    let called = false;
    const result = await setMemberRole(
      {
        async setMemberRole() {
          called = true;
          return "ok";
        },
      },
      "owner",
      "server",
      "member",
      "owner",
    );
    expect(result).toEqual({ type: "invalid-role" });
    expect(called).toBe(false);
  });

  test("maps repository authorization results", async () => {
    const result = await setMemberRole(
      {
        async setMemberRole() {
          return "forbidden";
        },
      },
      "owner",
      "server",
      "member",
      "moderator",
    );
    expect(result).toEqual({ type: "forbidden" });
  });
});
