// ── Core entity ───────────────────────────────────────────────
export type LedgerEntryType =
  | "transaction"   // expense
  | "income"        // income transaction
  | "investment"    // capital deployed
  | "debt"          // liability recorded
  | "repayment"     // debt repaid
  | "budget_alert"  // budget limit event
  | "ai_insight";   // AI-generated event

export type LedgerDirection = "inflow" | "outflow" | "neutral";

export interface UnifiedLedgerEntry {
  id: string;
  user_id: string;
  type: LedgerEntryType;
  title: string;
  amount: number;
  direction: LedgerDirection;
  category?: string;
  category_color?: string;
  related_module_id?: string;
  date: string;             // ISO date  YYYY-MM-DD
  metadata?: Record<string, unknown>;
  created_at: string;       // ISO datetime
}

// ── Aggregates ────────────────────────────────────────────────
export interface CashflowSummary {
  totalInflow: number;
  totalOutflow: number;
  netBalance: number;
  byType: Partial<Record<LedgerEntryType, number>>;
}

export interface LedgerFilters {
  type?: LedgerEntryType | "all";
  direction?: LedgerDirection | "all";
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ── Display config ────────────────────────────────────────────
export const ENTRY_CONFIG: Record<
  LedgerEntryType,
  { label: string; color: string; bg: string; border: string }
> = {
  transaction:  { label: "Expense",      color: "text-rose-400",    bg: "bg-rose-400/10",    border: "border-rose-400/20"    },
  income:       { label: "Income",       color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20" },
  investment:   { label: "Investment",   color: "text-purple-400",  bg: "bg-purple-400/10",  border: "border-purple-400/20"  },
  debt:         { label: "Debt",         color: "text-orange-400",  bg: "bg-orange-400/10",  border: "border-orange-400/20"  },
  repayment:    { label: "Repayment",    color: "text-amber-400",   bg: "bg-amber-400/10",   border: "border-amber-400/20"   },
  budget_alert: { label: "Budget Alert", color: "text-yellow-400",  bg: "bg-yellow-400/10",  border: "border-yellow-400/20"  },
  ai_insight:   { label: "AI Insight",   color: "text-cyan-400",    bg: "bg-cyan-400/10",    border: "border-cyan-400/20"    },
};
