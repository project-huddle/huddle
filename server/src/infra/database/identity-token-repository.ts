import type { IdentityTokenRepository } from "../../features/identity/identity-token-repository.port";
import { db } from "./client";

export function createIdentityTokenRepository(): IdentityTokenRepository {
  return {
    async storeToken({ id, userId, purpose, codeHash, expiresAt }) {
      await db.$transaction([
        db.emailToken.deleteMany({ where: { userId, purpose } }),
        db.emailToken.create({
          data: { id, userId, purpose, codeHash, expiresAt },
        }),
      ]);
    },
    async consumeEmailVerification(userId, codeHash) {
      const token = await db.emailToken.findFirst({
        where: {
          userId,
          purpose: "email_verification",
          codeHash,
          expiresAt: { gt: new Date() },
        },
      });
      if (!token) return false;
      await db.$transaction([
        db.emailToken.deleteMany({
          where: { userId, purpose: "email_verification" },
        }),
        db.user.update({
          where: { id: userId },
          data: { emailVerifiedAt: new Date() },
        }),
      ]);
      return true;
    },
    async consumeTwoFactor(challengeId, codeHash) {
      const token = await db.emailToken.findFirst({
        where: {
          id: challengeId,
          purpose: "two_factor",
          codeHash,
          expiresAt: { gt: new Date() },
        },
      });
      if (!token) return null;
      await db.emailToken.deleteMany({
        where: { userId: token.userId, purpose: "two_factor" },
      });
      return token.userId;
    },
  };
}
