export async function readJson<T>(
  request: Request,
  fallback = {} as T
): Promise<T> {
  try {
    const value = await request.json();
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as T
      : fallback;
  } catch {
    return fallback;
  }
}

export function boundedInt(value: string | null, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function normalizeSearchQuery(value: string | null, maxLength = 80) {
  return (value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}
