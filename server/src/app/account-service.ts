import { isValidCpf, normalizeCpf } from "../core/identity/cpf";
import type { AccountRepository } from "../features/account/account-repository.port";
import { verifyAgeWithSerpro, type AgeVerificationResult } from "../infra/identity/serpro-age-verifier";

export type ProfileView = ReturnType<typeof profileView>;
export type UpdateProfileInput = { displayName?: string; avatarUrl?: string | null; countryCode?: string; birthDate?: string; cpf?: string };
export type UpdateProfileResult =
  | { type: "success"; profile: ProfileView } | { type: "invalid-name" } | { type: "invalid-avatar" }
  | { type: "invalid-country" } | { type: "invalid-birth-date" } | { type: "invalid-cpf" }
  | { type: "birth-date-required" } | { type: "verification-unavailable" } | { type: "conflict" };

function profileView(row: Awaited<ReturnType<AccountRepository["findProfile"]>>) {
  return { ...row, createdAt: row.createdAt.toISOString(), emailVerifiedAt: row.emailVerifiedAt?.toISOString() ?? null, ageVerifiedAt: row.ageVerifiedAt?.toISOString() ?? null };
}

export function createAccountService(repository: AccountRepository, verifyAge: (cpf: string, birthDate: Date) => Promise<AgeVerificationResult> = verifyAgeWithSerpro) {
  async function getProfile(userId: string): Promise<ProfileView> { return profileView(await repository.findProfile(userId)); }
  async function updateProfile(userId: string, input: UpdateProfileInput): Promise<UpdateProfileResult> {
    const displayName = input.displayName?.trim();
    if (displayName !== undefined && (displayName.length < 2 || displayName.length > 32)) return { type: "invalid-name" };
    const avatarUrl = input.avatarUrl;
    if (typeof avatarUrl === "string" && !/^\/media\/[a-f0-9-]+\.(jpg|png|gif|webp)$/.test(avatarUrl)) return { type: "invalid-avatar" };
    const countryCode = input.countryCode?.trim().toUpperCase();
    if (countryCode !== undefined && !/^[A-Z]{2}$/.test(countryCode)) return { type: "invalid-country" };
    const birthDate = input.birthDate ? new Date(`${input.birthDate}T00:00:00.000Z`) : undefined;
    if (birthDate && (Number.isNaN(birthDate.valueOf()) || birthDate > new Date())) return { type: "invalid-birth-date" };
    const current = await repository.findAgeVerification(userId);
    let verification: AgeVerificationResult | undefined;
    if (countryCode === "BR" && (!current.ageVerifiedAt || input.cpf !== undefined)) {
      if (!input.cpf || !isValidCpf(input.cpf)) return { type: "invalid-cpf" };
      if (!birthDate) return { type: "birth-date-required" };
      try { verification = await verifyAge(normalizeCpf(input.cpf), birthDate); }
      catch (cause) { console.error("Serpro age verification failed", cause instanceof Error ? cause.message : cause); return { type: "verification-unavailable" }; }
    }
    const updated = await repository.updateProfile(userId, {
      displayName, avatarUrl, countryCode,
      ...(countryCode && countryCode !== "BR" ? { ageGroup: null, ageVerifiedAt: null, ageVerificationProvider: null } : {}),
      ...(verification ? { ageGroup: verification.ageGroup, ageVerifiedAt: new Date(), ageVerificationProvider: verification.provider } : {}),
    });
    return updated ? { type: "success", profile: profileView(updated) } : { type: "conflict" };
  }
  async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<"success" | "invalid-current-password" | "invalid-new-password"> {
    const passwordHash = await repository.findPasswordHash(userId);
    if (!(await Bun.password.verify(currentPassword, passwordHash))) return "invalid-current-password";
    if (newPassword.length < 8 || newPassword.length > 128) return "invalid-new-password";
    await repository.updatePassword(userId, await Bun.password.hash(newPassword, { algorithm: "argon2id" }));
    return "success";
  }
  async function setTwoFactorEnabled(userId: string, enabled: boolean): Promise<"success" | "email-not-verified"> {
    if (enabled && !(await repository.isEmailVerified(userId))) return "email-not-verified";
    await repository.setTwoFactorEnabled(userId, enabled);
    return "success";
  }
  return { getProfile, updateProfile, changePassword, setTwoFactorEnabled };
}
export type AccountService = ReturnType<typeof createAccountService>;
