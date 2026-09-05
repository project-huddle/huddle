import { Prisma } from "@prisma/client";
import { db } from "../infra/database/client";

const publicUserSelect = {
  id: true,
  email: true,
  displayName: true,
  avatarUrl: true,
  createdAt: true,
  emailVerifiedAt: true,
  countryCode: true,
  twoFactorEnabled: true,
} satisfies Prisma.UserSelect;

type PublicProfileRow = Prisma.UserGetPayload<{
  select: typeof publicUserSelect;
}>;
export type ProfileView = ReturnType<typeof profileView>;
export type UpdateProfileInput = {
  displayName?: string;
  avatarUrl?: string | null;
  countryCode?: string;
};
export type UpdateProfileResult =
  | { type: "success"; profile: ProfileView }
  | { type: "invalid-name" }
  | { type: "invalid-avatar" }
  | { type: "invalid-country" }
  | { type: "conflict" };

function profileView(row: PublicProfileRow) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    emailVerifiedAt: row.emailVerifiedAt?.toISOString() ?? null,
  };
}

export async function getProfile(userId: string): Promise<ProfileView> {
  const profile = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: publicUserSelect,
  });
  return profileView(profile);
}

export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<UpdateProfileResult> {
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

  const countryCode = input.countryCode?.trim().toUpperCase();
  if (countryCode !== undefined && !/^[A-Z]{2}$/.test(countryCode))
    return { type: "invalid-country" };

  const profile = await db.user
    .update({
      where: { id: userId },
      data: {
        displayName,
        avatarUrl,
        countryCode,
      },
      select: publicUserSelect,
    })
    .catch((cause) => {
      if (
        cause instanceof Prisma.PrismaClientKnownRequestError &&
        cause.code === "P2002"
      )
        return null;
      throw cause;
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
  const account = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!(await Bun.password.verify(currentPassword, account.passwordHash)))
    return "invalid-current-password";
  if (newPassword.length < 8 || newPassword.length > 128)
    return "invalid-new-password";
  const passwordHash = await Bun.password.hash(newPassword, {
    algorithm: "argon2id",
  });
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { passwordHash } }),
    db.session.deleteMany({ where: { userId } }),
  ]);
  return "success";
}

export async function setTwoFactorEnabled(
  userId: string,
  enabled: boolean,
): Promise<"success" | "email-not-verified"> {
  if (enabled) {
    const current = await db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { emailVerifiedAt: true },
    });
    if (!current.emailVerifiedAt) return "email-not-verified";
  }
  await db.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: enabled },
  });
  return "success";
}
