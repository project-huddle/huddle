import { Elysia, t } from "elysia";
import { changePassword, setTwoFactorEnabled } from "@/app/account-service";
import { sendIdentityCode, verifyIdentityCode } from "@/app/identity-service";
import { error } from "@/interfaces/http/responses";
import { authenticatedRoutes } from "../plugins/auth";

const passwordBody = t.Object({
  currentPassword: t.String(),
  newPassword: t.String(),
});
const verificationCodeBody = t.Object({ code: t.String() });
const twoFactorBody = t.Object({ enabled: t.Boolean() });

export const accountSecurityRoutes = new Elysia({
  name: "account-security-routes",
})
  .use(authenticatedRoutes("authenticated-account-security-routes"))
  .post(
    "/profile/password",
    async ({ currentUser, body }) => {
      const result = await changePassword(
        currentUser.id,
        body.currentPassword,
        body.newPassword,
      );
      if (result === "invalid-current-password")
        return error(403, "INVALID_PASSWORD", "A senha atual está incorreta.");
      if (result === "invalid-new-password")
        return error(
          400,
          "INVALID_PASSWORD",
          "A nova senha deve ter entre 8 e 128 caracteres.",
        );
      return new Response(null, { status: 204 });
    },
    { body: passwordBody },
  )
  .post("/profile/email-code", async ({ currentUser }) => {
    await sendIdentityCode(currentUser, "email_verification");
    return new Response(null, { status: 204 });
  })
  .post(
    "/profile/verify-email",
    async ({ currentUser, body }) => {
      const isVerified = await verifyIdentityCode(
        currentUser.id,
        "email_verification",
        body.code,
      );
      if (!isVerified)
        return error(400, "INVALID_CODE", "Código inválido ou expirado.");
      return new Response(null, { status: 204 });
    },
    { body: verificationCodeBody },
  )
  .post(
    "/profile/two-factor",
    async ({ currentUser, body }) => {
      const result = await setTwoFactorEnabled(currentUser.id, body.enabled);
      if (result === "email-not-verified")
        return error(
          409,
          "EMAIL_NOT_VERIFIED",
          "Confirme seu e-mail antes de ativar a verificação em duas etapas.",
        );
      return new Response(null, { status: 204 });
    },
    { body: twoFactorBody },
  );
