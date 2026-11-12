export function normalizeUsername(value: string): string {
  return value.trim().replace(/^@/, "").toLowerCase();
}

export function isValidUsername(value: string): boolean {
  return /^[a-z0-9_]{3,40}$/.test(value);
}
