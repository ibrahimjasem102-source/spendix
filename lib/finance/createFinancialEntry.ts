/**
 * Central finance service — single source of truth for all create operations.
 * Every financial action (transaction, investment, debt, debt payment) goes through here.
 * Handles API calls + dispatches update events so all pages refresh automatically.
 */

import {
  TransactionFormData,
  InvestmentFormData,
  DebtFormData,
  DebtPaymentFormData,
} from "@/types";
import { safeFetch as fetch } from "@/lib/fetch-safe";
import { emit } from "@/lib/events";

// Guest-mode helpers (imported lazily to avoid SSR issues)
let _guestStorage: typeof import("@/lib/guest/storage") | null = null;
async function guestStorage() {
  if (!_guestStorage) _guestStorage = await import("@/lib/guest/storage");
  return _guestStorage;
}

async function responseError(res: Response, fallback: string) {
  const err = await res.json().catch(() => ({}));
  return err.error ?? err.errorKey ?? fallback;
}

/* ── Transactions ────────────────────────────────────────────── */

export async function createTransaction(
  data: TransactionFormData,
  isGuest = false
): Promise<void> {
  if (isGuest) {
    const gs = await guestStorage();
    gs.addGuestTransaction(data);
  } else {
    const res = await fetch("/api/transactions", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(data),
    });
    if (!res.ok) {
      throw new Error(await responseError(res, "Transaction creation failed"));
    }
  }
  emit("spendix:transaction-added");
}

/* ── Investments ─────────────────────────────────────────────── */

export async function createInvestment(data: InvestmentFormData): Promise<void> {
  const res = await fetch("/api/investments", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(await responseError(res, "Investment creation failed"));
  }
  // API already creates the linked transaction — just broadcast
  emit("spendix:investment-changed");
  emit("spendix:transaction-added");
}

/* ── Debts ───────────────────────────────────────────────────── */

export async function createDebt(data: DebtFormData): Promise<void> {
  const res = await fetch("/api/debts", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(await responseError(res, "Debt creation failed"));
  }
  // API creates the linked transaction automatically
  emit("spendix:debt-changed");
  emit("spendix:transaction-added");
}

/* ── Debt payments ───────────────────────────────────────────── */

export async function createDebtPayment(
  debtId: string,
  data: DebtPaymentFormData
): Promise<{ newPaid: number; newStatus: string }> {
  const res = await fetch(`/api/debts/${debtId}/payments`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(await responseError(res, "Debt payment failed"));
  }
  const result = await res.json();
  emit("spendix:debt-changed");
  emit("spendix:transaction-added");
  return { newPaid: result.newPaid, newStatus: result.newStatus };
}

/* ── Convenience: update or delete (re-export pattern) ──────── */

export async function createDebtGroupPayment(
  debtIds: string[],
  data: DebtPaymentFormData
): Promise<{ transaction_id: string; allocations: unknown[] }> {
  const res = await fetch("/api/debts/payments", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ ...data, debt_ids: debtIds }),
  });
  if (!res.ok) {
    throw new Error(await responseError(res, "Debt payment failed"));
  }
  const result = await res.json();
  emit("spendix:debt-changed");
  emit("spendix:transaction-added");
  return result;
}

export function broadcastRefresh() {
  emit("spendix:transaction-added");
}
