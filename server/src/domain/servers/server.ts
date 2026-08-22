export type ServerSnapshot = {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  memberIds: readonly string[];
};

export type JoinDecision = { type: "joined" } | { type: "already-member" };

export class Server {
  private readonly memberIds: Set<string>;

  private constructor(private readonly snapshot: ServerSnapshot) {
    this.memberIds = new Set(snapshot.memberIds);
  }

  static restore(snapshot: ServerSnapshot): Server {
    return new Server(snapshot);
  }

  join(userId: string): JoinDecision {
    if (this.memberIds.has(userId)) return { type: "already-member" };

    this.memberIds.add(userId);
    return { type: "joined" };
  }

  view(): Omit<ServerSnapshot, "memberIds"> {
    const { memberIds: _memberIds, ...view } = this.snapshot;
    return view;
  }
}
