import { Prisma } from "@prisma/client";
import { db } from "@/shared/infrastructure/database/client";

const profileSelect = {
  id: true,
  email: true,
  displayName: true,
  username: true,
  avatarUrl: true,
  createdAt: true,
  emailVerifiedAt: true,
  countryCode: true,
  twoFactorEnabled: true,
  audioInputDeviceId: true,
  audioOutputDeviceId: true,
  videoInputDeviceId: true,
} satisfies Prisma.UserSelect;

export type ProfileRecord = Prisma.UserGetPayload<{
  select: typeof profileSelect;
}>;

export type ProfileUpdateRecord = {
  username?: string;
  displayName?: string;
  avatarUrl?: string | null;
  countryCode?: string | null;
  audioInputDeviceId?: string | null;
  audioOutputDeviceId?: string | null;
  videoInputDeviceId?: string | null;
};

export async function findProfile(userId: string): Promise<ProfileRecord> {
  return db.user.findUniqueOrThrow({
    where: { id: userId },
    select: profileSelect,
  });
}

export async function updateProfileRecord(
  userId: string,
  input: ProfileUpdateRecord,
): Promise<ProfileRecord | null> {
  return db.user
    .update({ where: { id: userId }, data: input, select: profileSelect })
    .catch((cause) => {
      if (
        cause instanceof Prisma.PrismaClientKnownRequestError &&
        cause.code === "P2002"
      ) {
        return null;
      }
      throw cause;
    });
}

export async function findPasswordHash(userId: string): Promise<string> {
  const account = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { passwordHash: true },
  });
  return account.passwordHash;
}

export async function updatePasswordAndDeleteSessions(
  userId: string,
  passwordHash: string,
): Promise<void> {
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { passwordHash } }),
    db.session.deleteMany({ where: { userId } }),
  ]);
}

export async function isEmailVerified(userId: string): Promise<boolean> {
  const account = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { emailVerifiedAt: true },
  });
  return account.emailVerifiedAt !== null;
}

export async function updateTwoFactorSetting(
  userId: string,
  enabled: boolean,
): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: enabled },
  });
}
