"use client";

import { useMemo } from "react";
import { useTransactions, useDebts, useInvestments, useWorkPayments, useWorkSessions, useSubscriptions, useGoals } from "@/lib/query/hooks";
import { useGuest } from "@/contexts/GuestContext";
import { transactionToLedgerEntry } from "@/lib/ledger/sync";
import {
  calculateBalance,
  getIncome,
  getExpenses,
  sortByDate,
} from "@/lib/ledger/engine";
import type { UnifiedLedgerEntry } from "@/lib/ledger/types";
import type { Investment, Debt, Goal, Subscription, Transaction, WorkSession, WorkPayment } from "@/types";

// ── Real-type converters ───────────────────────────────────────

function investmentToEntry(inv: Investment): UnifiedLedgerEntry {
  return {
    id:               `ledger-inv-${inv.id}`,
    user_id:          inv.user_id,
    type:             "investment",
    title:            inv.asset_name,
    amount:           Number(inv.amount_invested),
    direction:        "outflow",
    category:         inv.asset_type,
    related_module_id: inv.id,
    date:             inv.investment_date,
    metadata: {
      asset_type:    inv.asset_type,
      current_value: Number(inv.current_value),
      notes:         inv.notes,
    },
    created_at: inv.created_at,
  };
}

function debtToEntry(debt: Debt): UnifiedLedgerEntry {
  // payable   = you borrowed money  → cash INFLOW  (you received it)
  // receivable = you gave a loan    → cash OUTFLOW (you paid it out)
  // When fully repaid the net = 0:
  //   payable: +total (debt) + Σ -payment (expense txs)  = 0
  //   receivable: -total (debt) + Σ +receipt (income txs) = 0
  const direction: "inflow" | "outflow" =
    debt.debt_type === "payable" ? "inflow" : "outflow";

  return {
    id:               `ledger-debt-${debt.id}`,
    user_id:          debt.user_id,
    type:             "debt",
    title:            debt.person_or_entity,
    amount:           Number(debt.total_amount),
    direction,
    category:         debt.debt_type === "payable" ? "Payable" : "Receivable",
    related_module_id: debt.id,
    date:             (debt.created_at ?? new Date().toISOString()).slice(0, 10),
    metadata: {
      debt_type:   debt.debt_type,
      paid_amount: Number(debt.paid_amount),
      status:      debt.status,
      notes:       debt.notes,
    },
    created_at: debt.created_at,
  };
}


function subscriptionToEntry(sub: Subscription): UnifiedLedgerEntry {
  return {
    id:               `ledger-sub-${sub.id}`,
    user_id:          sub.user_id,
    type:             "subscription",
    title:            sub.name,
    amount:           Number(sub.amount),
    direction:        "outflow",
    category:         "Subscription",
    category_color:   sub.color ?? "#8B5CF6",
    related_module_id: sub.id,
    date:             sub.next_billing_date ?? sub.created_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    metadata: {
      billing_cycle: sub.billing_cycle,
      status:        sub.status,
      notes:         sub.notes,
    },
    created_at: sub.created_at ?? new Date().toISOString(),
  };
}

// ── Work session ─────────────────────────────────────────────
// Only add pending/overdue sessions — paid ones already appear
// in the ledger via their linked income transaction (source="work_payment").

const _today = new Date().toISOString().slice(0, 10);

function resolveSessionStatus(
  session: WorkSession,
  payments: WorkPayment[],
): "pending" | "paid" | "overdue" {
  const paid = payments
    .filter((p) => p.work_session_id === session.id)
    .reduce((a, p) => a + Number(p.amount), 0);
  const expected = Number(session.expected_amount);
  if (expected > 0 && paid >= expected) return "paid";
  if (session.due_date && session.due_date < _today) return "overdue";
  return "pending";
}

function workSessionToEntry(session: WorkSession, status: "pending" | "overdue"): UnifiedLedgerEntry {
  return {
    id:               `ledger-session-${session.id}`,
    user_id:          session.user_id,
    type:             "salary",
    title:            session.title,
    amount:           Number(session.expected_amount),
    direction:        "neutral",        // expected / owed — not yet received
    category:         session.employer_or_client,
    related_module_id: session.id,
    date:             session.work_date,
    metadata: {
      hours:       session.hours_worked,
      hourly_rate: session.hourly_rate,
      employer:    session.employer_or_client,
      status,
      due_date:    session.due_date,
    },
    created_at: session.created_at,
  };
}

function goalToEntry(goal: Goal): UnifiedLedgerEntry {
  const progress = goal.target_amount > 0
    ? Math.min(100, Math.round(((goal.computed_saved ?? goal.saved_amount) / goal.target_amount) * 100))
    : 0;
  return {
    id:               `ledger-goal-${goal.id}`,
    user_id:          goal.user_id,
    type:             "goal",
    title:            goal.title,
    amount:           Number(goal.target_amount),
    direction:        "neutral",
    category:         goal.category,
    related_module_id: goal.id,
    date:             goal.due_date ?? goal.created_at.slice(0, 10),
    metadata: {
      progress,
      saved:     goal.computed_saved ?? goal.saved_amount,
      status:    goal.status,
      due_date:  goal.due_date,
      notes:     goal.notes,
    },
    created_at: goal.created_at,
  };
}

// ── Public snapshot type ───────────────────────────────────────

export interface FinancialSnapshot {
  /** Net cash position from all income/expense transactions */
  balance: number;
  /** All-time total income */
  income: number;
  /** All-time total expenses */
  expenses: number;
  /** All-time savings rate % */
  savingsRate: number;

  /** Income in the current calendar month */
  monthlyIncome: number;
  /** Expenses in the current calendar month */
  monthlyExpenses: number;
  /** Savings rate for the current calendar month */
  monthlySavingsRate: number;

  /** Sum of amount_invested across all investments */
  investedTotal: number;
  /** Sum of current_value (fallback: amount_invested) */
  portfolioValue: number;
  /** portfolioValue − investedTotal */
  portfolioGain: number;
  /** portfolioGain / investedTotal × 100 */
  portfolioGainPct: number;

  /** Remaining balance on debts I owe */
  debtPayable: number;
  /** Remaining balance on debts owed to me */
  debtReceivable: number;
  /** debtPayable − debtReceivable (positive = net liability) */
  netDebt: number;
  /** Number of overdue debts */
  overdueDebtsCount: number;
  /** paid_amount / total_amount across all payable debts */
  debtRecoveryRate: number;

  /** Total received from work payments */
  workIncome: number;

  /** All financial events as a unified, date-sorted ledger */
  ledgerEntries: UnifiedLedgerEntry[];

  /** Raw arrays — single source of truth for all pages */
  transactions: Transaction[];
  debts: Debt[];
  investments: Investment[];
  goals: Goal[];
  /** Work sessions with computed status (for ledger + analytics) */
  workSessions: WorkSession[];

  isLoading: boolean;
  isError:   boolean;
}

// ── Hook ───────────────────────────────────────────────────────

export function useFinancialEngine(): FinancialSnapshot {
  const { isGuest, isLoading: authLoading } = useGuest();
  // Enable all queries only when auth has resolved and user is authenticated.
  // React Query automatically starts fetching when enabled flips true → false.
  const ready = !authLoading;
  const authenticated = !isGuest && ready;

  const { data: transactions = [], isLoading: txLoading, isError: txError } =
    useTransactions(ready);

  // useDebts handles guest vs authenticated internally — pass ready so guest debts
  // are included in balance calculations too (lending money should reduce balance)
  const { data: debtsResult, isLoading: debtLoading, isError: debtError } =
    useDebts(ready);

  const { data: investments = [], isLoading: invLoading, isError: invError } =
    useInvestments(authenticated);

  const { data: workPayments = [], isLoading: workLoading, isError: workError } =
    useWorkPayments(authenticated);

  const { data: rawWorkSessions = [] } = useWorkSessions(authenticated);

  const { data: subscriptions = [] } = useSubscriptions(authenticated);
  const { data: goals        = [] } = useGoals(ready);

  const debts       = debtsResult?.debts   ?? [];
  const debtSummary = debtsResult?.summary;

  // Enrich work sessions with computed status (needs payments)
  const workSessions: WorkSession[] = useMemo(
    () => rawWorkSessions.map((s) => ({
      ...s,
      status:      resolveSessionStatus(s, workPayments),
      paid_amount: workPayments
        .filter((p) => p.work_session_id === s.id)
        .reduce((a, p) => a + Number(p.amount), 0),
    })),
    [rawWorkSessions, workPayments],
  );

  // ── Ledger ───────────────────────────────────────────────────
  const ledgerEntries = useMemo(
    () =>
      sortByDate([
        // Core transactions (income + expense)
        ...transactions.map(transactionToLedgerEntry),

        // Investments deployed
        ...investments.map(investmentToEntry),

        // Debts recorded (neutral — no cash movement)
        ...debts.map(debtToEntry),

        // Subscriptions active = upcoming recurring charges (neutral — payment not yet taken)
        ...subscriptions.filter((s) => s.status === "active").map(subscriptionToEntry),

        // Work sessions pending/overdue = expected salary not yet received (neutral)
        // Paid sessions are already captured via their linked income transaction
        ...workSessions
          .filter((s) => s.status === "pending" || s.status === "overdue")
          .map((s) => workSessionToEntry(s, s.status as "pending" | "overdue")),

        // Goals — active (not completed) as neutral planning entries
        ...goals
          .filter((g) => g.status !== "completed")
          .map(goalToEntry),
      ]),
    [transactions, investments, debts, subscriptions, workSessions, goals],
  );

  // ── Cash position ────────────────────────────────────────────
  // Debts are now included because they represent real cash movements:
  //   payable   (borrowed)  → inflow  (+balance when recorded)
  //   receivable (gave loan) → outflow (-balance when recorded)
  // Repayments/receipts are captured via expense/income transactions,
  // so the net effect cancels to 0 when a debt is fully settled.
  const cashEntries = useMemo(
    () => ledgerEntries.filter(
      (e) => e.type === "transaction" || e.type === "income"
          || e.type === "salary"       || e.type === "debt"
    ),
    [ledgerEntries]
  );

  const balance  = useMemo(() => calculateBalance(cashEntries), [cashEntries]);
  const income   = useMemo(() => getIncome(cashEntries),        [cashEntries]);
  const expenses = useMemo(() => getExpenses(cashEntries),      [cashEntries]);
  const savingsRate = income > 0
    ? Math.max(0, Math.round(((income - expenses) / income) * 100))
    : 0;

  // ── Investments ──────────────────────────────────────────────
  const investedTotal = useMemo(
    () => investments.reduce((s, i) => s + Number(i.amount_invested), 0),
    [investments]
  );
  const portfolioValue = useMemo(
    () => investments.reduce((s, i) => s + Number(i.current_value ?? i.amount_invested), 0),
    [investments]
  );
  const portfolioGain    = portfolioValue - investedTotal;
  const portfolioGainPct = investedTotal > 0 ? (portfolioGain / investedTotal) * 100 : 0;

  // ── Debts ────────────────────────────────────────────────────
  const debtPayable = debtSummary?.totalPayable
    ?? debts.filter((d) => d.debt_type === "payable")
            .reduce((s, d) => s + (Number(d.total_amount) - Number(d.paid_amount)), 0);

  const debtReceivable = debtSummary?.totalReceivable
    ?? debts.filter((d) => d.debt_type === "receivable")
            .reduce((s, d) => s + (Number(d.total_amount) - Number(d.paid_amount)), 0);

  const netDebt          = debtPayable - debtReceivable;
  const overdueDebtsCount = debtSummary?.overdueCount ?? 0;
  const debtRecoveryRate  = useMemo(() => {
    const payable = debts.filter((d) => d.debt_type === "payable");
    const total   = payable.reduce((s, d) => s + Number(d.total_amount), 0);
    const paid    = payable.reduce((s, d) => s + Number(d.paid_amount),  0);
    return total > 0 ? (paid / total) * 100 : 0;
  }, [debts]);

  // ── Monthly slice (current calendar month) ───────────────────
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const monthlyEntries = useMemo(
    () => cashEntries.filter((e) => e.date?.startsWith(currentMonth)),
    [cashEntries, currentMonth]
  );
  const monthlyIncome   = useMemo(() => getIncome(monthlyEntries),   [monthlyEntries]);
  const monthlyExpenses = useMemo(() => getExpenses(monthlyEntries), [monthlyEntries]);
  const monthlySavingsRate = monthlyIncome > 0
    ? Math.max(0, Math.round(((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100))
    : 0;

  // ── Work income ──────────────────────────────────────────────
  const workIncome = useMemo(
    () => workPayments.reduce((s, p) => s + Number(p.amount), 0),
    [workPayments]
  );

  return {
    balance,
    income,
    expenses,
    savingsRate,
    monthlyIncome,
    monthlyExpenses,
    monthlySavingsRate,
    investedTotal,
    portfolioValue,
    portfolioGain,
    portfolioGainPct,
    debtPayable,
    debtReceivable,
    netDebt,
    overdueDebtsCount,
    debtRecoveryRate,
    workIncome,
    ledgerEntries,
    transactions,
    debts,
    investments,
    goals,
    workSessions,
    isLoading: authLoading || txLoading || (!isGuest && (debtLoading || invLoading || workLoading)),
    isError:   txError   || (!isGuest && (debtError || invError || workError)),
  };
}

// ── Derived hooks — thin wrappers, same cache ──────────────────

export function useBalance() {
  const { balance, isLoading, isError } = useFinancialEngine();
  return { balance, isLoading, isError };
}

export function useNetWorth() {
  const { balance, portfolioValue, debtReceivable, debtPayable, isLoading, isError } =
    useFinancialEngine();
  return {
    netWorth: balance + portfolioValue + debtReceivable - debtPayable,
    isLoading,
    isError,
  };
}

export function useLedger() {
  const { ledgerEntries, isLoading, isError } = useFinancialEngine();
  return { ledgerEntries, isLoading, isError };
}
