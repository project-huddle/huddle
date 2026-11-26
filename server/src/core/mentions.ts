export type MentionMember = { id: string; displayName: string };
export type MentionMatch = {
  start: number;
  end: number;
  text: string;
  userIds: string[];
};

// Keep this algorithm aligned with client/src/lib/mentions.ts. Both Docker
// builds have separate contexts; one fixture suite exercises both versions.
export function parseMentions(
  content: string,
  members: readonly MentionMember[],
): MentionMatch[] {
  const candidates = [...members]
    .filter(({ displayName }) => displayName.length > 0)
    .sort((left, right) => right.displayName.length - left.displayName.length);
  const matches: MentionMatch[] = [];
  let offset = 0;

  while (offset < content.length) {
    const start = content.indexOf("@", offset);
    if (start < 0) break;
    offset = start + 1;
    if (start > 0 && !/\s/u.test(content[start - 1] ?? "")) continue;

    const member = candidates.find(({ displayName }) => {
      const end = start + 1 + displayName.length;
      const literal = content.slice(start + 1, end);
      const hasBoundary = end === content.length || /[\s.,!?]/u.test(content[end] ?? "");
      return hasBoundary && literal.toLowerCase() === displayName.toLowerCase();
    });
    if (!member) continue;

    const end = start + 1 + member.displayName.length;
    const normalizedName = member.displayName.toLowerCase();
    const userIds = [...new Set(candidates
      .filter(({ displayName }) => displayName.toLowerCase() === normalizedName)
      .map(({ id }) => id))];
    matches.push({ start, end, text: content.slice(start, end), userIds });
    offset = end;
  }
  return matches;
}
