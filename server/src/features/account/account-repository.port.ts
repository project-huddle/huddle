export type AccountProfile = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: Date;
  emailVerifiedAt: Date | null;
  countryCode: string | null;
  ageGroup: "adult" | "minor" | null;
  ageVerifiedAt: Date | null;
  ageVerificationProvider: "serpro" | null;
  twoFactorEnabled: boolean;
};

export type AccountRepository = {
  findProfile(userId: string): Promise<AccountProfile>;
  findAgeVerification(userId: string): Promise<{ ageVerifiedAt: Date | null }>;
  updateProfile(userId: string, data: {
    displayName?: string;
    avatarUrl?: string | null;
    countryCode?: string;
    ageGroup?: "adult" | "minor" | null;
    ageVerifiedAt?: Date | null;
    ageVerificationProvider?: "serpro" | null;
  }): Promise<AccountProfile | null>;
  findPasswordHash(userId: string): Promise<string>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;
  setTwoFactorEnabled(userId: string, enabled: boolean): Promise<void>;
  isEmailVerified(userId: string): Promise<boolean>;
};
