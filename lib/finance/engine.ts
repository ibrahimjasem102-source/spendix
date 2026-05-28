"use client";

import { useMemo } from "react";
import { useTransactions, useDebts, useInvestments, useWorkPayments } from "@/lib/query/hooks";
import { useGuest } from "@/contexts/GuestContext";
import { transactionToLedgerEntry } from "@/lib/ledger/sync";
import {
  calculateBalance,
  getIncome,
  getExpenses,
  sortByDate,
} from "@/lib/ledger/engine";
import type { UnifiedLedgerEntry } from "@/lib/ledger/types";
import type { Investment, Debt, WorkPayment } from "@/types";

// ── Real-type converters ───────────────────────────────────────

function investmentToEntry(inv: Investment): UnifiedLedgerEntry {
  return {
    id:               `ledger-inv-${inv.id}`,
    user_id:          inv.user_id,
    type:             "investment",
    title:            inv.asset_name,
    amount:           inv.amount_invested,
    direction:        "outflow",
    category:         inv.asset_type,
    related_module_id: inv.id,
    date:             inv.investment_date,
    metadata: {
      asset_type:    inv.asset_type,
      current_value: inv.current_value,
      notes:         inv.notes,
    },
    created_at: inv.created_at,
  };
}

function debtToEntry(debt: Debt): UnifiedLedgerEntry {
  return {
    id:               `ledger-debt-${debt.id}`,
    user_id:          debt.user_id,
    type:             "debt",
    title:            debt.person_or_entity,
    amount:           debt.total_amount,
    direction:        "neutral",
    category:         debt.debt_type === "payable" ? "Payable" : "Receivable",
    related_module_id: debt.id,
    date:             (debt.due_date ?? debt.created_at).slice(0, 10),
    metadata: {
      debt_type:   debt.debt_type,
      paid_amount: debt.paid_amount,
      status:      debt.status,
      notes:       debt.notes,
    },
    created_at: debt.created_at,
  };
}

function workPaymentToEntry(payment: WorkPayment): UnifiedLedgerEntry {
  return {
    id:               `ledger-work-${payment.id}`,
    user_id:          payment.user_id,
    type:             "income",
    title:            `Work — ${payment.employer_or_client}`,
    amount:           payment.amount,
    direction:        "inflow",
    category:         "Work",
    category_color:   "#22D3EE",
    related_module_id: payment.id,
    date:             payment.payment_date,
    metadata:         { notes: payment.notes },
    created_at:       payment.created_at,
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

  isLoading: boolean;
  isError:   boolean;
}

// ── Hook ───────────────────────────────────────────────────────

export function useFinancialEngine(): FinancialSnapshot {
  const { isGuest } = useGuest();
  const authenticated = !isGuest;

  const { data: transactions = [], isLoading: txLoading, isError: txError } =
    useTransactions(isGuest, true);

  const { data: debtsResult, isLoading: debtLoading, isError: debtError } =
    useDebts(isGuest, authenticated);

  const { data: investments = [], isLoading: invLoading, isError: invError } =
    useInvestments(authenticated);

  const { data: workPayments = [], isLoading: workLoading, isError: workError } =
    useWorkPayments(authenticated);

  const debts       = debtsResult?.debts   ?? [];
  const debtSummary = debtsResult?.summary;

  // ── Ledger ───────────────────────────────────────────────────
  const ledgerEntries = useMemo(
    () =>
      sortByDate([
        ...transactions.map(transactionToLedgerEntry),
        ...investments.map(investmentToEntry),
        ...debts.map(debtToEntry),
        ...workPayments.map(workPaymentToEntry),
      ]),
    [transactions, investments, debts, workPayments]
  );

  // ── Cash position ────────────────────────────────────────────
  const cashEntries = useMemo(
    () => ledgerEntries.filter((e) => e.type === "transaction" || e.type === "income"),
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
    () => investments.reduce((s, i) => s + i.amount_invested, 0),
    [investments]
  );
  const portfolioValue = useMemo(
    () => investments.reduce((s, i) => s + (i.current_value ?? i.amount_invested), 0),
    [investments]
  );
  const portfolioGain    = portfolioValue - investedTotal;
  const portfolioGainPct = investedTotal > 0 ? (portfolioGain / investedTotal) * 100 : 0;

  // ── Debts ────────────────────────────────────────────────────
  const debtPayable = debtSummary?.totalPayable
    ?? debts.filter((d) => d.debt_type === "payable")
            .reduce((s, d) => s + (d.total_amount - d.paid_amount), 0);

  const debtReceivable = debtSummary?.totalReceivable
    ?? debts.filter((d) => d.debt_type === "receivable")
            .reduce((s, d) => s + (d.total_amount - d.paid_amount), 0);

  const netDebt          = debtPayable - debtReceivable;
  const overdueDebtsCount = debtSummary?.overdueCount ?? 0;
  const debtRecoveryRate  = useMemo(() => {
    const payable = debts.filter((d) => d.debt_type === "payable");
    const total   = payable.reduce((s, d) => s + d.total_amount, 0);
    const paid    = payable.reduce((s, d) => s + d.paid_amount,  0);
    return total > 0 ? (paid / total) * 100 : 0;
  }, [debts]);

  // ── Monthly slice (current calendar month) ───────────────────
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const monthlyEntries = useMemo(
    () => cashEntries.filter((e) => e.date.startsWith(currentMonth)),
    [cashEntries, currentMonth]
  );
  const monthlyIncome   = useMemo(() => getIncome(monthlyEntries),   [monthlyEntries]);
  const monthlyExpenses = useMemo(() => getExpenses(monthlyEntries), [monthlyEntries]);
  const monthlySavingsRate = monthlyIncome > 0
    ? Math.max(0, Math.round(((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100))
    : 0;

  // ── Work income ──────────────────────────────────────────────
  const workIncome = useMemo(
    () => workPayments.reduce((s, p) => s + p.amount, 0),
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
    isLoading: txLoading || debtLoading || invLoading || workLoading,
    isError:   txError   || debtError   || invError   || workError,
  };
}
