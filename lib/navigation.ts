/**
 * Navigation utilities — last-page memory, prefetch hints, etc.
 * All localStorage access is guarded against SSR.
 */

const LAST_PAGE_KEY = "spendix_last_page";

export function saveLastPage(path: string): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(LAST_PAGE_KEY, path); } catch {}
}

export function getLastPage(fallback = "/dashboard"): string {
  if (typeof window === "undefined") return fallback;
  try { return localStorage.getItem(LAST_PAGE_KEY) || fallback; } catch { return fallback; }
}

/** Build a human-readable page title from a pathname. */
export function pageTitleFromPath(pathname: string): string {
  const segment = pathname.split("/").filter(Boolean).pop() ?? "dashboard";
  return segment
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
