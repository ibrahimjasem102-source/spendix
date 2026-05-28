// Converts module entities → UnifiedLedgerEntry.
// Pure functions — no side effects.
import { Transaction, TransactionFormData } from "@/types";
import { Investment, Debt } from "@/lib/mock-data";
import { UnifiedLedgerEntry } from "./types";

// ── Transaction ───────────────────────────────────────────────
export function transactionToLedgerEntry(tx: Transaction): UnifiedLedgerEntry {
  return {
    id: `ledger-tx-${tx.id}`,
    user_id: tx.user_id,
    type: tx.type === "income" ? "income" : "transaction",
    title: tx.title,
    amount: Number(tx.amount),
    direction: tx.type === "income" ? "inflow" : "outflow",
    category: tx.category?.name,
    category_color: tx.category?.color,
    related_module_id: tx.id,
    date: tx.transaction_date,
    metadata: { notes: tx.notes ?? undefined, category_id: tx.category_id ?? undefined },
    created_at: tx.created_at || new Date().toISOString(),
  };
}

// Used when adding from the form (no full Transaction object yet)
export function formDataToLedgerEntry(data: TransactionFormData, id: string): UnifiedLedgerEntry {
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
    metadata: { notes: data.notes, category_id: data.category_id ?? undefined },
    created_at: new Date().toISOString(),
  };
}

// ── Investment ────────────────────────────────────────────────
export function investmentToLedgerEntry(inv: Investment): UnifiedLedgerEntry {
  return {
    id: `ledger-inv-${inv.id}`,
    user_id: "mock",
    type: "investment",
    title: inv.name,
    amount: inv.buyPrice * inv.quantity,
    direction: "outflow",
    category: inv.type,
    category_color: "#8B5CF6",
    related_module_id: inv.id,
    date: inv.date,
    metadata: {
      asset_type:    inv.type,
      quantity:      inv.quantity,
      buy_price:     inv.buyPrice,
      current_price: inv.currentPrice,
      risk:          inv.risk,
    },
    created_at: inv.date + "T00:00:00Z",
  };
}

// ── Debt ──────────────────────────────────────────────────────
export function debtToLedgerEntry(debt: Debt): UnifiedLedgerEntry {
  return {
    id: `ledger-debt-${debt.id}`,
    user_id: "mock",
    type: "debt",
    title: debt.creditor,
    amount: debt.amount,
    direction: "neutral",
    category: "Debt",
    category_color: "#F97316",
    related_module_id: debt.id,
    date: debt.dueDate.slice(0, 10),
    metadata: {
      interest_rate: debt.interestRate,
      status:        debt.status,
      paid:          debt.paid,
      notes:         debt.notes,
    },
    created_at: new Date().toISOString(),
  };
}

// Debt repayment event
export function debtRepaymentEntry(debt: Debt, repayAmount: number): UnifiedLedgerEntry {
  return {
    id: `ledger-repay-${debt.id}-${Date.now()}`,
    user_id: "mock",
    type: "repayment",
    title: `Repayment: ${debt.creditor}`,
    amount: repayAmount,
    direction: "outflow",
    category: "Debt",
    category_color: "#F97316",
    related_module_id: debt.id,
    date: new Date().toISOString().slice(0, 10),
    metadata: { creditor: debt.creditor },
    created_at: new Date().toISOString(),
  };
}

// ── Bulk seed ─────────────────────────────────────────────────
export function buildInitialLedger(
  transactions: Transaction[],
  investments: Investment[],
  debts: Debt[]
): UnifiedLedgerEntry[] {
  return [
    ...transactions.map(transactionToLedgerEntry),
    ...investments.map(investmentToLedgerEntry),
    ...debts.map(debtToLedgerEntry),
  ];
}
