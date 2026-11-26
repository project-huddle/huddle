import { canPublishMedia } from "../../media/application/media-access";
import { revokeUserSessionAccess } from "../../auth/application/session-revocation";
import { normalizeUsername, isValidUsername } from "@/core/identity/username";
import {
  findPasswordHash,
  findProfile,
  isEmailVerified,
  updatePasswordAndDeleteSessions,
  updateProfileRecord,
  updateTwoFactorSetting,
  type ProfileRecord,
} from "../infrastructure/account-repository";

export type ProfileView = ReturnType<typeof profileView>;
export type UpdateProfileInput = {
  username?: string;
  displayName?: string;
  avatarUrl?: string | null;
  countryCode?: string | null;
  audioInputDeviceId?: string | null;
  audioOutputDeviceId?: string | null;
  videoInputDeviceId?: string | null;
};
export type UpdateProfileResult =
  | { type: "success"; profile: ProfileView }
  | { type: "invalid-username" }
  | { type: "invalid-name" }
  | { type: "invalid-avatar" }
  | { type: "invalid-country" }
  | { type: "conflict" };

function profileView(row: ProfileRecord) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    emailVerifiedAt: row.emailVerifiedAt?.toISOString() ?? null,
  };
}

export async function getProfile(userId: string): Promise<ProfileView> {
  const profile = await findProfile(userId);
  return profileView(profile);
}

export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<UpdateProfileResult> {
  const username =
    input.username === undefined
      ? undefined
      : normalizeUsername(input.username);
  if (username !== undefined && !isValidUsername(username))
    return { type: "invalid-username" };
  const displayName = input.displayName?.trim();
  if (
    displayName !== undefined &&
    (displayName.length < 2 || displayName.length > 32)
  )
    return { type: "invalid-name" };

  const avatarUrl = input.avatarUrl;
  if (
    typeof avatarUrl === "string" &&
    !/^\/media\/[a-f0-9-]+\.(jpg|png|gif|webp)$/.test(avatarUrl)
  )
    return { type: "invalid-avatar" };

  if (typeof avatarUrl === "string" && !(await canPublishMedia(avatarUrl, userId))) return {type:"invalid-avatar"};

  const countryCode =
    input.countryCode === null ? null : input.countryCode?.trim().toUpperCase();
  if (
    countryCode !== undefined &&
    countryCode !== null &&
    !/^[A-Z]{2}$/.test(countryCode)
  )
    return { type: "invalid-country" };

  const deviceIds = [
    input.audioInputDeviceId,
    input.audioOutputDeviceId,
    input.videoInputDeviceId,
  ];
  if (
    deviceIds.some(
      (value) =>
        value !== undefined &&
        value !== null &&
        (typeof value !== "string" || value.length > 512),
    )
  )
    return { type: "conflict" };

  const profile = await updateProfileRecord(userId, {
    username,
    displayName,
    avatarUrl,
    countryCode,
    audioInputDeviceId: input.audioInputDeviceId,
    audioOutputDeviceId: input.audioOutputDeviceId,
    videoInputDeviceId: input.videoInputDeviceId,
  });
  return profile
    ? { type: "success", profile: profileView(profile) }
    : { type: "conflict" };
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<"success" | "invalid-current-password" | "invalid-new-password"> {
  const currentPasswordHash = await findPasswordHash(userId);
  if (!(await Bun.password.verify(currentPassword, currentPasswordHash)))
    return "invalid-current-password";
  if (newPassword.length < 8 || newPassword.length > 128)
    return "invalid-new-password";
  const passwordHash = await Bun.password.hash(newPassword, {
    algorithm: "argon2id",
  });
  await updatePasswordAndDeleteSessions(userId, passwordHash);
  revokeUserSessionAccess(userId);
  return "success";
}

export async function setTwoFactorEnabled(
  userId: string,
  enabled: boolean,
): Promise<"success" | "email-not-verified"> {
  if (enabled && !(await isEmailVerified(userId)))
    return "email-not-verified";
  await updateTwoFactorSetting(userId, enabled);
  return "success";
}
