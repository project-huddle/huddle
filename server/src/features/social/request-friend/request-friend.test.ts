import { describe, expect, test } from "bun:test";
import { requestFriend } from "./request-friend";

const target = {
  id: "user-2",
  email: "bob@example.com",
  displayName: "Bob",
  avatarUrl: null,
  createdAt: "2026-08-23T00:00:00.000Z",
};

describe("request-friend", () => {
  test("normalizes and creates a request", async () => {
    let created = false;
    const result = await requestFriend(
      {
        findUserByEmail: async () => target,
        hasReverseRequest: async () => false,
        createRequest: async () => {
          created = true;
        },
      },
      { id: "user-1", email: "alice@example.com" },
      " BOB@EXAMPLE.COM ",
    );
    expect(result).toEqual({ type: "success", user: target });
    expect(created).toBe(true);
  });

  test("rejects self requests before persistence", async () => {
    const result = await requestFriend(
      {
        findUserByEmail: async () => target,
        hasReverseRequest: async () => false,
        createRequest: async () => {},
      },
      { id: "user-1", email: "alice@example.com" },
      "alice@example.com",
    );
    expect(result).toEqual({ type: "invalid" });
  });
});
