import { describe, expect, test } from "bun:test";
import { createListChannelsHandler } from "./list-channels";

const channel = {
  id: "channel-1",
  serverId: "server-1",
  name: "geral",
  type: "text" as const,
};

describe("list-channels", () => {
  test("returns the channels for an authorized member", async () => {
    const listChannels = createListChannelsHandler({
      repository: {
        async listChannels() {
          return { authorized: true, channels: [channel] };
        },
      },
    });

    const result = await listChannels({
      userId: "user-1",
      serverId: "server-1",
    });

    expect(result).toEqual({ type: "success", channels: [channel] });
  });

  test("returns forbidden for a non-member even when no channels exist", async () => {
    const listChannels = createListChannelsHandler({
      repository: {
        async listChannels() {
          return { authorized: false, channels: [] };
        },
      },
    });

    const result = await listChannels({
      userId: "user-1",
      serverId: "server-1",
    });

    expect(result).toEqual({ type: "forbidden" });
  });
});
