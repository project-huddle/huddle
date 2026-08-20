import { Prisma, PrismaClient } from "@prisma/client";

export const db = new PrismaClient();
export type User = { id: string; email: string; displayName: string; createdAt: string };
export type AuthUser = User & { passwordHash: string };
export type MessageMedia = { url: string; type: "image" | "gif"; alt: string };
export type ChatMessage = { id: string; content: string; createdAt: string; editedAt: string | null; deletedAt: string | null; replyToId: string | null; reactions: Record<string, number>; author: User; media: MessageMedia | null; channelId: string };
export type Server = { id: string; name: string; ownerId: string; createdAt: string };
export type Channel = { id: string; serverId: string; name: string; type: "text" };
export type ServerRole = "owner" | "moderator" | "member";
export type ServerMember = User & { joinedAt: string; role: ServerRole; isOwner: boolean };
export type ServerInvite = { code: string; serverId: string; expiresAt: string };
export type AccessibleMessage = ChatMessage & { userId: string };

const userSelect = { id: true, email: true, displayName: true, createdAt: true } satisfies Prisma.UserSelect;
const messageInclude = { author: { select: userSelect }, reactionEntries: { select: { emoji: true } } } satisfies Prisma.MessageInclude;
const userView = (user: { id: string; email: string; displayName: string; createdAt: Date }): User => ({ ...user, createdAt: user.createdAt.toISOString() });
const serverView = (server: { id: string; name: string; ownerId: string; createdAt: Date }): Server => ({ ...server, createdAt: server.createdAt.toISOString() });
const channelView = (channel: { id: string; serverId: string; name: string; type: string }): Channel => ({ id: channel.id, serverId: channel.serverId, name: channel.name, type: "text" });

function messageView(message: Prisma.MessageGetPayload<{ include: typeof messageInclude }>): ChatMessage {
  const deleted = Boolean(message.deletedAt);
  const legacy = message.legacyReactions && typeof message.legacyReactions === "object" && !Array.isArray(message.legacyReactions)
    ? message.legacyReactions as Record<string, unknown>
    : {};
  const reactions = Object.fromEntries(
    Object.entries(legacy).filter((entry): entry is [string, number] => Number.isSafeInteger(entry[1]) && Number(entry[1]) > 0),
  );
  message.reactionEntries.reduce<Record<string, number>>((counts, reaction) => {
    counts[reaction.emoji] = (counts[reaction.emoji] ?? 0) + 1;
    return counts;
  }, reactions);
  return { id: message.id, channelId: message.channelId, content: deleted ? "" : message.content, createdAt: message.createdAt.toISOString(), editedAt: message.editedAt?.toISOString() ?? null, deletedAt: message.deletedAt?.toISOString() ?? null, replyToId: message.replyToId, reactions, author: userView(message.author), media: !deleted && message.mediaUrl && (message.mediaType === "image" || message.mediaType === "gif") ? { url: message.mediaUrl, type: message.mediaType, alt: message.mediaAlt ?? "Imagem enviada" } : null };
}

export async function findUserByEmail(email: string): Promise<AuthUser | null> {
  const user = await db.user.findUnique({ where: { email }, select: { ...userSelect, passwordHash: true } });
  return user ? { ...userView(user), passwordHash: user.passwordHash } : null;
}
export async function createUser(email: string, displayName: string, passwordHash: string): Promise<User | null> {
  try {
    const created = await db.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email, displayName, passwordHash }, select: userSelect });
      await tx.server.create({
        data: {
          name: "Minha comunidade",
          ownerId: user.id,
          members: { create: { userId: user.id, role: "owner" } },
          channels: { create: { name: "geral" } },
        },
      });
      return user;
    });
    return userView(created);
  } catch (cause) {
    if (cause instanceof Prisma.PrismaClientKnownRequestError && cause.code === "P2002") return null;
    throw cause;
  }
}
export async function createSession(userId: string, tokenHash: string, expiresAt: number): Promise<void> { await db.$transaction([db.session.deleteMany({ where: { expiresAt: { lte: new Date() } } }), db.session.create({ data: { tokenHash, userId, expiresAt: new Date(expiresAt) } })]); }
export async function userForSession(tokenHash: string): Promise<User | null> { const session = await db.session.findFirst({ where: { tokenHash, expiresAt: { gt: new Date() } }, select: { user: { select: userSelect } } }); return session ? userView(session.user) : null; }
export async function deleteSession(tokenHash: string): Promise<void> { await db.session.deleteMany({ where: { tokenHash } }); }

export async function createServer(user: User, name: string): Promise<{ server: Server; channel: Channel }> { const result = await db.server.create({ data: { name, ownerId: user.id, members: { create: { userId: user.id, role: "owner" } }, channels: { create: { name: "geral" } } }, include: { channels: true } }); return { server: serverView(result), channel: channelView(result.channels[0]!) }; }
export async function listServers(userId: string): Promise<Server[]> { return (await db.server.findMany({ where: { members: { some: { userId } } }, orderBy: { createdAt: "asc" } })).map(serverView); }
export async function listChannels(userId: string, serverId: string): Promise<Channel[]> { return (await db.channel.findMany({ where: { serverId, server: { members: { some: { userId } } } }, orderBy: { createdAt: "asc" } })).map(channelView); }
export async function isServerMember(userId: string, serverId: string): Promise<boolean> { return Boolean(await db.serverMember.findUnique({ where: { serverId_userId: { serverId, userId } }, select: { userId: true } })); }
export async function serverForUser(userId: string, serverId: string): Promise<Server | null> { const server = await db.server.findFirst({ where: { id: serverId, members: { some: { userId } } } }); return server ? serverView(server) : null; }
export async function serverMembers(userId: string, serverId: string): Promise<ServerMember[] | null> {
  if (!(await isServerMember(userId, serverId))) return null;
  const rows = await db.serverMember.findMany({ where: { serverId }, include: { user: { select: userSelect }, server: { select: { ownerId: true } } } });
  const priority: Record<ServerRole, number> = { owner: 0, moderator: 1, member: 2 };
  return rows.map((row) => ({ ...userView(row.user), joinedAt: row.createdAt.toISOString(), role: row.role as ServerRole, isOwner: row.userId === row.server.ownerId })).sort((a, b) => priority[a.role] - priority[b.role] || a.displayName.localeCompare(b.displayName));
}
export async function roleForUser(userId: string, serverId: string): Promise<ServerRole | null> { const row = await db.serverMember.findUnique({ where: { serverId_userId: { serverId, userId } }, select: { role: true } }); return row ? row.role as ServerRole : null; }
export async function canManageServer(userId: string, serverId: string): Promise<boolean> { return ["owner", "moderator"].includes(await roleForUser(userId, serverId) ?? ""); }
export async function setMemberRole(actorId: string, serverId: string, memberId: string, role: "moderator" | "member"): Promise<"ok" | "forbidden" | "missing"> { const server = await serverForUser(actorId, serverId); if (!server || server.ownerId !== actorId) return server ? "forbidden" : "missing"; if (!(await isServerMember(memberId, serverId)) || memberId === server.ownerId) return "missing"; await db.serverMember.update({ where: { serverId_userId: { serverId, userId: memberId } }, data: { role } }); return "ok"; }
export async function removeMember(actorId: string, serverId: string, memberId: string): Promise<"ok" | "forbidden" | "missing"> { const server = await serverForUser(actorId, serverId); if (!server || server.ownerId !== actorId) return server ? "forbidden" : "missing"; if (!(await isServerMember(memberId, serverId)) || memberId === server.ownerId) return "missing"; await db.serverMember.delete({ where: { serverId_userId: { serverId, userId: memberId } } }); return "ok"; }
export async function createInvite(userId: string, serverId: string): Promise<ServerInvite | null> { if (!(await serverForUser(userId, serverId)) || !(await canManageServer(userId, serverId))) return null; const invite = await db.invite.create({ data: { code: crypto.randomUUID().replaceAll("-", "").slice(0, 10), serverId, createdBy: userId, expiresAt: new Date(Date.now() + 7 * 86_400_000) } }); return { code: invite.code, serverId, expiresAt: invite.expiresAt.toISOString() }; }
export async function joinServer(userId: string, code: string): Promise<Server | null> { const invite = await db.invite.findFirst({ where: { code, expiresAt: { gt: new Date() } }, include: { server: true } }); if (!invite) return null; await db.serverMember.upsert({ where: { serverId_userId: { serverId: invite.serverId, userId } }, create: { serverId: invite.serverId, userId }, update: {} }); return serverView(invite.server); }
export async function leaveServer(userId: string, serverId: string): Promise<"left" | "owner" | "missing"> { const server = await serverForUser(userId, serverId); if (!server) return "missing"; if (server.ownerId === userId) return "owner"; await db.serverMember.delete({ where: { serverId_userId: { serverId, userId } } }); return "left"; }
export async function createChannel(userId: string, serverId: string, name: string): Promise<Channel | null> { if (!(await canManageServer(userId, serverId))) return null; return channelView(await db.channel.create({ data: { serverId, name } })); }
export async function channelForUser(userId: string, channelId: string): Promise<Channel | null> { const channel = await db.channel.findFirst({ where: { id: channelId, server: { members: { some: { userId } } } } }); return channel ? channelView(channel) : null; }
export async function firstChannelForUser(userId: string): Promise<Channel | null> { const channel = await db.channel.findFirst({ where: { server: { members: { some: { userId } } } }, orderBy: { createdAt: "asc" } }); return channel ? channelView(channel) : null; }

export async function saveMessage(user: User, channelId: string, content: string, media: MessageMedia | null = null, replyToId: string | null = null): Promise<ChatMessage> { return messageView(await db.message.create({ data: { userId: user.id, channelId, content, replyToId, mediaUrl: media?.url, mediaType: media?.type, mediaAlt: media?.alt }, include: messageInclude })); }
export async function messageHistory(channelId: string, limit: number, before?: string): Promise<ChatMessage[]> { const rows = await db.message.findMany({ where: { channelId, ...(before ? { createdAt: { lt: new Date(before) } } : {}) }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit, include: messageInclude }); return rows.reverse().map(messageView); }
export async function messageForUser(userId: string, messageId: string): Promise<AccessibleMessage | null> { const row = await db.message.findFirst({ where: { id: messageId, channel: { server: { members: { some: { userId } } } } }, include: messageInclude }); return row ? { ...messageView(row), userId: row.userId } : null; }
export async function editMessage(userId: string, messageId: string, content: string): Promise<ChatMessage | null> { const row = await messageForUser(userId, messageId); if (!row || row.userId !== userId || row.deletedAt) return null; return messageView(await db.message.update({ where: { id: messageId }, data: { content, editedAt: new Date() }, include: messageInclude })); }
export async function deleteMessage(userId: string, messageId: string): Promise<ChatMessage | null> { const row = await messageForUser(userId, messageId); if (!row || row.userId !== userId || row.deletedAt) return null; return messageView(await db.message.update({ where: { id: messageId }, data: { content: "", mediaUrl: null, mediaType: null, mediaAlt: null, deletedAt: new Date() }, include: messageInclude })); }
export async function reactMessage(userId: string, messageId: string, emoji: string): Promise<ChatMessage | null> {
  if (!/\p{Extended_Pictographic}/u.test(emoji) || emoji.length > 8) return null;
  return db.$transaction(async (tx) => {
    const message = await tx.message.findFirst({ where: { id: messageId, deletedAt: null, channel: { server: { members: { some: { userId } } } } }, select: { id: true } });
    if (!message) return null;
    const key = { messageId_userId_emoji: { messageId, userId, emoji } };
    const existing = await tx.messageReaction.findUnique({ where: key, select: { messageId: true } });
    if (existing) await tx.messageReaction.delete({ where: key });
    else await tx.messageReaction.create({ data: { messageId, userId, emoji } });
    return messageView(await tx.message.findUniqueOrThrow({ where: { id: messageId }, include: messageInclude }));
  });
}
