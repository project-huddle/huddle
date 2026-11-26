import { describe, expect, test } from "bun:test";
import {
  decodeDirectMessageCursor,
  encodeDirectMessageCursor,
} from "../../src/app/direct-message-cursor";

const alice = "00000000-0000-4000-8000-000000000001";
const bob = "00000000-0000-4000-8000-000000000002";
const carol = "00000000-0000-4000-8000-000000000003";
const anchor = {
  id: "00000000-0000-4000-8000-000000000004",
  createdAt: new Date("2026-11-12T00:00:00.000Z"),
};

describe("direct message cursors", () => {
  test("preserves the timestamp and tie breaker for either participant", () => {
    const cursor = encodeDirectMessageCursor(alice, bob, anchor);
    expect(decodeDirectMessageCursor(cursor, alice, bob)).toEqual(anchor);
    expect(decodeDirectMessageCursor(cursor, bob, alice)).toEqual(anchor);
  });

  test("rejects a cursor belonging to another conversation", () => {
    const cursor = encodeDirectMessageCursor(alice, bob, anchor);
    expect(decodeDirectMessageCursor(cursor, alice, carol)).toBeNull();
  });

  test("rejects malformed encodings, invalid dates and invalid identifiers", () => {
    for (const value of ["", "%%%", "e30", "a".repeat(2048)]) {
      expect(decodeDirectMessageCursor(value, alice, bob)).toBeNull();
    }
    for (const patch of [{ createdAt: "not-a-date" }, { id: "not-an-id" }]) {
      const payload = {
        pair: [alice, bob],
        id: anchor.id,
        createdAt: anchor.createdAt.toISOString(),
        ...patch,
      };
      const cursor = Buffer.from(JSON.stringify(payload)).toString("base64url");
      expect(decodeDirectMessageCursor(cursor, alice, bob)).toBeNull();
    }
  });
});
