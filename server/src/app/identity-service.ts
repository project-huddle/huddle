import { createHash, randomInt } from "node:crypto";
import { db } from "../infra/database/client";
import type { User } from "../infra/database/identity-repository";
import { sendMail } from "../infra/email/mailer";

type TokenPurpose = "email_verification" | "two_factor";

const codeHash = (code: string) =>
  createHash("sha256").update(code).digest("hex");

export async function sendIdentityCode(
  user: Pick<User, "id" | "email" | "displayName">,
  purpose: TokenPurpose,
): Promise<string> {
  const code = String(randomInt(100_000, 1_000_000));
  const tokenId = crypto.randomUUID();
  await db.$transaction([
    db.emailToken.deleteMany({ where: { userId: user.id, purpose } }),
    db.emailToken.create({
      data: {
        id: tokenId,
        userId: user.id,
        purpose,
        codeHash: codeHash(code),
        expiresAt: new Date(Date.now() + 10 * 60_000),
      },
    }),
  ]);
  await sendMail({
    to: user.email,
    subject:
      purpose === "two_factor"
        ? "Seu código de acesso ao Huddle"
        : "Confirme seu e-mail no Huddle",
    text: `Olá, ${user.displayName}. Seu código é ${code}. Ele expira em 10 minutos.`,
  });
  return tokenId;
}

export async function verifyIdentityCode(
  userId: string,
  purpose: TokenPurpose,
  code: string,
): Promise<boolean> {
  const token = await db.emailToken.findFirst({
    where: {
      userId,
      purpose,
      codeHash: codeHash(code),
      expiresAt: { gt: new Date() },
    },
  });
  if (!token) return false;
  await db.$transaction([
    db.emailToken.deleteMany({ where: { userId, purpose } }),
    ...(purpose === "email_verification"
      ? [
          db.user.update({
            where: { id: userId },
            data: { emailVerifiedAt: new Date() },
          }),
        ]
      : []),
  ]);
  return true;
}

export async function verifyTwoFactorChallenge(
  challengeId: string,
  code: string,
): Promise<string | null> {
  const token = await db.emailToken.findFirst({
    where: {
      id: challengeId,
      purpose: "two_factor",
      codeHash: codeHash(code),
      expiresAt: { gt: new Date() },
    },
  });
  if (!token) return null;
  await db.emailToken.deleteMany({
    where: { userId: token.userId, purpose: "two_factor" },
  });
  return token.userId;
}
