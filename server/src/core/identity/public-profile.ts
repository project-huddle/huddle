export type PublicProfile = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
};

export function publicProfile(user: PublicProfile): PublicProfile {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  };
}
