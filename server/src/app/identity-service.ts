import { createHash, randomInt } from "node:crypto";
import type { IdentityTokenRepository } from "../features/identity/identity-token-repository.port";
import type { User } from "../infra/database/identity-repository";
import { sendMail } from "../infra/email/mailer";

type TokenPurpose = "email_verification" | "two_factor";

const codeHash = (code: string) =>
  createHash("sha256").update(code).digest("hex");

export function createIdentityService(repository: IdentityTokenRepository) {
  async function sendIdentityCode(
    user: Pick<User, "id" | "email" | "displayName">,
    purpose: TokenPurpose,
  ): Promise<string> {
    const code = String(randomInt(100_000, 1_000_000));
    const tokenId = crypto.randomUUID();
    await repository.storeToken({
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

  async function verifyIdentityCode(
    userId: string,
    purpose: TokenPurpose,
    code: string,
  ): Promise<boolean> {
    return purpose === "email_verification"
      ? repository.consumeEmailVerification(userId, codeHash(code))
      : false;
  }

  async function verifyTwoFactorChallenge(
    challengeId: string,
    code: string,
  ): Promise<string | null> {
    return repository.consumeTwoFactor(challengeId, codeHash(code));
  }

  return { sendIdentityCode, verifyIdentityCode, verifyTwoFactorChallenge };
}

export type IdentityService = ReturnType<typeof createIdentityService>;
