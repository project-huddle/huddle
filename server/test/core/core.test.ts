import { describe, expect, test } from "bun:test";
import { can, defaultMemberPermissions, permissionsFor } from "@/core/moderation/permissions";
import { FixedWindowRateLimiter } from "@/interfaces/rate-limit";

describe("core domain rules", () => {
  test("applies role defaults and safe permission overrides", () => {
    expect(can("member", "members.manage")).toBeFalse();
    expect(can("member", "invites.create")).toBeFalse();
    expect(can("moderator", "reports.review")).toBeTrue();
    expect(permissionsFor("member", ["unknown"])).toEqual(new Set());
    expect(defaultMemberPermissions).toContain("channels.view");
  });

  test("rate limiter resets after its window", () => {
    const limiter = new FixedWindowRateLimiter(2, 1000);
    expect(limiter.consume("client", 0)).toBeTrue();
    expect(limiter.consume("client", 1)).toBeTrue();
    expect(limiter.consume("client", 2)).toBeFalse();
    expect(limiter.consume("client", 1000)).toBeTrue();
  });
});
