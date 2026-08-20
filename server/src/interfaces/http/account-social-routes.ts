import { Prisma } from "@prisma/client";
import { db } from "../../infra/database/client";
import type { User } from "../../infra/database/identity-repository";
import { isValidCpf, normalizeCpf } from "../../core/identity/cpf";
import { can, permissions, type Role } from "../../core/moderation/permissions";
import {
  sendIdentityCode,
  verifyIdentityCode,
} from "../../app/identity-service";
import { verifyAgeWithSerpro } from "../../infra/identity/serpro-age-verifier";
import { sendMail } from "../../infra/email/mailer";
import { body, error, json } from "../../http";
import { messageContent, validEmail } from "../../validation";

const publicUserSelect = {
  id: true,
  email: true,
  displayName: true,
  avatarUrl: true,
  createdAt: true,
  emailVerifiedAt: true,
  countryCode: true,
  ageGroup: true,
  ageVerifiedAt: true,
  ageVerificationProvider: true,
  twoFactorEnabled: true,
} satisfies Prisma.UserSelect;

const viewUser = (
  row: Prisma.UserGetPayload<{ select: typeof publicUserSelect }>,
) => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
  emailVerifiedAt: row.emailVerifiedAt?.toISOString() ?? null,
  ageVerifiedAt: row.ageVerifiedAt?.toISOString() ?? null,
});

type Dependencies = { notifyUser: (userId: string, event: unknown) => void };

export async function accountSocialRoutes(
  request: Request,
  url: URL,
  user: User,
  dependencies: Dependencies,
): Promise<Response | undefined> {
  if (request.method === "GET" && url.pathname === "/profile") {
    const profile = await db.user.findUniqueOrThrow({
      where: { id: user.id },
      select: publicUserSelect,
    });
    return json({ user: viewUser(profile) });
  }

  if (request.method === "PATCH" && url.pathname === "/profile") {
    const input = await body(request);
    const displayName =
      typeof input?.displayName === "string"
        ? input.displayName.trim()
        : undefined;
    const avatarUrl =
      typeof input?.avatarUrl === "string" &&
      /^\/media\/[a-f0-9-]+\.(jpg|png|gif|webp)$/.test(input.avatarUrl)
        ? input.avatarUrl
        : input?.avatarUrl === null
          ? null
          : undefined;
    const countryCode =
      typeof input?.countryCode === "string"
        ? input.countryCode.trim().toUpperCase()
        : undefined;
    const birthDate =
      typeof input?.birthDate === "string"
        ? new Date(`${input.birthDate}T00:00:00.000Z`)
        : undefined;
    if (
      displayName !== undefined &&
      (displayName.length < 2 || displayName.length > 32)
    )
      return error(
        400,
        "INVALID_NAME",
        "O nome deve ter entre 2 e 32 caracteres.",
      );
    if (input?.avatarUrl !== undefined && avatarUrl === undefined)
      return error(
        400,
        "INVALID_AVATAR",
        "Envie uma imagem válida antes de atualizar o avatar.",
      );
    if (countryCode !== undefined && !/^[A-Z]{2}$/.test(countryCode))
      return error(
        400,
        "INVALID_COUNTRY",
        "Use um código de país ISO com duas letras.",
      );
    if (
      birthDate &&
      (Number.isNaN(birthDate.valueOf()) || birthDate > new Date())
    )
      return error(
        400,
        "INVALID_BIRTH_DATE",
        "Informe uma data de nascimento válida.",
      );
    let verification:
      Awaited<ReturnType<typeof verifyAgeWithSerpro>> | undefined;
    const currentVerification = await db.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { ageVerifiedAt: true },
    });
    if (
      countryCode === "BR" &&
      (!currentVerification.ageVerifiedAt || input?.cpf !== undefined)
    ) {
      if (typeof input?.cpf !== "string" || !isValidCpf(input.cpf))
        return error(
          400,
          "INVALID_CPF",
          "Informe um CPF válido para verificar a idade.",
        );
      if (!birthDate)
        return error(
          400,
          "BIRTH_DATE_REQUIRED",
          "A data de nascimento é necessária para verificar a idade.",
        );
      try {
        verification = await verifyAgeWithSerpro(
          normalizeCpf(input.cpf),
          birthDate,
        );
      } catch (cause) {
        console.error(
          "Serpro age verification failed",
          cause instanceof Error ? cause.message : cause,
        );
        return error(
          502,
          "AGE_VERIFICATION_FAILED",
          "Não foi possível verificar a idade com a Serpro. Tente novamente.",
        );
      }
    }
    const profile = await db.user
      .update({
        where: { id: user.id },
        data: {
          displayName,
          avatarUrl,
          countryCode,
          ...(countryCode && countryCode !== "BR"
            ? {
                ageGroup: null,
                ageVerifiedAt: null,
                ageVerificationProvider: null,
              }
            : {}),
          ...(verification
            ? {
                ageGroup: verification.ageGroup,
                ageVerifiedAt: new Date(),
                ageVerificationProvider: verification.provider,
              }
            : {}),
        },
        select: publicUserSelect,
      })
      .catch((cause) => {
        if (
          cause instanceof Prisma.PrismaClientKnownRequestError &&
          cause.code === "P2002"
        )
          return null;
        throw cause;
      });
    return profile
      ? json({
          user: viewUser(profile),
          ageGroup: profile.ageGroup ?? "unknown",
        })
      : error(409, "PROFILE_CONFLICT", "Não foi possível atualizar o perfil.");
  }

  if (request.method === "POST" && url.pathname === "/profile/password") {
    const input = await body(request);
    const currentPassword =
      typeof input?.currentPassword === "string" ? input.currentPassword : "";
    const newPassword =
      typeof input?.newPassword === "string" ? input.newPassword : "";
    const account = await db.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    if (!(await Bun.password.verify(currentPassword, account.passwordHash)))
      return error(403, "INVALID_PASSWORD", "A senha atual está incorreta.");
    if (newPassword.length < 8 || newPassword.length > 128)
      return error(
        400,
        "INVALID_PASSWORD",
        "A nova senha deve ter entre 8 e 128 caracteres.",
      );
    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await Bun.password.hash(newPassword, {
            algorithm: "argon2id",
          }),
        },
      }),
      db.session.deleteMany({ where: { userId: user.id } }),
    ]);
    return new Response(null, { status: 204 });
  }

  if (request.method === "POST" && url.pathname === "/profile/email-code") {
    await sendIdentityCode(user, "email_verification");
    return new Response(null, { status: 204 });
  }
  if (request.method === "POST" && url.pathname === "/profile/verify-email") {
    const input = await body(request);
    return typeof input?.code === "string" &&
      (await verifyIdentityCode(user.id, "email_verification", input.code))
      ? new Response(null, { status: 204 })
      : error(400, "INVALID_CODE", "Código inválido ou expirado.");
  }
  if (request.method === "POST" && url.pathname === "/profile/two-factor") {
    const input = await body(request);
    const enabled = input?.enabled === true;
    if (enabled) {
      const current = await db.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { emailVerifiedAt: true },
      });
      if (!current.emailVerifiedAt)
        return error(
          409,
          "EMAIL_NOT_VERIFIED",
          "Confirme seu e-mail antes de ativar a verificação em duas etapas.",
        );
    }
    await db.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: enabled },
    });
    return new Response(null, { status: 204 });
  }

  if (request.method === "GET" && url.pathname === "/friends") {
    const rows = await db.friendship.findMany({
      where: { OR: [{ requesterId: user.id }, { addresseeId: user.id }] },
      include: {
        requester: { select: publicUserSelect },
        addressee: { select: publicUserSelect },
      },
      orderBy: { updatedAt: "desc" },
    });
    return json({
      friendships: rows.map((row) => ({
        status: row.status,
        direction: row.requesterId === user.id ? "outgoing" : "incoming",
        user: viewUser(
          row.requesterId === user.id ? row.addressee : row.requester,
        ),
      })),
    });
  }
  if (request.method === "POST" && url.pathname === "/friends") {
    const input = await body(request);
    const email =
      typeof input?.email === "string" ? input.email.trim().toLowerCase() : "";
    if (!validEmail(email) || email === user.email)
      return error(400, "INVALID_FRIEND", "Informe o e-mail de outra pessoa.");
    const target = await db.user.findUnique({
      where: { email },
      select: publicUserSelect,
    });
    if (!target) return error(404, "USER_NOT_FOUND", "Usuário não encontrado.");
    const reverse = await db.friendship.findUnique({
      where: {
        requesterId_addresseeId: {
          requesterId: target.id,
          addresseeId: user.id,
        },
      },
    });
    if (reverse)
      return error(
        409,
        "REQUEST_EXISTS",
        "Já existe uma solicitação entre estas contas.",
      );
    await db.friendship.upsert({
      where: {
        requesterId_addresseeId: {
          requesterId: user.id,
          addresseeId: target.id,
        },
      },
      create: { requesterId: user.id, addresseeId: target.id },
      update: {},
    });
    dependencies.notifyUser(target.id, { type: "friend_request", user });
    return json({ user: viewUser(target), status: "pending" }, 201);
  }
  const friendshipMatch = url.pathname.match(/^\/friends\/([a-f0-9-]+)$/);
  if (request.method === "PATCH" && friendshipMatch?.[1]) {
    const updated = await db.friendship.updateMany({
      where: {
        requesterId: friendshipMatch[1],
        addresseeId: user.id,
        status: "pending",
      },
      data: { status: "accepted" },
    });
    return updated.count
      ? new Response(null, { status: 204 })
      : error(404, "REQUEST_NOT_FOUND", "Solicitação não encontrada.");
  }
  if (request.method === "DELETE" && friendshipMatch?.[1]) {
    await db.friendship.deleteMany({
      where: {
        OR: [
          { requesterId: user.id, addresseeId: friendshipMatch[1] },
          { requesterId: friendshipMatch[1], addresseeId: user.id },
        ],
      },
    });
    return new Response(null, { status: 204 });
  }

  if (request.method === "GET" && url.pathname === "/direct-messages") {
    const peerId = url.searchParams.get("userId") ?? "";
    const friendship = await db.friendship.findFirst({
      where: {
        status: "accepted",
        OR: [
          { requesterId: user.id, addresseeId: peerId },
          { requesterId: peerId, addresseeId: user.id },
        ],
      },
    });
    if (!friendship)
      return error(
        403,
        "NOT_FRIENDS",
        "Mensagens privadas são permitidas apenas entre amigos.",
      );
    const messages = await db.directMessage.findMany({
      where: {
        OR: [
          { senderId: user.id, recipientId: peerId },
          { senderId: peerId, recipientId: user.id },
        ],
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    return json({
      messages: messages.map((message) => ({
        ...message,
        createdAt: message.createdAt.toISOString(),
        readAt: message.readAt?.toISOString() ?? null,
      })),
    });
  }
  if (request.method === "POST" && url.pathname === "/direct-messages") {
    const input = await body(request);
    const recipientId =
      typeof input?.recipientId === "string" ? input.recipientId : "";
    const content = messageContent(input?.content);
    const friendship = await db.friendship.findFirst({
      where: {
        status: "accepted",
        OR: [
          { requesterId: user.id, addresseeId: recipientId },
          { requesterId: recipientId, addresseeId: user.id },
        ],
      },
    });
    if (!friendship)
      return error(
        403,
        "NOT_FRIENDS",
        "Mensagens privadas são permitidas apenas entre amigos.",
      );
    if (!content)
      return error(400, "INVALID_MESSAGE", "Escreva uma mensagem válida.");
    const created = await db.directMessage.create({
      data: { senderId: user.id, recipientId, content },
    });
    const message = {
      ...created,
      createdAt: created.createdAt.toISOString(),
      readAt: null,
    };
    dependencies.notifyUser(recipientId, { type: "direct_message", message });
    dependencies.notifyUser(user.id, { type: "direct_message", message });
    return json({ message }, 201);
  }

  if (request.method === "POST" && url.pathname === "/reports") {
    const input = await body(request);
    const reason = typeof input?.reason === "string" ? input.reason.trim() : "";
    const serverId =
      typeof input?.serverId === "string" ? input.serverId : null;
    if (reason.length < 10 || reason.length > 1000)
      return error(
        400,
        "INVALID_REPORT",
        "Explique o problema usando entre 10 e 1000 caracteres.",
      );
    if (
      serverId &&
      !(await db.serverMember.findUnique({
        where: { serverId_userId: { serverId, userId: user.id } },
      }))
    )
      return error(403, "FORBIDDEN", "Você não pertence a este servidor.");
    const report = await db.report.create({
      data: {
        reporterId: user.id,
        serverId,
        targetUserId:
          typeof input?.targetUserId === "string" ? input.targetUserId : null,
        messageId:
          typeof input?.messageId === "string" ? input.messageId : null,
        reason,
      },
    });
    if (process.env.MODERATION_EMAIL)
      await sendMail({
        to: process.env.MODERATION_EMAIL,
        subject: "Novo report no Huddle",
        text: `Report ${report.id}: ${reason}`,
      });
    return json(
      { report: { ...report, createdAt: report.createdAt.toISOString() } },
      201,
    );
  }
  const reportsMatch = url.pathname.match(/^\/servers\/([a-f0-9-]+)\/reports$/);
  if (request.method === "GET" && reportsMatch?.[1]) {
    const membership = await db.serverMember.findUnique({
      where: {
        serverId_userId: { serverId: reportsMatch[1], userId: user.id },
      },
    });
    if (
      !membership ||
      !can(membership.role as Role, "reports.review", membership.permissions)
    )
      return error(
        403,
        "FORBIDDEN",
        "Você não possui permissão para revisar reports.",
      );
    return json({
      reports: await db.report.findMany({
        where: { serverId: reportsMatch[1] },
        orderBy: { createdAt: "desc" },
      }),
    });
  }
  const permissionMatch = url.pathname.match(
    /^\/servers\/([a-f0-9-]+)\/members\/([a-f0-9-]+)\/permissions$/,
  );
  if (
    request.method === "PATCH" &&
    permissionMatch?.[1] &&
    permissionMatch[2]
  ) {
    const actor = await db.server.findFirst({
      where: { id: permissionMatch[1], ownerId: user.id },
    });
    if (!actor)
      return error(
        403,
        "FORBIDDEN",
        "Somente o proprietário pode personalizar permissões.",
      );
    const input = await body(request);
    const selected = Array.isArray(input?.permissions)
      ? input.permissions.filter(
          (item): item is string =>
            typeof item === "string" && permissions.includes(item as never),
        )
      : null;
    if (!selected)
      return error(
        400,
        "INVALID_PERMISSIONS",
        "Envie uma lista válida de permissões.",
      );
    await db.serverMember.update({
      where: {
        serverId_userId: {
          serverId: permissionMatch[1],
          userId: permissionMatch[2],
        },
      },
      data: { permissions: selected },
    });
    return new Response(null, { status: 204 });
  }
}
