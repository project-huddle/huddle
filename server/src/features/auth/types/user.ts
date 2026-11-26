export type User = {
  id: string;
  email: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  createdAt: string;
};

export type AuthUser = User & {
  passwordHash: string;
  twoFactorEnabled: boolean;
};
