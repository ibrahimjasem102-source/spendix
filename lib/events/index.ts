import type { UnifiedLedgerEntry } from "@/lib/ledger/types";

export type SpendixEventMap = {
  "spendix:transaction-added":   undefined;
  "spendix:transaction-deleted": undefined;
  "spendix:debt-changed":        undefined;
  "spendix:investment-changed":  undefined;
  "spendix:work-changed":        undefined;
  "spendix:ledger-entry-added":  UnifiedLedgerEntry;
  "spendix:goal-added":          undefined;
};

export type SpendixEventName = keyof SpendixEventMap;

export function emit<K extends SpendixEventName>(
  name: K,
  detail?: SpendixEventMap[K],
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(name, detail !== undefined ? { detail } : undefined),
  );
}

export function on<K extends SpendixEventName>(
  name: K,
  handler: (detail: SpendixEventMap[K]) => void,
): () => void {
  const fn = (e: Event) =>
    handler((e as CustomEvent<SpendixEventMap[K]>).detail);
  window.addEventListener(name, fn);
  return () => window.removeEventListener(name, fn);
}
