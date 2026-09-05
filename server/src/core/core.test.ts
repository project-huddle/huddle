import { describe, expect, test } from "bun:test";
import { can, permissionsFor } from "./moderation/permissions";
import { FixedWindowRateLimiter } from "../interfaces/rate-limit";

describe("core domain rules", () => {
  test("applies role defaults and safe permission overrides", () => {
    expect(can("member", "members.manage")).toBeFalse();
    expect(can("member", "invites.create")).toBeTrue();
    expect(can("moderator", "reports.review")).toBeTrue();
    expect(permissionsFor("member", ["invites.create", "unknown"])).toEqual(
      new Set(["invites.create"]),
    );
  });

  test("rate limiter resets after its window", () => {
    const limiter = new FixedWindowRateLimiter(2, 1000);
    expect(limiter.consume("client", 0)).toBeTrue();
    expect(limiter.consume("client", 1)).toBeTrue();
    expect(limiter.consume("client", 2)).toBeFalse();
    expect(limiter.consume("client", 1000)).toBeTrue();
  });
});
