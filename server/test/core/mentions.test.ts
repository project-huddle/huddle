import { describe, expect, test } from "bun:test";
import { parseMentions as serverMentions } from "../../src/core/mentions";
import { parseMentions as clientMentions } from "../../../client/src/lib/mentions";

const members = [
  { id: "ana", displayName: "Ana" },
  { id: "qa", displayName: "Ana (QA)" },
  { id: "ops", displayName: "dev+ops" },
  { id: "bracket", displayName: "User[1]" },
  { id: "other-qa", displayName: "Ana (QA)" },
];

for (const [implementation, parseMentions] of [
  ["server", serverMentions],
  ["client", clientMentions],
] as const) {
  describe(`${implementation} literal mentions`, () => {
    test("matches literal punctuation in names and chooses the longest name", () => {
      const content = "@Ana (QA), @DEV+OPS! @User[1]?";
      const matches = parseMentions(content, members);
      expect(matches.map(({ text, userIds }) => ({ text, userIds }))).toEqual([
        { text: "@Ana (QA)", userIds: ["qa", "other-qa"] },
        { text: "@DEV+OPS", userIds: ["ops"] },
        { text: "@User[1]", userIds: ["bracket"] },
      ]);
      expect(matches.map(({ start, end }) => content.slice(start, end)))
        .toEqual(["@Ana (QA)", "@DEV+OPS", "@User[1]"]);
    });

    test("rejects prefixes, email fragments and regex-like substitutes", () => {
      expect(parseMentions(
        "email@Ana @Anabelle @Ana (QA)x @devvvvvops @dev+ops2 @User1 @User[1]extra",
        members.filter(({ id }) => id !== "ana"),
      )).toEqual([]);
      expect(parseMentions("@Anabelle x@Ana (@Ana)", members)).toEqual([]);
    });

    test("supports start, whitespace, punctuation and repeated mentions without consuming separators", () => {
      const content = "@Ana, @Ana\n@Ana. @Ana! @Ana?";
      expect(parseMentions(content, members).map(({ text }) => text))
        .toEqual(Array(5).fill("@Ana"));
      expect(parseMentions(content, [])).toEqual([]);
    });
  });
}
