// Converts module entities → UnifiedLedgerEntry.
// Pure functions — no side effects.
import { Transaction, TransactionFormData } from "@/types";
import { UnifiedLedgerEntry } from "./types";

function isCalendarLinked(relatedId?: string | null) {
  return typeof relatedId === "string" && relatedId.startsWith("calendar:");
}

// ── Transaction ───────────────────────────────────────────────
export function transactionToLedgerEntry(tx: Transaction): UnifiedLedgerEntry {
  const fromCalendar = isCalendarLinked(tx.related_source_id);
  const isTransfer   = tx.source === "transfer";

  // Transfers are neutral — they move money between accounts but don't change
  // total income or expense. They appear in the ledger for audit purposes only.
  return {
    id: `ledger-tx-${tx.id}`,
    user_id: tx.user_id,
    type: isTransfer ? "transfer" : (tx.type === "income" ? "income" : "transaction"),
    title: tx.title,
    amount: Number(tx.amount),
    direction: isTransfer ? "neutral" : (tx.type === "income" ? "inflow" : "outflow"),
    category: tx.category?.name,
    category_color: tx.category?.color,
    related_module_id: tx.id,
    date: tx.transaction_date ?? new Date().toISOString().slice(0, 10),
    tags: fromCalendar ? ["calendar"] : undefined,
    metadata: {
      notes: tx.notes ?? undefined,
      category_id: tx.category_id ?? undefined,
      source: tx.source ?? "manual",
      related_source_id: tx.related_source_id ?? undefined,
      source_module: fromCalendar ? "calendar" : undefined,
    },
    created_at: tx.created_at || new Date().toISOString(),
  };
}

// Used when adding from the form (no full Transaction object yet)
export function formDataToLedgerEntry(data: TransactionFormData, id: string): UnifiedLedgerEntry {
  const fromCalendar = isCalendarLinked(data.related_source_id);
  return {
    id: `ledger-tx-${id}`,
    user_id: "current",
    type: data.type === "income" ? "income" : "transaction",
    title: data.title,
    amount: data.amount,
    direction: data.type === "income" ? "inflow" : "outflow",
    category_color: data.type === "income" ? "#10B981" : "#ef4444",
    related_module_id: id,
    date: data.transaction_date,
    tags: fromCalendar ? ["calendar"] : undefined,
    metadata: {
      notes: data.notes,
      category_id: data.category_id ?? undefined,
      source: data.source ?? "manual",
      related_source_id: data.related_source_id ?? undefined,
      source_module: fromCalendar ? "calendar" : undefined,
    },
    created_at: new Date().toISOString(),
  };
}
