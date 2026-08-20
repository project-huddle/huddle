import { describe, expect, test } from "bun:test";
import { isAdult, isValidCpf, normalizeCpf } from "./identity/cpf";
import { can, permissionsFor } from "./moderation/permissions";
import { FixedWindowRateLimiter } from "../rate-limit";

describe("core domain rules", () => {
  test("normalizes and validates CPF without accepting repeated digits", () => {
    expect(normalizeCpf("529.982.247-25")).toBe("52998224725");
    expect(isValidCpf("529.982.247-25")).toBeTrue();
    expect(isValidCpf("111.111.111-11")).toBeFalse();
    expect(isValidCpf("529.982.247-24")).toBeFalse();
  });

  test("calculates adulthood at the exact UTC birthday boundary", () => {
    const now = new Date("2026-08-20T12:00:00.000Z");
    expect(isAdult(new Date("2008-08-20T00:00:00.000Z"), now)).toBeTrue();
    expect(isAdult(new Date("2008-08-21T00:00:00.000Z"), now)).toBeFalse();
  });

  test("applies role defaults and safe permission overrides", () => {
    expect(can("member", "members.manage")).toBeFalse();
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
