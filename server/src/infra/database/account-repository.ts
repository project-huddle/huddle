import { Prisma } from "@prisma/client";
import type { AccountProfile, AccountRepository } from "../../features/account/account-repository.port";
import { db } from "./client";

const publicUserSelect = {
  id: true, email: true, displayName: true, avatarUrl: true, createdAt: true,
  emailVerifiedAt: true, countryCode: true, ageGroup: true, ageVerifiedAt: true,
  ageVerificationProvider: true, twoFactorEnabled: true,
} satisfies Prisma.UserSelect;
type PublicProfileRow = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

function profile(row: PublicProfileRow): AccountProfile {
  return {
    ...row,
    ageGroup: row.ageGroup === "adult" || row.ageGroup === "minor" ? row.ageGroup : null,
    ageVerificationProvider: row.ageVerificationProvider === "serpro" ? "serpro" : null,
  };
}

export function createAccountRepository(): AccountRepository {
  return {
    async findProfile(userId) { return profile(await db.user.findUniqueOrThrow({ where: { id: userId }, select: publicUserSelect })); },
    async findAgeVerification(userId) { return db.user.findUniqueOrThrow({ where: { id: userId }, select: { ageVerifiedAt: true } }); },
    async updateProfile(userId, data) {
      return db.user.update({ where: { id: userId }, data, select: publicUserSelect }).then(profile).catch((cause) => {
        if (cause instanceof Prisma.PrismaClientKnownRequestError && cause.code === "P2002") return null;
        throw cause;
      });
    },
    async findPasswordHash(userId) { return (await db.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } })).passwordHash; },
    async updatePassword(userId, passwordHash) {
      await db.$transaction([
        db.user.update({ where: { id: userId }, data: { passwordHash } }),
        db.session.deleteMany({ where: { userId } }),
      ]);
    },
    async setTwoFactorEnabled(userId, enabled) { await db.user.update({ where: { id: userId }, data: { twoFactorEnabled: enabled } }); },
    async isEmailVerified(userId) { return (await db.user.findUniqueOrThrow({ where: { id: userId }, select: { emailVerifiedAt: true } })).emailVerifiedAt !== null; },
  };
}
