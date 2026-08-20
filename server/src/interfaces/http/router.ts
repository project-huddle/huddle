import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { authenticate, issueSession, revoke } from "../../auth";
import {
  sendIdentityCode,
  verifyTwoFactorChallenge,
} from "../../app/identity-service";
import { config } from "../../config";
import { db } from "../../infra/database/client";
import {
  createUser,
  findUserByEmail,
} from "../../infra/database/identity-repository";
import { messageHistory } from "../../infra/database/message-repository";
import {
  channelForUser,
  createChannel,
  createInvite,
  createServer,
  firstChannelForUser,
  isServerMember,
  joinServer,
  leaveServer,
  listChannels,
  listServers,
  removeMember,
  serverForUser,
  serverMembers,
  setMemberRole,
} from "../../infra/database/server-repository";
import { body, error, json } from "../../http";
import { FixedWindowRateLimiter } from "../../rate-limit";
import { validEmail } from "../../validation";
import { accountSocialRoutes } from "./account-social-routes";
import {
  issueWebSocketTicket,
  notifyUser,
  revokeUnauthorizedSocketAccess,
} from "../realtime/realtime-gateway";

mkdirSync(config.uploadsPath, { recursive: true });

const imageTypes = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
} as const;

function detectedImageType(bytes: Uint8Array): keyof typeof imageTypes | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (
    bytes
      .slice(0, 8)
      .every(
        (value, index) =>
          value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index],
      )
  )
    return "image/png";
  const header = new TextDecoder().decode(bytes.slice(0, 12));
  if (header.startsWith("GIF87a") || header.startsWith("GIF89a"))
    return "image/gif";
  if (header.startsWith("RIFF") && header.slice(8) === "WEBP")
    return "image/webp";
  return null;
}

export async function routeRequest(
  request: Request,
): Promise<Response | undefined> {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (request.method === "GET" && url.pathname === "/health")
    return json({ status: "ok", timestamp: new Date().toISOString() });
  if (
    request.method === "GET" &&
    /^\/media\/[a-f0-9-]+\.(jpg|png|gif|webp)$/.test(url.pathname)
  ) {
    const file = Bun.file(
      join(config.uploadsPath, url.pathname.slice("/media/".length)),
    );
    if (!(await file.exists()))
      return error(404, "NOT_FOUND", "Media not found.");
    return new Response(file, {
      headers: {
        "Content-Type": file.type,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  if (request.method === "POST" && url.pathname === "/auth/register") {
    const input = await body(request);
    const email =
      typeof input?.email === "string"
        ? input.email.trim().toLowerCase()
        : input?.email;
    const displayName =
      typeof input?.displayName === "string"
        ? input.displayName.trim()
        : input?.displayName;
    const password = input?.password;
    if (
      !validEmail(email) ||
      typeof displayName !== "string" ||
      displayName.length < 2 ||
      displayName.length > 32 ||
      typeof password !== "string" ||
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
  }

  if (request.method === "POST" && url.pathname === "/auth/login") {
    const input = await body(request);
    const email =
      typeof input?.email === "string" ? input.email.trim().toLowerCase() : "";
    const password = typeof input?.password === "string" ? input.password : "";
    const account = await findUserByEmail(email);
    if (
      !account ||
      !(await Bun.password.verify(password, account.passwordHash))
    )
      return error(401, "INVALID_CREDENTIALS", "Invalid email or password.");
    const { passwordHash: _, twoFactorEnabled, ...user } = account;
    if (twoFactorEnabled) {
      const challengeId = await sendIdentityCode(user, "two_factor");
      return json({ requiresTwoFactor: true, challengeId }, 202);
    }
    return json({ user, session: await issueSession(user.id) });
  }

  if (request.method === "POST" && url.pathname === "/auth/2fa/verify") {
    const input = await body(request);
    const userId =
      typeof input?.challengeId === "string" && typeof input?.code === "string"
        ? await verifyTwoFactorChallenge(input.challengeId, input.code)
        : null;
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
  }

  const user = await authenticate(request);
  if (!user)
    return error(401, "UNAUTHORIZED", "A valid bearer token is required.");
  if (request.method === "GET" && url.pathname === "/auth/me")
    return json({ user });
  if (request.method === "POST" && url.pathname === "/auth/logout") {
    await revoke(request);
    return new Response(null, { status: 204 });
  }
  if (request.method === "POST" && url.pathname === "/auth/ws-ticket")
    return json({ ticket: issueWebSocketTicket(user), expiresIn: 30 });
  const featureResponse = await accountSocialRoutes(request, url, user, {
    notifyUser,
  });
  if (featureResponse) return featureResponse;
  if (request.method === "GET" && url.pathname === "/servers")
    return json({ servers: await listServers(user.id) });
  if (request.method === "POST" && url.pathname === "/servers") {
    const input = await body(request);
    const name = typeof input?.name === "string" ? input.name.trim() : "";
    if (name.length < 2 || name.length > 40)
      return error(
        400,
        "INVALID_INPUT",
        "Server names must have 2-40 characters.",
      );
    return json(await createServer(user, name), 201);
  }
  const serverMatch = url.pathname.match(/^\/servers\/([a-f0-9-]+)$/);
  const serverId = serverMatch?.[1] ?? "";
  if (request.method === "GET" && serverMatch && serverId) {
    const server = await serverForUser(user.id, serverId);
    return server
      ? json({ server })
      : error(403, "FORBIDDEN", "You are not a member of this server.");
  }
  const membersMatch = url.pathname.match(/^\/servers\/([a-f0-9-]+)\/members$/);
  if (request.method === "GET" && membersMatch) {
    const members = membersMatch[1]
      ? await serverMembers(user.id, membersMatch[1])
      : null;
    return members
      ? json({ members })
      : error(403, "FORBIDDEN", "You are not a member of this server.");
  }
  const memberActionMatch = url.pathname.match(
    /^\/servers\/([a-f0-9-]+)\/members\/([a-f0-9-]+)$/,
  );
  if (request.method === "PATCH" && memberActionMatch) {
    const input = await body(request);
    const role =
      input?.role === "moderator" || input?.role === "member"
        ? input.role
        : null;
    if (!role)
      return error(400, "INVALID_ROLE", "Role must be moderator or member.");
    const result =
      memberActionMatch[1] && memberActionMatch[2]
        ? await setMemberRole(
            user.id,
            memberActionMatch[1],
            memberActionMatch[2],
            role,
          )
        : "missing";
    return result === "ok"
      ? new Response(null, { status: 204 })
      : error(
          result === "forbidden" ? 403 : 404,
          result === "forbidden" ? "FORBIDDEN" : "NOT_FOUND",
          result === "forbidden"
            ? "Only the owner can change roles."
            : "Member not found.",
        );
  }
  if (request.method === "DELETE" && memberActionMatch) {
    const result =
      memberActionMatch[1] && memberActionMatch[2]
        ? await removeMember(
            user.id,
            memberActionMatch[1],
            memberActionMatch[2],
          )
        : "missing";
    if (result === "ok" && memberActionMatch[2])
      await revokeUnauthorizedSocketAccess(memberActionMatch[2]);
    return result === "ok"
      ? new Response(null, { status: 204 })
      : error(
          result === "forbidden" ? 403 : 404,
          result === "forbidden" ? "FORBIDDEN" : "NOT_FOUND",
          result === "forbidden"
            ? "Only the owner can remove members."
            : "Member not found.",
        );
  }
  const inviteMatch = url.pathname.match(/^\/servers\/([a-f0-9-]+)\/invites$/);
  if (request.method === "POST" && inviteMatch) {
    const invite = inviteMatch[1]
      ? await createInvite(user.id, inviteMatch[1])
      : null;
    return invite
      ? json({ invite, url: `/invite/${invite.code}` }, 201)
      : error(
          403,
          "FORBIDDEN",
          "Only the owner or a moderator can create invites.",
        );
  }
  if (request.method === "POST" && url.pathname === "/invites/join") {
    const input = await body(request);
    const code =
      typeof input?.code === "string" ? input.code.trim().toUpperCase() : "";
    if (!/^[A-Z0-9]{6,16}$/.test(code))
      return error(400, "INVALID_INVITE", "Invalid invite code.");
    const server = await joinServer(user.id, code.toLowerCase());
    return server
      ? json({ server }, 201)
      : error(404, "INVITE_NOT_FOUND", "This invite is invalid or expired.");
  }
  const leaveMatch = url.pathname.match(/^\/servers\/([a-f0-9-]+)\/leave$/);
  if (request.method === "POST" && leaveMatch) {
    const result = leaveMatch[1]
      ? await leaveServer(user.id, leaveMatch[1])
      : "missing";
    if (result === "owner")
      return error(
        409,
        "OWNER_CANNOT_LEAVE",
        "The owner cannot leave their own server.",
      );
    if (result === "left") await revokeUnauthorizedSocketAccess(user.id);
    return result === "left"
      ? new Response(null, { status: 204 })
      : error(404, "NOT_FOUND", "Server not found.");
  }
  const channelsMatch = url.pathname.match(
    /^\/servers\/([a-f0-9-]+)\/channels$/,
  );
  if (request.method === "GET" && channelsMatch) {
    const serverId = channelsMatch[1];
    if (!serverId || !(await isServerMember(user.id, serverId)))
      return error(403, "FORBIDDEN", "You are not a member of this server.");
    return json({ channels: await listChannels(user.id, serverId) });
  }
  if (request.method === "POST" && channelsMatch) {
    const serverId = channelsMatch[1];
    if (!serverId) return error(400, "INVALID_SERVER", "Invalid server id.");
    const input = await body(request);
    const name =
      typeof input?.name === "string"
        ? input.name.trim().toLowerCase().replace(/\s+/g, "-")
        : "";
    if (name.length < 2 || name.length > 32 || !/^[a-z0-9-_]+$/.test(name))
      return error(
        400,
        "INVALID_INPUT",
        "Channel names may contain 2-32 letters, numbers, hyphens or underscores.",
      );
    const channel = await createChannel(user.id, serverId, name);
    return channel
      ? json({ channel }, 201)
      : error(403, "FORBIDDEN", "You are not a member of this server.");
  }
  if (request.method === "POST" && url.pathname === "/uploads") {
    const declaredLength = Number(request.headers.get("content-length"));
    if (
      Number.isFinite(declaredLength) &&
      declaredLength > config.maxUploadBytes + 64 * 1024
    )
      return error(
        413,
        "FILE_TOO_LARGE",
        "Images must be no larger than 8 MB.",
      );
    const form = await request.formData().catch(() => null);
    const upload = form?.get("file");
    if (!(upload instanceof File))
      return error(400, "INVALID_FILE", "Choose an image to upload.");
    if (upload.size < 1 || upload.size > config.maxUploadBytes)
      return error(
        413,
        "FILE_TOO_LARGE",
        "Images must be no larger than 8 MB.",
      );
    const bytes = new Uint8Array(await upload.arrayBuffer());
    const type = detectedImageType(bytes);
    if (!type)
      return error(
        415,
        "UNSUPPORTED_FILE",
        "Only JPEG, PNG, GIF and WebP images are supported.",
      );
    const filename = `${crypto.randomUUID()}.${imageTypes[type]}`;
    await Bun.write(join(config.uploadsPath, filename), bytes);
    return json(
      {
        media: {
          url: `/media/${filename}`,
          type: type === "image/gif" ? "gif" : "image",
          alt: upload.name.slice(0, 160) || "Imagem enviada",
        },
      },
      201,
    );
  }
  if (request.method === "GET" && url.pathname === "/gifs/search") {
    if (!config.tenorApiKey)
      return error(
        503,
        "GIF_PROVIDER_UNAVAILABLE",
        "GIF search is not configured.",
      );
    const query = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
    if (!query) return json({ results: [] });
    const endpoint = new URL("https://tenor.googleapis.com/v2/search");
    endpoint.search = new URLSearchParams({
      q: query,
      key: config.tenorApiKey,
      client_key: config.tenorClientKey,
      limit: "18",
      locale: "pt_BR",
      contentfilter: "medium",
      media_filter: "tinygif,gif",
    }).toString();
    const response = await fetch(endpoint);
    if (!response.ok)
      return error(
        502,
        "GIF_PROVIDER_ERROR",
        "The GIF provider could not complete the search.",
      );
    const payload = (await response.json()) as {
      results?: Array<{
        id: string;
        content_description?: string;
        media_formats?: { tinygif?: { url?: string }; gif?: { url?: string } };
      }>;
    };
    return json({
      results: (payload.results ?? []).flatMap((item) => {
        const url = item.media_formats?.gif?.url;
        const previewUrl = item.media_formats?.tinygif?.url ?? url;
        return url && previewUrl
          ? [
              {
                id: item.id,
                url,
                previewUrl,
                alt: item.content_description ?? "GIF do Tenor",
              },
            ]
          : [];
      }),
    });
  }
  if (request.method === "GET" && url.pathname === "/messages") {
    const channelId =
      url.searchParams.get("channelId") ||
      (await firstChannelForUser(user.id))?.id ||
      "";
    if (!(await channelForUser(user.id, channelId)))
      return error(403, "FORBIDDEN", "You cannot access this channel.");
    const parsed = Number(url.searchParams.get("limit") ?? 50);
    const limit = Number.isInteger(parsed)
      ? Math.min(Math.max(parsed, 1), config.maxHistoryLimit)
      : 50;
    const before = url.searchParams.get("before") ?? undefined;
    if (before && Number.isNaN(Date.parse(before)))
      return error(400, "INVALID_CURSOR", "before must be an ISO date.");
    return json({ messages: await messageHistory(channelId, limit, before) });
  }
  return error(404, "NOT_FOUND", "Route not found.");
}
