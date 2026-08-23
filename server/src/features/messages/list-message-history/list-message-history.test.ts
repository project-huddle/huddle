import { describe, expect, test } from "bun:test";
import { listMessageHistory } from "./list-message-history";

const access = {
  async firstChannelForUser() {
    return { id: "channel-1" };
  },
  async channelForUser() {
    return { id: "channel-1" };
  },
};

describe("list-message-history", () => {
  test("uses the fallback channel and clamps the requested limit", async () => {
    let received:
      { channelId: string; limit: number; before?: string } | undefined;
    const result = await listMessageHistory(
      {
        async listMessageHistory(channelId, limit, before) {
          received = { channelId, limit, before };
          return [{ id: "message-1" }];
        },
      },
      access,
      "user-1",
      undefined,
      "999",
      undefined,
      100,
    );
    expect(result).toEqual({
      type: "success",
      messages: [{ id: "message-1" }],
    });
    expect(received).toEqual({
      channelId: "channel-1",
      limit: 100,
      before: undefined,
    });
  });

  test("rejects an invalid cursor before persistence", async () => {
    let called = false;
    const result = await listMessageHistory(
      {
        async listMessageHistory() {
          called = true;
          return [];
        },
      },
      access,
      "user-1",
      "channel-1",
      undefined,
      "not-a-date",
      100,
    );
    expect(result).toEqual({ type: "invalid-cursor" });
    expect(called).toBe(false);
  });

  test("denies an inaccessible channel", async () => {
    const result = await listMessageHistory(
      {
        async listMessageHistory() {
          return [];
        },
      },
      {
        async firstChannelForUser() {
          return null;
        },
        async channelForUser() {
          return null;
        },
      },
      "user-1",
      "channel-1",
      undefined,
      undefined,
      100,
    );
    expect(result).toEqual({ type: "forbidden" });
  });
});
