import { describe, expect, test } from "bun:test";
import { createCreateChannelHandler } from "./create-channel";

const channel = {
  id: "channel-1",
  serverId: "server-1",
  name: "texto-geral",
  type: "text" as const,
};

describe("create-channel", () => {
  test("normalizes the name before creating the channel", async () => {
    const calls: string[] = [];
    const createChannel = createCreateChannelHandler({
      repository: {
        async createChannel(_userId, _serverId, name) {
          calls.push(name);
          return { ...channel, name };
        },
      },
    });

    const result = await createChannel({
      userId: "user-1",
      serverId: "server-1",
      name: "  Sala Geral  ",
    });

    expect(result).toEqual({
      type: "success",
      channel: { ...channel, name: "sala-geral" },
    });
    expect(calls).toEqual(["sala-geral"]);
  });

  test("does not persist an invalid name", async () => {
    let persisted = false;
    const createChannel = createCreateChannelHandler({
      repository: {
        async createChannel() {
          persisted = true;
          return channel;
        },
      },
    });

    const result = await createChannel({
      userId: "user-1",
      serverId: "server-1",
      name: "!",
    });

    expect(result).toEqual({ type: "invalid-name" });
    expect(persisted).toBe(false);
  });

  test("returns forbidden when the repository cannot authorize creation", async () => {
    const createChannel = createCreateChannelHandler({
      repository: {
        async createChannel() {
          return null;
        },
      },
    });

    const result = await createChannel({
      userId: "user-1",
      serverId: "server-1",
      name: "geral",
    });

    expect(result).toEqual({ type: "forbidden" });
  });
});
