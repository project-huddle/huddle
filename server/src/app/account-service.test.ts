import { describe, expect, test } from "bun:test";
import { createAccountService } from "./account-service";
import type {
  AccountProfile,
  AccountRepository,
} from "../features/account/account-repository.port";

const profile: AccountProfile = {
  id: "user-1",
  email: "user@example.com",
  displayName: "User",
  avatarUrl: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  emailVerifiedAt: new Date("2026-01-02T00:00:00.000Z"),
  countryCode: null,
  ageGroup: null,
  ageVerifiedAt: null,
  ageVerificationProvider: null,
  twoFactorEnabled: false,
};

function repository(overrides: Partial<AccountRepository> = {}): AccountRepository {
  return {
    findProfile: async () => profile,
    findAgeVerification: async () => ({ ageVerifiedAt: null }),
    updateProfile: async () => profile,
    findPasswordHash: async () => "hash",
    updatePassword: async () => {},
    setTwoFactorEnabled: async () => {},
    isEmailVerified: async () => true,
    ...overrides,
  };
}

describe("account service", () => {
  test("serializes profile dates at the application boundary", async () => {
    const service = createAccountService(repository());

    expect(await service.getProfile("user-1")).toMatchObject({
      id: "user-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      emailVerifiedAt: "2026-01-02T00:00:00.000Z",
      ageVerifiedAt: null,
    });
  });

  test("rejects invalid profile input before persistence", async () => {
    let persisted = false;
    const service = createAccountService(
      repository({
        updateProfile: async () => {
          persisted = true;
          return profile;
        },
      }),
    );

    expect(await service.updateProfile("user-1", { displayName: "A" })).toEqual({
      type: "invalid-name",
    });
    expect(persisted).toBeFalse();
  });

  test("verifies a Brazilian profile and persists the age result", async () => {
    let saved: Parameters<AccountRepository["updateProfile"]>[1] | undefined;
    const service = createAccountService(
      repository({
        updateProfile: async (_userId, data) => {
          saved = data;
          return profile;
        },
      }),
      async () => ({ ageGroup: "adult", provider: "serpro" }),
    );

    const result = await service.updateProfile("user-1", {
      countryCode: "br",
      birthDate: "1990-05-10",
      cpf: "529.982.247-25",
    });

    expect(result.type).toBe("success");
    expect(saved).toMatchObject({
      countryCode: "BR",
      ageGroup: "adult",
      ageVerificationProvider: "serpro",
    });
  });

  test("maps a persistence conflict", async () => {
    const service = createAccountService(
      repository({ updateProfile: async () => null }),
    );

    expect(await service.updateProfile("user-1", { countryCode: "US" })).toEqual({
      type: "conflict",
    });
  });

  test("requires a verified email before enabling two-factor auth", async () => {
    let changed = false;
    const service = createAccountService(
      repository({
        isEmailVerified: async () => false,
        setTwoFactorEnabled: async () => {
          changed = true;
        },
      }),
    );

    expect(await service.setTwoFactorEnabled("user-1", true)).toBe(
      "email-not-verified",
    );
    expect(changed).toBeFalse();
  });
});
