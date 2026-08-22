export type InviteSnapshot = {
  code: string;
  serverId: string;
  expiresAt: Date;
};

export class Invite {
  private constructor(private readonly snapshot: InviteSnapshot) {}

  static restore(snapshot: InviteSnapshot): Invite {
    return new Invite(snapshot);
  }

  isActiveAt(now: Date): boolean {
    return this.snapshot.expiresAt > now;
  }

  get serverId(): string {
    return this.snapshot.serverId;
  }
}
