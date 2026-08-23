export type IdentityTokenPurpose = "email_verification" | "two_factor";

export type IdentityTokenRepository = {
  storeToken(input: {
    id: string;
    userId: string;
    purpose: IdentityTokenPurpose;
    codeHash: string;
    expiresAt: Date;
  }): Promise<void>;
  consumeEmailVerification(
    userId: string,
    codeHash: string,
  ): Promise<boolean>;
  consumeTwoFactor(
    challengeId: string,
    codeHash: string,
  ): Promise<string | null>;
};
