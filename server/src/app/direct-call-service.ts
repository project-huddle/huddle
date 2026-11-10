import {
  DirectCallRegistry,
  type CallParticipant,
} from "@/core/direct-calls/direct-call-registry";
import { areFriends, listFriendships } from "./social-service";

export const directCalls = new DirectCallRegistry();

export async function inviteDirectCall(
  caller: CallParticipant,
  recipientId: string,
  id: string,
  now: number,
) {
  const friendships = await listFriendships(caller.id);
  const friendship = friendships.find(
    (item) => item.user.id === recipientId && item.status === "accepted",
  );
  if (!friendship) return { type: "not-friends" } as const;
  const call = directCalls.invite(id, caller, friendship.user, now);
  if (!call) return { type: "busy" } as const;
  return { type: "success", call } as const;
}

export async function authorizedDirectCall(callId: string, userId: string) {
  const call = directCalls.forParticipant(callId, userId, Date.now());
  if (!call || call.status !== "accepted") return null;
  if (!(await areFriends(call.caller.id, call.recipient.id))) return null;
  return call;
}

export async function acceptDirectCall(callId: string, userId: string) {
  const call = directCalls.forParticipant(callId, userId, Date.now());
  if (!call || !(await areFriends(call.caller.id, call.recipient.id)))
    return null;
  return directCalls.accept(callId, userId, Date.now());
}
