import type { CreateInviteRepository } from "./create-invite.port";

export type CreateInviteResult =
  | {
      type: "success";
      invite: NonNullable<
        Awaited<ReturnType<CreateInviteRepository["createInvite"]>>
      >;
    }
  | { type: "forbidden" };

export async function createInvite(
  repository: CreateInviteRepository,
  userId: string,
  serverId: string,
): Promise<CreateInviteResult> {
  const invite = await repository.createInvite(userId, serverId);
  return invite ? { type: "success", invite } : { type: "forbidden" };
}
