export type CallParticipant = {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
};

export type DirectCall = {
  id: string;
  caller: CallParticipant;
  recipient: CallParticipant;
  status: "ringing" | "accepted";
  expiresAt: number;
};

export class DirectCallRegistry {
  private readonly calls = new Map<string, DirectCall>();

  invite(
    id: string,
    caller: CallParticipant,
    recipient: CallParticipant,
    now: number,
  ) {
    for (const call of this.calls.values()) {
      if (call.status === "ringing" && call.expiresAt <= now) continue;
      const occupied = [call.caller.id, call.recipient.id];
      if (occupied.includes(caller.id) || occupied.includes(recipient.id))
        return null;
    }
    const call: DirectCall = {
      id,
      caller,
      recipient,
      status: "ringing",
      expiresAt: now + 30_000,
    };
    this.calls.set(id, call);
    return call;
  }

  forParticipant(id: string, userId: string, now: number): DirectCall | null {
    const call = this.calls.get(id);
    if (!call) return null;
    if (call.caller.id !== userId && call.recipient.id !== userId) return null;
    if (call.status === "ringing" && call.expiresAt <= now) return null;
    return call;
  }

  accept(id: string, userId: string, now: number): DirectCall | null {
    const call = this.forParticipant(id, userId, now);
    if (!call || call.recipient.id !== userId || call.status !== "ringing")
      return null;
    call.status = "accepted";
    return call;
  }

  end(id: string, userId: string): DirectCall | null {
    const call = this.calls.get(id);
    if (!call || (call.caller.id !== userId && call.recipient.id !== userId))
      return null;
    this.calls.delete(id);
    return call;
  }

  expire(id: string, now: number): DirectCall | null {
    const call = this.calls.get(id);
    if (!call || call.status !== "ringing" || call.expiresAt > now) return null;
    this.calls.delete(id);
    return call;
  }
}
