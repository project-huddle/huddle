import { Elysia, t } from "elysia";
import { issueSession, revoke } from "@/interfaces/http/authentication";
import {
  sendIdentityCode,
  verifyTwoFactorChallenge,
} from "@/app/identity-service";
import { db } from "@/infra/database/client";
import {
  createUser,
  findUserByEmail,
} from "@/infra/database/identity-repository";
import { error, json } from "@/interfaces/http/responses";
import { validEmail } from "@/app/validation";
import { issueWebSocketTicket } from "@/interfaces/realtime/realtime-gateway";
import { authenticatedRoutes } from "../plugins/auth";

const registrationBody = t.Object({
  email: t.String(),
  displayName: t.String(),
  password: t.String(),
});
const loginBody = t.Object({ email: t.String(), password: t.String() });
const twoFactorVerificationBody = t.Object({
  challengeId: t.String(),
  code: t.String(),
});

export const authRoutes = new Elysia({ name: "auth-routes" })
  .post(
    "/auth/register",
    async ({ body: input }) => {
      const email = input.email.trim().toLowerCase();
      const displayName = input.displayName.trim();
      const password = input.password;
      if (
        !validEmail(email) ||
        displayName.length < 2 ||
        displayName.length > 32 ||
        password.length < 8 ||
        password.length > 128
      )
        return error(
          400,
          "INVALID_INPUT",
          "Use a valid email, a display name with 2-32 characters, and a password with 8-128 characters.",
        );
      if (await findUserByEmail(email))
        return error(
          409,
          "EMAIL_IN_USE",
          "An account already exists for this email.",
        );
      const user = await createUser(
        email,
        displayName,
        await Bun.password.hash(password, { algorithm: "argon2id" }),
      );
      if (!user)
        return error(
          409,
          "EMAIL_IN_USE",
          "An account already exists for this email.",
        );
      void sendIdentityCode(user, "email_verification").catch((cause) =>
        console.error("Could not send registration verification email", cause),
      );
      return json({ user, session: await issueSession(user.id) }, 201);
    },
    { body: registrationBody },
  )
  .post(
    "/auth/login",
    async ({ body: input }) => {
      const email = input.email.trim().toLowerCase();
      const password = input.password;
      const account = await findUserByEmail(email);
      if (
        !account ||
        !(await Bun.password.verify(password, account.passwordHash))
      )
        return error(401, "INVALID_CREDENTIALS", "Invalid email or password.");
      const { passwordHash: _, twoFactorEnabled, ...user } = account;
      if (twoFactorEnabled)
        return json(
          {
            requiresTwoFactor: true,
            challengeId: await sendIdentityCode(user, "two_factor"),
          },
          202,
        );
      return json({ user, session: await issueSession(user.id) });
    },
    { body: loginBody },
  )
  .post(
    "/auth/2fa/verify",
    async ({ body: input }) => {
      const userId = await verifyTwoFactorChallenge(
        input.challengeId,
        input.code,
      );
      if (!userId)
        return error(401, "INVALID_CODE", "Código inválido ou expirado.");
      const verified = await db.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          displayName: true,
          avatarUrl: true,
          createdAt: true,
        },
      });
      return json({
        user: { ...verified, createdAt: verified.createdAt.toISOString() },
        session: await issueSession(userId),
      });
    },
    { body: twoFactorVerificationBody },
  )
  .use(authenticatedRoutes("authenticated-auth-routes"))
  .get("/auth/me", ({ currentUser }) => json({ user: currentUser }))
  .post("/auth/logout", async ({ request }) => {
    await revoke(request);
    return new Response(null, { status: 204 });
  })
  .post("/auth/ws-ticket", ({ currentUser }) =>
    json({ ticket: issueWebSocketTicket(currentUser), expiresIn: 30 }),
  );
