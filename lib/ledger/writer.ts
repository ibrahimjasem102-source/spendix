import "server-only";

// Server-side ledger writer — call after every financial operation succeeds.
// All writes are best-effort: a ledger failure must never break the caller.
// The source tables (transactions, debts, investments, …) remain the primary
// record; ledger_entries is the unified audit log and analytics layer.

type SupabaseLike = { from: (table: string) => any };

export type LedgerEntryInput = {
  user_id: string;
  /** Module that originated this entry: 'transaction' | 'investment' | 'debt_payment' | 'work_payment' | 'goal_contribution' | 'subscription_payment' | 'bill_payment' | 'transfer' */
  source_module: string;
  /** PK of the originating module record */
  source_id: string;
  /** Semantic type stored in the DB */
  entry_type:
    | "income"
    | "expense"
    | "investment"
    | "debt_payment"
    | "work_payment"
    | "goal_contribution"
    | "subscription_payment"
    | "bill_payment"
    | "transfer";
  direction: "inflow" | "outflow" | "neutral";
  amount: number;
  description: string;
  /** Linked transaction (if one was created alongside) */
  transaction_id?: string | null;
  account_id?: string | null;
  category_id?: string | null;
  contact_id?: string | null;
};

export async function writeLedgerEntry(
  db: SupabaseLike,
  entry: LedgerEntryInput,
): Promise<void> {
  const { error } = await db.from("ledger_entries").insert({
    user_id:       entry.user_id,
    source_module: entry.source_module,
    source_id:     entry.source_id,
    entry_type:    entry.entry_type,
    direction:     entry.direction,
    amount:        entry.amount,
    description:   entry.description,
    transaction_id: entry.transaction_id  ?? null,
    account_id:    entry.account_id      ?? null,
    category_id:   entry.category_id     ?? null,
    contact_id:    entry.contact_id      ?? null,
    account:       "",  // legacy column — kept for schema compatibility
  });

  if (error) {
    console.warn("[ledger/writer] write failed:", error.message);
  }
}
