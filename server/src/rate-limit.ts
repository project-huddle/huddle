type Bucket = { count: number; resetAt: number };

export class FixedWindowRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly limit: number,
    private readonly windowMs = 60_000,
  ) {}

  consume(key: string, now = Date.now()): boolean {
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      this.prune(now);
      return true;
    }
    bucket.count += 1;
    return bucket.count <= this.limit;
  }

  private prune(now: number): void {
    if (this.buckets.size < 10_000) return;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}

export function clientAddress(
  request: Request,
  server: Pick<Bun.Server<unknown>, "requestIP"> | null,
  trustProxy = false,
): string {
  if (trustProxy) {
    const forwardedFor = request.headers.get("x-forwarded-for");
    const forwardedAddress = forwardedFor?.split(",", 1)[0]?.trim();
    if (forwardedAddress) return forwardedAddress;
  }
  return server?.requestIP(request)?.address ?? "unknown";
}
