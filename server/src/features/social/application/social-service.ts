import { isValidUsername, normalizeUsername } from "@/core/identity/username";
import type { User } from "@/features/auth/types/user";
import { validEmail } from "../../auth/application/email-validation";
import {
  acceptFriendship,
  areFriendAccounts,
  createFriendshipRequest,
  deleteFriendships,
  findSocialUser,
  hasFriendshipRequest,
  listFriendshipRows,
  type SocialUser,
} from "../infrastructure/social-repository";

export async function listFriendships(userId: string) {
  const rows = await listFriendshipRows(userId);
  return rows.map((row) => {
    const isOutgoing = row.requesterId === userId;
    return {
      status: row.status,
      direction: isOutgoing ? "outgoing" : "incoming",
      user: isOutgoing ? row.addressee : row.requester,
    };
  });
}

export type RequestFriendResult =
  | { type: "success"; user: SocialUser }
  | { type: "invalid" }
  | { type: "not-found" }
  | { type: "exists" };

export async function requestFriend(
  user: User,
  rawIdentifier: string,
): Promise<RequestFriendResult> {
  const value = rawIdentifier.trim();
  const friendId = extractFriendId(value);
  if (friendId === user.id) return { type: "invalid" };
  const username = normalizeUsername(value);
  const email = value.toLowerCase();
  const isEmail = validEmail(email);
  if (!friendId && !isEmail && !isValidUsername(username))
    return { type: "invalid" };

  let identifier: { id?: string; email?: string; username?: string };
  if (friendId) {
    identifier = { id: friendId };
  } else if (isEmail) {
    identifier = { email };
  } else {
    identifier = { username };
  }
  const target = await findSocialUser(identifier);
  if (target?.id === user.id) return { type: "invalid" };
  if (!target) return { type: "not-found" };

  if (await hasFriendshipRequest(target.id, user.id))
    return { type: "exists" };
  await createFriendshipRequest(user.id, target.id);
  return { type: "success", user: target };
}

function extractFriendId(value: string): string | null {
  const uuid =
    /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
  if (uuid.test(value)) return value;
  try {
    const candidate = new URL(value).searchParams.get("friend");
    return candidate && uuid.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

export async function acceptFriend(
  userId: string,
  requesterId: string,
): Promise<boolean> {
  return acceptFriendship(userId, requesterId);
}

export async function deleteFriendship(
  userId: string,
  peerId: string,
): Promise<void> {
  await deleteFriendships(userId, peerId);
}

export async function areFriends(
  userId: string,
  peerId: string,
): Promise<boolean> {
  return areFriendAccounts(userId, peerId);
}
