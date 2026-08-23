import { validEmail } from "../../../validation";
import type {
  FriendUser,
  RequestFriendRepository,
} from "./request-friend.port";

export type RequestFriendResult =
  | { type: "success"; user: FriendUser }
  | { type: "invalid" }
  | { type: "not-found" }
  | { type: "exists" };

export async function requestFriend(
  repository: RequestFriendRepository,
  user: Pick<FriendUser, "id" | "email">,
  rawEmail: string,
): Promise<RequestFriendResult> {
  const email = rawEmail.trim().toLowerCase();
  if (!validEmail(email) || email === user.email) return { type: "invalid" };
  const target = await repository.findUserByEmail(email);
  if (!target) return { type: "not-found" };
  if (await repository.hasReverseRequest(user.id, target.id))
    return { type: "exists" };
  await repository.createRequest(user.id, target.id);
  return { type: "success", user: target };
}
