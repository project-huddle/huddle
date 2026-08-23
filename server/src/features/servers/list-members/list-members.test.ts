import { describe, expect, test } from "bun:test";
import { listMembers } from "./list-members";

const member = {
  id: "user-1",
  email: "user@example.com",
  displayName: "User",
  avatarUrl: null,
  createdAt: "2026-08-22T00:00:00.000Z",
  joinedAt: "2026-08-22T00:00:00.000Z",
  role: "owner" as const,
  isOwner: true,
};

describe("list-members", () => {
  test("returns members for an authorized user", async () => {
    const result = await listMembers(
      {
        async listMembers() {
          return [member];
        },
      },
      "user-1",
      "server-1",
    );
    expect(result).toEqual({ type: "success", members: [member] });
  });

  test("returns forbidden for a non-member", async () => {
    const result = await listMembers(
      {
        async listMembers() {
          return null;
        },
      },
      "user-1",
      "server-1",
    );
    expect(result).toEqual({ type: "forbidden" });
  });
});
