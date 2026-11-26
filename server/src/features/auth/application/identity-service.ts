import { createHash, randomInt } from "node:crypto";
import type { User } from "@/features/auth/types/user";
import { sendMail } from "../infrastructure/mailer";
import {
  consumeIdentityCodes,
  deleteTwoFactorCodes,
  findIdentityCode,
  findTwoFactorCode,
  replaceIdentityCode,
  type IdentityTokenPurpose,
} from "../infrastructure/identity-repository";

const codeHash = (code: string) =>
  createHash("sha256").update(code).digest("hex");

export async function sendIdentityCode(
  user: Pick<User, "id" | "email" | "displayName">,
  purpose: IdentityTokenPurpose,
): Promise<string> {
  const code = String(randomInt(100_000, 1_000_000));
  const tokenId = crypto.randomUUID();
  await replaceIdentityCode({
    id: tokenId,
    userId: user.id,
    purpose,
    codeHash: codeHash(code),
    expiresAt: new Date(Date.now() + 10 * 60_000),
  });
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
  purpose: IdentityTokenPurpose,
  code: string,
): Promise<boolean> {
  const token = await findIdentityCode({
    userId,
    purpose,
    codeHash: codeHash(code),
    now: new Date(),
  });
  if (!token) return false;
  const verifiedAt = purpose === "email_verification" ? new Date() : undefined;
  await consumeIdentityCodes(userId, purpose, verifiedAt);
  return true;
}

export async function verifyTwoFactorChallenge(
  challengeId: string,
  code: string,
): Promise<string | null> {
  const token = await findTwoFactorCode({
    challengeId,
    codeHash: codeHash(code),
    now: new Date(),
  });
  if (!token) return null;
  await deleteTwoFactorCodes(token.userId);
  return token.userId;
}
