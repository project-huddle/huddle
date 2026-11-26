import { Prisma } from "@prisma/client";
import type { AuthUser, User } from "@/features/auth/types/user";
import { db, userSelect, userView } from "../../../shared/infrastructure/database/mappers";

export type IdentityTokenPurpose = "email_verification" | "two_factor";

export async function replaceIdentityCode(input: {
  id: string;
  userId: string;
  purpose: IdentityTokenPurpose;
  codeHash: string;
  expiresAt: Date;
}): Promise<void> {
  await db.$transaction([
    db.emailToken.deleteMany({
      where: { userId: input.userId, purpose: input.purpose },
    }),
    db.emailToken.create({ data: input }),
  ]);
}

export async function findIdentityCode(input: {
  userId: string;
  purpose: IdentityTokenPurpose;
  codeHash: string;
  now: Date;
}) {
  return db.emailToken.findFirst({
    where: {
      userId: input.userId,
      purpose: input.purpose,
      codeHash: input.codeHash,
      expiresAt: { gt: input.now },
    },
  });
}

export async function consumeIdentityCodes(
  userId: string,
  purpose: IdentityTokenPurpose,
  verifiedAt?: Date,
): Promise<void> {
  await db.$transaction([
    db.emailToken.deleteMany({ where: { userId, purpose } }),
    ...(verifiedAt
      ? [
          db.user.update({
            where: { id: userId },
            data: { emailVerifiedAt: verifiedAt },
          }),
        ]
      : []),
  ]);
}

export async function findTwoFactorCode(input: {
  challengeId: string;
  codeHash: string;
  now: Date;
}) {
  return db.emailToken.findFirst({
    where: {
      id: input.challengeId,
      purpose: "two_factor",
      codeHash: input.codeHash,
      expiresAt: { gt: input.now },
    },
  });
}

export async function deleteTwoFactorCodes(userId: string): Promise<void> {
  await db.emailToken.deleteMany({ where: { userId, purpose: "two_factor" } });
}

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

export async function findUserById(userId: string): Promise<User> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: userSelect,
  });
  return userView(user);
}

export async function createUser(
  email: string,
  displayName: string,
  passwordHash: string,
  username?: string,
): Promise<User | null> {
  try {
    const created = await db.user.create({
      data: { email, displayName, passwordHash, username },
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
export async function deleteSession(tokenHash: string): Promise<void> {
  await db.session.deleteMany({ where: { tokenHash } });
}

export async function sessionForTokenHash(tokenHash: string) {
  const session = await db.session.findUnique({where: {tokenHash}, select: {expiresAt:true,user:{select:userSelect}}});
  if (!session || session.expiresAt.getTime() <= Date.now()) return null;
  return {tokenHash, expiresAt:session.expiresAt.getTime(), user:userView(session.user)};
}
