"use client";

// ── Auto-save form drafts to localStorage ─────────────────────
// Prevents data loss when user accidentally closes a form.

const PREFIX = "spendix_draft_";
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface Draft<T> {
  data: T;
  savedAt: number;
}

export function saveDraft<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    const draft: Draft<T> = { data, savedAt: Date.now() };
    localStorage.setItem(PREFIX + key, JSON.stringify(draft));
  } catch { /* quota exceeded - ignore */ }
}

export function loadDraft<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const draft = JSON.parse(raw) as Draft<T>;
    // Expire drafts older than TTL
    if (Date.now() - draft.savedAt > DRAFT_TTL_MS) {
      clearDraft(key);
      return null;
    }
    return draft.data;
  } catch {
    return null;
  }
}

export function clearDraft(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PREFIX + key);
}

export function hasDraft(key: string): boolean {
  return loadDraft(key) !== null;
}
