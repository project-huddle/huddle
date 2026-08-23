import { Prisma } from "@prisma/client";
import { db, userSelect, userView, type AuthUser, type User } from "./mappers";

export type { AuthUser, User } from "./mappers";

export async function findUserByEmail(email: string): Promise<AuthUser | null> {
  const user = await db.user.findUnique({
    where: { email },
    select: { ...userSelect, passwordHash: true, twoFactorEnabled: true },
  });
  return user
    ? {
        ...userView(user),
        passwordHash: user.passwordHash,
        twoFactorEnabled: user.twoFactorEnabled,
      }
    : null;
}
export async function createUser(
  email: string,
  displayName: string,
  passwordHash: string,
): Promise<User | null> {
  try {
    const created = await db.user.create({
      data: { email, displayName, passwordHash },
      select: userSelect,
    });
    return userView(created);
  } catch (cause) {
    if (
      cause instanceof Prisma.PrismaClientKnownRequestError &&
      cause.code === "P2002"
    )
      return null;
    throw cause;
  }
}
export async function createSession(
  userId: string,
  tokenHash: string,
  expiresAt: number,
): Promise<void> {
  await db.$transaction([
    db.session.deleteMany({ where: { expiresAt: { lte: new Date() } } }),
    db.session.create({
      data: { tokenHash, userId, expiresAt: new Date(expiresAt) },
    }),
  ]);
}
export async function userForSession(tokenHash: string): Promise<User | null> {
  const session = await db.session.findFirst({
    where: { tokenHash, expiresAt: { gt: new Date() } },
    select: { user: { select: userSelect } },
  });
  return session ? userView(session.user) : null;
}

export async function userForId(userId: string): Promise<User | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: userSelect,
  });
  return user ? userView(user) : null;
}
export async function deleteSession(tokenHash: string): Promise<void> {
  await db.session.deleteMany({ where: { tokenHash } });
}
