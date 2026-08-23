import type { ListMembersRepository } from "./list-members.port";

export type ListMembersResult =
  | {
      type: "success";
      members: NonNullable<
        Awaited<ReturnType<ListMembersRepository["listMembers"]>>
      >;
    }
  | { type: "forbidden" };

export async function listMembers(
  repository: ListMembersRepository,
  userId: string,
  serverId: string,
): Promise<ListMembersResult> {
  const members = await repository.listMembers(userId, serverId);
  return members ? { type: "success", members } : { type: "forbidden" };
}
