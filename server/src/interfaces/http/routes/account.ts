import { Elysia, t } from "elysia";
import {
  getProfile,
  updateProfile,
  type UpdateProfileResult,
} from "@/app/account-service";
import { error, json } from "@/http";
import { authenticatedRoutes } from "../plugins/auth";

const profileBody = t.Object({
  displayName: t.Optional(t.String()),
  avatarUrl: t.Optional(t.Union([t.String(), t.Null()])),
  countryCode: t.Optional(t.String()),
  birthDate: t.Optional(t.String()),
  cpf: t.Optional(t.String()),
});

function profileError(
  result: Exclude<UpdateProfileResult, { type: "success" }>,
): Response {
  switch (result.type) {
    case "invalid-name":
      return error(
        400,
        "INVALID_NAME",
        "O nome deve ter entre 2 e 32 caracteres.",
      );
    case "invalid-avatar":
      return error(
        400,
        "INVALID_AVATAR",
        "Envie uma imagem válida antes de atualizar o avatar.",
      );
    case "invalid-country":
      return error(
        400,
        "INVALID_COUNTRY",
        "Use um código de país ISO com duas letras.",
      );
    case "invalid-birth-date":
      return error(
        400,
        "INVALID_BIRTH_DATE",
        "Informe uma data de nascimento válida.",
      );
    case "invalid-cpf":
      return error(
        400,
        "INVALID_CPF",
        "Informe um CPF válido para verificar a idade.",
      );
    case "birth-date-required":
      return error(
        400,
        "BIRTH_DATE_REQUIRED",
        "A data de nascimento é necessária para verificar a idade.",
      );
    case "verification-unavailable":
      return error(
        502,
        "AGE_VERIFICATION_FAILED",
        "Não foi possível verificar a idade com a Serpro. Tente novamente.",
      );
    case "conflict":
      return error(
        409,
        "PROFILE_CONFLICT",
        "Não foi possível atualizar o perfil.",
      );
  }
}

export const accountRoutes = new Elysia({ name: "account-routes" })
  .use(authenticatedRoutes("authenticated-account-routes"))
  .get("/profile", async ({ currentUser }) => {
    return json({ user: await getProfile(currentUser.id) });
  })
  .patch(
    "/profile",
    async ({ currentUser, body }) => {
      const result = await updateProfile(currentUser.id, body);
      if (result.type !== "success") return profileError(result);
      return json({
        user: result.profile,
        ageGroup: result.profile.ageGroup ?? "unknown",
      });
    },
    { body: profileBody },
  );
