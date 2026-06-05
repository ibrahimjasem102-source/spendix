
"use client";

import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import {
  addGuestCategory, addGuestGoal, addGuestTag, addGuestTransaction, contributeGuestGoal,
  addGuestContact, deleteGuestBudget, deleteGuestContact, deleteGuestGoal, deleteGuestTag, deleteGuestTransaction,
  deleteGuestCategory, getGuestBudgets, getGuestCategories, getGuestContacts, getGuestGoals, getGuestTags, getGuestTransactions, summarizeGuestBudgets,
  updateGuestBudget, updateGuestCategory, updateGuestContact, updateGuestGoal, updateGuestTag, updateGuestTransaction, upsertGuestBudget,
  getGuestInvestments, addGuestInvestment, updateGuestInvestment, deleteGuestInvestment,
  getGuestDebts, addGuestDebt, updateGuestDebt, deleteGuestDebt, addGuestDebtPayment,
  getGuestWorkSessions, addGuestWorkSession, updateGuestWorkSession, deleteGuestWorkSession,
  getGuestWorkPayments, addGuestWorkPayment, updateGuestWorkPayment, deleteGuestWorkPayment,
  getGuestSubscriptions, addGuestSubscription, updateGuestSubscription, deleteGuestSubscription,
} from "@/lib/guest/storage";
import { GUEST_CATEGORIES } from "@/lib/guest/categories";
import { useGuest } from "@/contexts/GuestContext";
import { queryKeys } from "@/lib/query/keys";
import {
  invalidateDebtQueries,
  invalidateFinancialQueries,
  invalidateInvestmentQueries,
  invalidateWorkQueries,
} from "@/lib/query/invalidation";
import {
  fetchJson, postJson, putJson, patchJson, deleteItem, makeCrud,
} from "@/lib/query/crud-factory";
import { financialBus } from "@/lib/finance/eventBus";
import type {
  Account, AccountFormData,
  CalendarEvent,
  FinancialContact, ContactFormData,
  Goal, GoalFormData,
  Subscription, SubscriptionFormData,
  AppNotification, Debt, DebtFormData, DebtPaymentFormData,
  Budget, BudgetFormData, BudgetSummary, Category,
  Investment, InvestmentFormData,
  Transaction, TransactionFormData,
  WorkPayment, WorkPaymentFormData, WorkSession, WorkSessionFormData,
  Tag, TagFormData,
  Household, HouseholdRole, HouseholdMember, HouseholdInvitation, HouseholdSummary,
} from "@/types";

// ── Shared invalidation helpers ─────────────────────────────────────────────

type QC = ReturnType<typeof useQueryClient>;

function invalidateFinancial(qc: QC)   { invalidateFinancialQueries(qc); }
function invalidateDebts(qc: QC)       { invalidateDebtQueries(qc); }
function invalidateInvestments(qc: QC) { invalidateInvestmentQueries(qc); }
function invalidateWork(qc: QC)        { invalidateWorkQueries(qc); }

function transactionListKey(isGuest: boolean) {
  return [...queryKeys.transactions.list(), isGuest ? "guest" : "user"] as const;
}

function goalListKey(isGuest: boolean) {
  return [...queryKeys.goals.list(), isGuest ? "guest" : "user"] as const;
}

function contactListKey(isGuest: boolean) {
  return [...queryKeys.contacts.list(), isGuest ? "guest" : "user"] as const;
}

function categoryListKey(isGuest: boolean) {
  return [...queryKeys.categories.list(), isGuest ? "guest" : "user"] as const;
}

function investmentListKey(isGuest: boolean) {
  return [...queryKeys.investments.list(), isGuest ? "guest" : "user"] as const;
}

function debtListKey(isGuest: boolean) {
  return [...queryKeys.debts.list(), isGuest ? "guest" : "user"] as const;
}

function workSessionListKey(isGuest: boolean) {
  return [...queryKeys.work.sessions(), isGuest ? "guest" : "user"] as const;
}

function workPaymentListKey(isGuest: boolean) {
  return [...queryKeys.work.payments(), isGuest ? "guest" : "user"] as const;
}

function subscriptionListKey(isGuest: boolean) {
  return [...queryKeys.subscriptions.list(), isGuest ? "guest" : "user"] as const;
}

// ══════════════════════════════════════════════════════════════
// TRANSACTIONS
// ══════════════════════════════════════════════════════════════

export function useTransactions(enabled = true) {
  const { isGuest, isLoading } = useGuest();
  return useQuery({
    queryKey: transactionListKey(isGuest),
    enabled,
    queryFn: async () => {
      if (isGuest) return getGuestTransactions();
      const data = await fetchJson<{ transactions: Transaction[] }>("/api/transactions");
      return data.transactions ?? [];
    },
    staleTime: 30_000,
  });
}

const PAGE_SIZE = 25;

export function useInfiniteTransactions(enabled = true) {
  const { isGuest, isLoading } = useGuest();
  return useInfiniteQuery({
    queryKey: [...transactionListKey(isGuest), "infinite"],
    enabled:  enabled && !isLoading,
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      if (isGuest) {
        const all = getGuestTransactions();
        return { transactions: all.slice(pageParam, pageParam + PAGE_SIZE), nextOffset: pageParam + PAGE_SIZE, total: all.length };
      }
      const data = await fetchJson<{ transactions: Transaction[] }>(
        `/api/transactions?limit=${PAGE_SIZE}&offset=${pageParam}`
      );
      const txs = data.transactions ?? [];
      return { transactions: txs, nextOffset: pageParam + PAGE_SIZE, total: null as number | null };
    },
    getNextPageParam: (last) =>
      last.transactions.length === PAGE_SIZE ? last.nextOffset : undefined,
    staleTime: 30_000,
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  const { isGuest } = useGuest();
  const listKey = transactionListKey(isGuest);
  return useMutation({
    mutationFn: async (data: TransactionFormData) => {
      if (isGuest) return addGuestTransaction(data);
      const res = await postJson<{ transaction: Transaction }>("/api/transactions", data);
      return res.transaction;
    },
    onMutate: async (data) => {
      if (isGuest) return { previous: undefined };
      await qc.cancelQueries({ queryKey: listKey });
      const previous = qc.getQueryData<Transaction[]>(listKey);
      const optimistic: Transaction = {
        id: `optimistic-${Date.now()}`,
        user_id: "optimistic",
        category_id: data.category_id,
        title: data.title,
        notes: data.notes ?? null,
        amount: data.amount,
        type: data.type,
        source: data.source ?? "manual",
        related_source_id: data.related_source_id ?? null,
        contact_id: data.contact_id ?? null,
        transaction_date: data.transaction_date,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        category: null,
      };
      qc.setQueryData<Transaction[]>(listKey, (old = []) => [optimistic, ...old]);
      return { previous };
    },
    onError: (_e, _d, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(listKey, ctx.previous);
    },
    onSuccess: (tx) => {
      qc.setQueryData<Transaction[]>(listKey, (old = []) => {
        const withoutOptimistic = old.filter((t) => !t.id.startsWith("optimistic-") && t.id !== tx.id);
        return [tx, ...withoutOptimistic];
      });
      financialBus.emit("transaction:added", {
        id: tx.id, amount: tx.amount,
        direction: tx.type === "income" ? "inflow" : "outflow",
      });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: listKey });
      if (!isGuest) invalidateFinancial(qc);
    },
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  const { isGuest } = useGuest();
  const listKey = transactionListKey(isGuest);
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TransactionFormData }) => {
      if (isGuest) {
        const tx = updateGuestTransaction(id, data);
        if (!tx) throw new Error("transactions.form_error");
        return tx;
      }
      const res = await putJson<{ transaction: Transaction }>(`/api/transactions/${id}`, data);
      return res.transaction;
    },
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: listKey });
      const previous = qc.getQueryData<Transaction[]>(listKey);
      qc.setQueryData<Transaction[]>(listKey, (old = []) =>
        old.map((t) => t.id === id ? { ...t, ...data, updated_at: new Date().toISOString() } : t)
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(listKey, ctx.previous);
    },
    onSuccess: (tx) => {
      qc.setQueryData<Transaction[]>(listKey, (old = []) =>
        old.map((t) => t.id === tx.id ? tx : t)
      );
      financialBus.emit("transaction:updated", {
        id: tx.id, amount: tx.amount,
        direction: tx.type === "income" ? "inflow" : "outflow",
      });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: listKey });
      if (!isGuest) invalidateFinancial(qc);
    },
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  const { isGuest } = useGuest();
  const listKey = transactionListKey(isGuest);
  return useMutation({
    mutationFn: async (id: string) => {
      if (isGuest) { deleteGuestTransaction(id); return id; }
      await deleteItem(`/api/transactions/${id}`);
      return id;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: listKey });
      const previous = qc.getQueryData<Transaction[]>(listKey);
      qc.setQueryData<Transaction[]>(listKey, (old = []) => old.filter((t) => t.id !== id));
      return { previous };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(listKey, ctx.previous);
    },
    onSuccess: (id) => {
      financialBus.emit("transaction:deleted", { id });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: listKey });
      if (!isGuest) invalidateFinancial(qc);
    },
  });
}

// ══════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════

export function useDashboardSummary(enabled = true) {
  return useQuery({
    queryKey: queryKeys.dashboard.summary(),
    enabled,
    queryFn: async () => {
      const data = await fetchJson<{ dashboard: unknown }>("/api/analytics/dashboard");
      return data.dashboard;
    },
    staleTime: 20_000,
  });
}

// ══════════════════════════════════════════════════════════════
// BUDGETS
// ══════════════════════════════════════════════════════════════

export interface BudgetsQueryResult {
  budgets: Budget[];
  categories: Category[];
  summary: BudgetSummary;
  period: { month: number; year: number; start: string; end: string };
}

const EMPTY_BUDGET_SUMMARY: BudgetSummary = {
  totalBudget: 0, totalSpent: 0, totalRemaining: 0,
  overBudgetCount: 0, nearLimitCount: 0,
};

export function useBudgets(month: number, year: number, isGuest = false, enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.budgets.list(month, year), isGuest ? "guest" : "user"] as const,
    enabled,
    queryFn: async (): Promise<BudgetsQueryResult> => {
      if (isGuest) {
        const budgets = getGuestBudgets(month, year);
        return {
          budgets,
          categories: GUEST_CATEGORIES.filter((c) => c.type === "expense"),
          summary: summarizeGuestBudgets(budgets),
          period: { month, year, start: "", end: "" },
        };
      }

      const data = await fetchJson<BudgetsQueryResult>(`/api/budgets?month=${month}&year=${year}`);

      return {
        budgets:    data.budgets    ?? [],
        categories: data.categories ?? [],
        summary:    data.summary    ?? EMPTY_BUDGET_SUMMARY,
        period:     data.period     ?? { month, year, start: "", end: "" },
      };
    },
    staleTime: 20_000,
  });
}

export function useCreateBudget(month: number, year: number, isGuest = false) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: BudgetFormData) => {
      if (isGuest) return upsertGuestBudget(data);
      const res = await postJson<{ budget: Budget }>("/api/budgets", data);
      return res.budget;
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.budgets.list(month, year) });
      if (!isGuest) invalidateFinancial(qc);
    },
  });
}

export function useUpdateBudget(month: number, year: number, isGuest = false) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: BudgetFormData }) => {
      if (isGuest) {
        const budget = updateGuestBudget(id, data);
        if (!budget) throw new Error("Budget not found");
        return budget;
      }
      const res = await patchJson<{ budget: Budget }>(`/api/budgets/${id}`, data);
      return res.budget;
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.budgets.list(month, year) });
      if (!isGuest) invalidateFinancial(qc);
    },
  });
}

export function useDeleteBudget(month: number, year: number, isGuest = false) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (isGuest) { deleteGuestBudget(id); return id; }
      await deleteItem(`/api/budgets/${id}`);
      return id;
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.budgets.list(month, year) });
      if (!isGuest) invalidateFinancial(qc);
    },
  });
}

// ══════════════════════════════════════════════════════════════
// ANALYTICS
// ══════════════════════════════════════════════════════════════

export function useAnalytics(enabled = true) {
  return useQuery({
    queryKey: queryKeys.analytics.bundle(),
    enabled,
    queryFn: async () => {
      const [charts, debts, investments, work] = await Promise.allSettled([
        fetchJson<{ charts: unknown }>("/api/analytics/charts"),
        fetchJson<{ debts: unknown }>("/api/analytics/debts"),
        fetchJson<{ investments: unknown }>("/api/analytics/investments"),
        fetchJson<{ work: unknown }>("/api/analytics/work"),
      ]);
      return {
        charts:      charts.status      === "fulfilled" ? charts.value.charts           : null,
        debts:       debts.status       === "fulfilled" ? debts.value.debts             : null,
        investments: investments.status === "fulfilled" ? investments.value.investments : null,
        work:        work.status        === "fulfilled" ? work.value.work               : null,
      };
    },
    staleTime: 20_000,
  });
}

// ══════════════════════════════════════════════════════════════
// DEBTS
// ══════════════════════════════════════════════════════════════

export interface DebtsSummary {
  totalPayable: number;
  totalReceivable: number;
  overdueCount: number;
  totalDebts: number;
  activeDebts: number;
}

export interface DebtsQueryResult {
  debts: Debt[];
  summary: DebtsSummary;
  contactsAvailable: boolean;
}

const EMPTY_DEBT_SUMMARY: DebtsSummary = {
  totalPayable: 0, totalReceivable: 0, overdueCount: 0, totalDebts: 0, activeDebts: 0,
};


export function useDebts(enabled = true) {
  const { isGuest, isLoading: guestLoading } = useGuest();
  const listKey = debtListKey(isGuest);
  return useQuery({
    queryKey: listKey,
    enabled,
    queryFn: async (): Promise<DebtsQueryResult> => {
      if (isGuest) {
        const debts = getGuestDebts();
        const summary: DebtsSummary = {
          totalPayable:    debts.filter((d) => d.debt_type === "payable"    && d.status !== "paid").reduce((s, d) => s + Number(d.remaining_amount ?? 0), 0),
          totalReceivable: debts.filter((d) => d.debt_type === "receivable" && d.status !== "paid").reduce((s, d) => s + Number(d.remaining_amount ?? 0), 0),
          overdueCount:    debts.filter((d) => d.status === "overdue").length,
          totalDebts:      debts.length,
          activeDebts:     debts.filter((d) => d.status !== "paid").length,
        };
        return { debts, summary, contactsAvailable: false };
      }
      const data = await fetchJson<DebtsQueryResult>("/api/debts");
      return {
        debts: data.debts ?? [],
        summary: data.summary ?? EMPTY_DEBT_SUMMARY,
        contactsAvailable: data.contactsAvailable ?? true,
      };
    },
    staleTime: 30_000,
  });
}

export function useCreateDebt() {
  const qc = useQueryClient();
  const { isGuest } = useGuest();
  const listKey = debtListKey(isGuest);
  return useMutation({
    mutationFn: async (data: DebtFormData) => {
      if (isGuest) return addGuestDebt(data);
      const res = await postJson<{ debt: Debt }>("/api/debts", data);
      return res.debt;
    },
    onMutate: async (data) => {
      if (isGuest) return { previous: undefined };
      await qc.cancelQueries({ queryKey: listKey });
      const previous = qc.getQueryData<DebtsQueryResult>(listKey);
      const optimistic: Debt = {
        id: `optimistic-${Date.now()}`,
        user_id: "optimistic",
        person_or_entity: data.person_or_entity,
        debt_type: data.debt_type,
        total_amount: data.total_amount,
        paid_amount: 0,
        due_date: data.due_date ?? null,
        status: "active",
        notes: data.notes ?? null,
        contact_id: data.contact_id ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      qc.setQueryData<DebtsQueryResult>(listKey, (old) => {
        if (!old) return { debts: [optimistic], summary: EMPTY_DEBT_SUMMARY, contactsAvailable: true };
        return { ...old, debts: [optimistic, ...old.debts] };
      });
      return { previous };
    },
    onError: (_e, _d, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(listKey, ctx.previous);
    },
    onSuccess: (debt) => {
      qc.setQueryData<DebtsQueryResult>(listKey, (old) => {
        if (!old) return { debts: [debt], summary: EMPTY_DEBT_SUMMARY, contactsAvailable: isGuest ? false : true };
        return { ...old, debts: [debt, ...old.debts.filter((d) => !d.id.startsWith("optimistic-") && d.id !== debt.id)] };
      });
      financialBus.emit("debt:created", { debtId: debt.id, amount: debt.total_amount, debtType: debt.debt_type });
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: listKey }),
  });
}

export function useUpdateDebt() {
  const qc = useQueryClient();
  const { isGuest } = useGuest();
  const listKey = debtListKey(isGuest);
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: DebtFormData }) => {
      if (isGuest) {
        const debt = updateGuestDebt(id, data);
        if (!debt) throw new Error("debts.save_failed");
        return debt;
      }
      const res = await putJson<{ debt: Debt }>(`/api/debts/${id}`, data);
      return res.debt;
    },
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: listKey });
      const previous = qc.getQueryData<DebtsQueryResult>(listKey);
      qc.setQueryData<DebtsQueryResult>(listKey, (old) => {
        if (!old) return old;
        return { ...old, debts: old.debts.map((d) => d.id === id ? { ...d, ...data, updated_at: new Date().toISOString() } : d) };
      });
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(listKey, ctx.previous);
    },
    onSuccess: (debt) => {
      qc.setQueryData<DebtsQueryResult>(listKey, (old) => {
        if (!old) return old;
        return { ...old, debts: old.debts.map((d) => d.id === debt.id ? debt : d) };
      });
      financialBus.emit("debt:updated", { debtId: debt.id });
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: listKey }),
  });
}

export function useDeleteDebt() {
  const qc = useQueryClient();
  const { isGuest } = useGuest();
  const listKey = debtListKey(isGuest);
  return useMutation({
    mutationFn: async (id: string) => {
      if (isGuest) { deleteGuestDebt(id); return id; }
      await deleteItem(`/api/debts/${id}`);
      return id;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: listKey });
      const previous = qc.getQueryData<DebtsQueryResult>(listKey);
      qc.setQueryData<DebtsQueryResult>(listKey, (old) => {
        if (!old) return old;
        return { ...old, debts: old.debts.filter((d) => d.id !== id) };
      });
      return { previous };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(listKey, ctx.previous);
    },
    onSuccess: (id) => { financialBus.emit("debt:deleted", { debtId: id }); },
    onSettled: () => void qc.invalidateQueries({ queryKey: listKey }),
  });
}

export function useCreateDebtPayment() {
  const qc = useQueryClient();
  const { isGuest } = useGuest();
  const listKey = debtListKey(isGuest);
  return useMutation({
    mutationFn: async ({ debtId, data }: { debtId: string; data: DebtPaymentFormData }) => {
      if (isGuest) {
        const debt = addGuestDebtPayment(debtId, data);
        if (!debt) throw new Error("debts.payment_failed");
        return debt;
      }
      const res = await postJson<{ debt: Debt }>(`/api/debts/${debtId}/payments`, data);
      return res.debt;
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: listKey });
      const previous = qc.getQueryData<DebtsQueryResult>(listKey);
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(listKey, ctx.previous);
    },
    onSuccess: (updatedDebt, { data }) => {
      qc.setQueryData<DebtsQueryResult>(listKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          debts: old.debts.map((d) => {
            if (d.id !== updatedDebt.id) return d;
            if (isGuest) return updatedDebt;
            const newPayment = { id: `opt-${Date.now()}`, amount: data.amount, payment_date: data.payment_date, notes: data.notes ?? null };
            return { ...updatedDebt, payments: [newPayment, ...(d.payments ?? [])] };
          }),
        };
      });
      financialBus.emit("debt:payment_recorded", {
        debtId: updatedDebt.id, amount: data.amount, debtType: updatedDebt.debt_type,
      });
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: listKey }),
  });
}

// ══════════════════════════════════════════════════════════════
// INVESTMENTS
// ══════════════════════════════════════════════════════════════

export function useInvestments(enabled = true) {
  const { isGuest, isLoading: guestLoading } = useGuest();
  const listKey = investmentListKey(isGuest);
  return useQuery({
    queryKey: listKey,
    enabled,
    queryFn: async () => {
      if (isGuest) return getGuestInvestments();
      const data = await fetchJson<{ investments: Investment[] }>("/api/investments");
      return data.investments ?? [];
    },
    staleTime: 30_000,
  });
}

export function usePortfolioHistory(enabled = true) {
  const { isGuest, isLoading: guestLoading } = useGuest();
  return useQuery({
    queryKey: queryKeys.investments.portfolioHistory(),
    enabled: enabled && !isGuest,
    queryFn: async () => {
      const data = await fetchJson<{ history: { month: string; value: number }[] }>(
        "/api/investments/portfolio-history"
      );
      return data.history ?? [];
    },
    staleTime: 60_000,
  });
}

export function useCreateInvestment() {
  const qc = useQueryClient();
  const { isGuest } = useGuest();
  const listKey = investmentListKey(isGuest);
  return useMutation({
    mutationFn: async (data: InvestmentFormData) => {
      if (isGuest) return addGuestInvestment(data);
      const res = await postJson<{ investment: Investment }>("/api/investments", data);
      return res.investment;
    },
    onMutate: async (data) => {
      if (isGuest) return { previous: undefined };
      await qc.cancelQueries({ queryKey: listKey });
      const previous = qc.getQueryData<Investment[]>(listKey);
      const optimistic: Investment = {
        id: `optimistic-${Date.now()}`,
        user_id: "optimistic",
        asset_name: data.asset_name,
        asset_type: data.asset_type,
        amount_invested: data.amount_invested,
        current_value: data.current_value ?? null,
        investment_date: data.investment_date,
        notes: data.notes ?? null,
        transaction_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      qc.setQueryData<Investment[]>(listKey, (old = []) => [optimistic, ...old]);
      return { previous };
    },
    onError: (_e, _d, ctx) => { if (ctx?.previous) qc.setQueryData(listKey, ctx.previous); },
    onSuccess: (inv) => {
      qc.setQueryData<Investment[]>(listKey, (old = []) => [
        inv, ...old.filter((i) => !i.id.startsWith("optimistic-") && i.id !== inv.id),
      ]);
      financialBus.emit("investment:added", { id: inv.id, amount: inv.amount_invested });
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: listKey }),
  });
}

export function useUpdateInvestment() {
  const qc = useQueryClient();
  const { isGuest } = useGuest();
  const listKey = investmentListKey(isGuest);
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: InvestmentFormData }) => {
      if (isGuest) {
        const inv = updateGuestInvestment(id, data);
        if (!inv) throw new Error("investments.save_failed");
        return inv;
      }
      const res = await putJson<{ investment: Investment }>(`/api/investments/${id}`, data);
      return res.investment;
    },
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: listKey });
      const previous = qc.getQueryData<Investment[]>(listKey);
      qc.setQueryData<Investment[]>(listKey, (old = []) =>
        old.map((i) => i.id === id ? { ...i, ...data, updated_at: new Date().toISOString() } : i)
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => { if (ctx?.previous) qc.setQueryData(listKey, ctx.previous); },
    onSuccess: (inv) => {
      qc.setQueryData<Investment[]>(listKey, (old = []) =>
        old.map((i) => i.id === inv.id ? inv : i)
      );
      financialBus.emit("investment:updated", {
        id: inv.id, previousValue: inv.amount_invested, currentValue: inv.current_value ?? inv.amount_invested,
      });
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: listKey }),
  });
}

export function useDeleteInvestment() {
  const qc = useQueryClient();
  const { isGuest } = useGuest();
  const listKey = investmentListKey(isGuest);
  return useMutation({
    mutationFn: async (id: string) => {
      if (isGuest) { deleteGuestInvestment(id); return id; }
      await deleteItem(`/api/investments/${id}`);
      return id;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: listKey });
      const previous = qc.getQueryData<Investment[]>(listKey);
      qc.setQueryData<Investment[]>(listKey, (old = []) => old.filter((i) => i.id !== id));
      return { previous };
    },
    onError: (_e, _id, ctx) => { if (ctx?.previous) qc.setQueryData(listKey, ctx.previous); },
    onSuccess: (id) => { financialBus.emit("investment:deleted", { id }); },
    onSettled: () => void qc.invalidateQueries({ queryKey: listKey }),
  });
}

// ══════════════════════════════════════════════════════════════
// WORK
// ══════════════════════════════════════════════════════════════

export function useWorkSessions(enabled = true) {
  const { isGuest, isLoading: guestLoading } = useGuest();
  const listKey = workSessionListKey(isGuest);
  return useQuery({
    queryKey: listKey,
    enabled,
    queryFn: async () => {
      if (isGuest) return getGuestWorkSessions();
      const data = await fetchJson<{ sessions: WorkSession[] }>("/api/work/sessions");
      return data.sessions ?? [];
    },
    staleTime: 30_000,
  });
}

export function useWorkPayments(enabled = true) {
  const { isGuest, isLoading: guestLoading } = useGuest();
  const listKey = workPaymentListKey(isGuest);
  return useQuery({
    queryKey: listKey,
    enabled,
    queryFn: async () => {
      if (isGuest) return getGuestWorkPayments();
      const data = await fetchJson<{ payments: WorkPayment[] }>("/api/work/payments");
      return data.payments ?? [];
    },
    staleTime: 30_000,
  });
}

export function useCreateWorkSession() {
  const qc = useQueryClient();
  const { isGuest } = useGuest();
  const listKey = workSessionListKey(isGuest);
  return useMutation({
    mutationFn: async (data: WorkSessionFormData) => {
      if (isGuest) return addGuestWorkSession(data);
      const res = await postJson<{ session: WorkSession }>("/api/work/sessions", data);
      return res.session;
    },
    onMutate: async (data) => {
      if (isGuest) return { previous: undefined };
      await qc.cancelQueries({ queryKey: listKey });
      const previous = qc.getQueryData<WorkSession[]>(listKey);
      const optimistic: WorkSession = {
        id: `optimistic-${Date.now()}`,
        user_id: "optimistic",
        title: data.title,
        employer_or_client: data.employer_or_client,
        hourly_rate: data.hourly_rate,
        hours_worked: data.hours_worked,
        expected_amount: data.hourly_rate * data.hours_worked,
        work_date: data.work_date,
        due_date: data.due_date ?? null,
        notes: data.notes ?? null,
        recurrence: data.recurrence,
        recurrence_end_date: data.recurrence_end_date ?? null,
        status: "pending",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      qc.setQueryData<WorkSession[]>(listKey, (old = []) => [optimistic, ...old]);
      return { previous };
    },
    onError: (_e, _d, ctx) => { if (ctx?.previous) qc.setQueryData(listKey, ctx.previous); },
    onSuccess: (session) => {
      qc.setQueryData<WorkSession[]>(listKey, (old = []) => [
        session, ...old.filter((s) => !s.id.startsWith("optimistic-") && s.id !== session.id),
      ]);
      financialBus.emit("work:session_logged", { hours: session.hours_worked });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: listKey });
      if (!isGuest) invalidateWork(qc);
    },
  });
}

export function useUpdateWorkSession() {
  const qc = useQueryClient();
  const { isGuest } = useGuest();
  const listKey = workSessionListKey(isGuest);
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: WorkSessionFormData }) => {
      if (isGuest) {
        const session = updateGuestWorkSession(id, data);
        if (!session) throw new Error("work.save_failed");
        return session;
      }
      const res = await putJson<{ session: WorkSession }>(`/api/work/sessions/${id}`, data);
      return res.session;
    },
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: listKey });
      const previous = qc.getQueryData<WorkSession[]>(listKey);
      qc.setQueryData<WorkSession[]>(listKey, (old = []) =>
        old.map((s) => s.id === id ? { ...s, ...data, updated_at: new Date().toISOString() } : s)
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => { if (ctx?.previous) qc.setQueryData(listKey, ctx.previous); },
    onSuccess: (session) => {
      qc.setQueryData<WorkSession[]>(listKey, (old = []) =>
        old.map((s) => s.id === session.id ? session : s)
      );
      financialBus.emit("work:session_updated", { id: session.id });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: listKey });
      if (!isGuest) invalidateWork(qc);
    },
  });
}

export function useDeleteWorkSession() {
  const qc = useQueryClient();
  const { isGuest } = useGuest();
  const listKey = workSessionListKey(isGuest);
  return useMutation({
    mutationFn: async (id: string) => {
      if (isGuest) { deleteGuestWorkSession(id); return id; }
      await deleteItem(`/api/work/sessions/${id}`);
      return id;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: listKey });
      const previous = qc.getQueryData<WorkSession[]>(listKey);
      qc.setQueryData<WorkSession[]>(listKey, (old = []) => old.filter((s) => s.id !== id));
      return { previous };
    },
    onError: (_e, _id, ctx) => { if (ctx?.previous) qc.setQueryData(listKey, ctx.previous); },
    onSuccess: (id) => { financialBus.emit("work:session_deleted", { id }); },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: listKey });
      if (!isGuest) invalidateWork(qc);
    },
  });
}

export function useCreateWorkPayment() {
  const qc = useQueryClient();
  const { isGuest } = useGuest();
  const listKey = workPaymentListKey(isGuest);
  return useMutation({
    mutationFn: async (data: WorkPaymentFormData) => {
      if (isGuest) return addGuestWorkPayment(data);
      const res = await postJson<{ payment: WorkPayment }>("/api/work/payments", data);
      return res.payment;
    },
    onMutate: async (data) => {
      if (isGuest) return { previous: undefined };
      await qc.cancelQueries({ queryKey: listKey });
      const previous = qc.getQueryData<WorkPayment[]>(listKey);
      const optimistic: WorkPayment = {
        id: `optimistic-${Date.now()}`,
        user_id: "optimistic",
        work_session_id: data.work_session_id ?? null,
        employer_or_client: data.employer_or_client,
        amount: data.amount,
        payment_date: data.payment_date,
        notes: data.notes ?? null,
        transaction_id: null,
        created_at: new Date().toISOString(),
      };
      qc.setQueryData<WorkPayment[]>(listKey, (old = []) => [optimistic, ...old]);
      return { previous };
    },
    onError: (_e, _d, ctx) => { if (ctx?.previous) qc.setQueryData(listKey, ctx.previous); },
    onSuccess: (payment) => {
      qc.setQueryData<WorkPayment[]>(listKey, (old = []) => [
        payment, ...old.filter((p) => !p.id.startsWith("optimistic-") && p.id !== payment.id),
      ]);
      financialBus.emit("work:payment_received", { amount: payment.amount });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: listKey });
      if (!isGuest) invalidateWork(qc);
    },
  });
}

export function useUpdateWorkPayment() {
  const qc = useQueryClient();
  const { isGuest } = useGuest();
  const listKey = workPaymentListKey(isGuest);
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: WorkPaymentFormData }) => {
      if (isGuest) {
        const payment = updateGuestWorkPayment(id, data);
        if (!payment) throw new Error("work.save_failed");
        return payment;
      }
      const res = await putJson<{ payment: WorkPayment }>(`/api/work/payments/${id}`, data);
      return res.payment;
    },
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: listKey });
      const previous = qc.getQueryData<WorkPayment[]>(listKey);
      qc.setQueryData<WorkPayment[]>(listKey, (old = []) =>
        old.map((p) => p.id === id ? { ...p, ...data, id } : p)
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => { if (ctx?.previous) qc.setQueryData(listKey, ctx.previous); },
    onSuccess: (payment) => {
      qc.setQueryData<WorkPayment[]>(listKey, (old = []) =>
        old.map((p) => p.id === payment.id ? payment : p)
      );
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: listKey });
      if (!isGuest) invalidateWork(qc);
    },
  });
}

export function useDeleteWorkPayment() {
  const qc = useQueryClient();
  const { isGuest } = useGuest();
  const listKey = workPaymentListKey(isGuest);
  return useMutation({
    mutationFn: async (id: string) => {
      if (isGuest) { deleteGuestWorkPayment(id); return id; }
      await deleteItem(`/api/work/payments/${id}`);
      return id;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: listKey });
      const previous = qc.getQueryData<WorkPayment[]>(listKey);
      qc.setQueryData<WorkPayment[]>(listKey, (old = []) => old.filter((p) => p.id !== id));
      return { previous };
    },
    onError: (_e, _id, ctx) => { if (ctx?.previous) qc.setQueryData(listKey, ctx.previous); },
    onSuccess: (id) => { financialBus.emit("work:payment_deleted", { id }); },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: listKey });
      if (!isGuest) invalidateWork(qc);
    },
  });
}

// ══════════════════════════════════════════════════════════════
// ACCOUNTS (factory)
// ══════════════════════════════════════════════════════════════

export function useAccounts(enabled = true) {
  return useQuery({
    queryKey: queryKeys.accounts.list(),
    enabled,
    queryFn: async () => {
      try {
        const data = await fetchJson<{ accounts: Account[] }>("/api/accounts");
        return data.accounts ?? [];
      } catch (error) {
        console.warn("[Spendix] Accounts fetch failed", error);
        return [];
      }
    },
    staleTime: 30_000,
  });
}

const _accountCrud = makeCrud<Account, AccountFormData>({
  keys: { all: queryKeys.accounts.all, list: queryKeys.accounts.list },
  endpoint: "/api/accounts",
  responseKey: "account",
  onCreateSuccess: (a)      => financialBus.emit("account:created", { id: a.id, name: a.name }),
  onUpdateSuccess: (_, { id }) => financialBus.emit("account:updated", { id }),
  onDeleteSuccess: (id)     => financialBus.emit("account:deleted", { id }),
});
export const useCreateAccount = _accountCrud.useCreate;
export const useUpdateAccount = _accountCrud.useUpdate;
export const useDeleteAccount = _accountCrud.useDelete;

// ══════════════════════════════════════════════════════════════
// SUBSCRIPTIONS (factory)
// ══════════════════════════════════════════════════════════════

export function useSubscriptions(enabled = true) {
  const { isGuest, isLoading: guestLoading } = useGuest();
  const listKey = subscriptionListKey(isGuest);
  return useQuery({
    queryKey: listKey,
    enabled,
    queryFn: async () => {
      if (isGuest) return getGuestSubscriptions();
      const data = await fetchJson<{ subscriptions: Subscription[] }>("/api/subscriptions");
      return data.subscriptions ?? [];
    },
    staleTime: 30_000,
  });
}

export function useCreateSubscription() {
  const qc = useQueryClient();
  const { isGuest } = useGuest();
  const listKey = subscriptionListKey(isGuest);
  return useMutation({
    mutationFn: async (data: SubscriptionFormData) => {
      if (isGuest) return addGuestSubscription(data);
      const res = await postJson<{ subscription: Subscription }>("/api/subscriptions", data);
      return res.subscription;
    },
    onSuccess: (subscription) => {
      qc.setQueryData<Subscription[]>(listKey, (old = []) => [
        subscription,
        ...old.filter((item) => item.id !== subscription.id),
      ]);
      financialBus.emit("subscription:created", {
        id: subscription.id,
        name: subscription.name,
        amount: subscription.amount,
      });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: listKey });
      void qc.invalidateQueries({ queryKey: queryKeys.calendar.all, refetchType: "all" });
    },
  });
}

export function useUpdateSubscription() {
  const qc = useQueryClient();
  const { isGuest } = useGuest();
  const listKey = subscriptionListKey(isGuest);
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SubscriptionFormData> }) => {
      if (isGuest) {
        const subscription = updateGuestSubscription(id, data);
        if (!subscription) throw new Error("subscriptions.not_found");
        return subscription;
      }
      const res = await putJson<{ subscription: Subscription }>(`/api/subscriptions/${id}`, data);
      return res.subscription;
    },
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: listKey });
      const previous = qc.getQueryData<Subscription[]>(listKey);
      qc.setQueryData<Subscription[]>(listKey, (old = []) =>
        old.map((subscription) =>
          subscription.id === id ? { ...subscription, ...data, updated_at: new Date().toISOString() } : subscription
        )
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => { if (ctx?.previous) qc.setQueryData(listKey, ctx.previous); },
    onSuccess: (subscription) => {
      qc.setQueryData<Subscription[]>(listKey, (old = []) =>
        old.map((item) => item.id === subscription.id ? subscription : item)
      );
      financialBus.emit("subscription:updated", { id: subscription.id });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: listKey });
      void qc.invalidateQueries({ queryKey: queryKeys.calendar.all, refetchType: "all" });
    },
  });
}

export function useDeleteSubscription() {
  const qc = useQueryClient();
  const { isGuest } = useGuest();
  const listKey = subscriptionListKey(isGuest);
  return useMutation({
    mutationFn: async (id: string) => {
      if (isGuest) { deleteGuestSubscription(id); return id; }
      await deleteItem(`/api/subscriptions/${id}`);
      return id;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: listKey });
      const previous = qc.getQueryData<Subscription[]>(listKey);
      qc.setQueryData<Subscription[]>(listKey, (old = []) => old.filter((subscription) => subscription.id !== id));
      return { previous };
    },
    onError: (_e, _id, ctx) => { if (ctx?.previous) qc.setQueryData(listKey, ctx.previous); },
    onSuccess: (id) => financialBus.emit("subscription:deleted", { id }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: listKey });
      void qc.invalidateQueries({ queryKey: queryKeys.calendar.all, refetchType: "all" });
    },
  });
}

// ══════════════════════════════════════════════════════════════
// CALENDAR
// ══════════════════════════════════════════════════════════════

export function useCalendar(year: number, month: number, enabled = true) {
  const { isGuest, isLoading } = useGuest();
  return useQuery({
    queryKey: [...queryKeys.calendar.byMonth(year, month), isGuest ? "guest" : "user"] as const,
    enabled,
    queryFn: async () => {
      if (isGuest) {
        return getGuestTransactions()
          .filter((tx) => {
            const date = new Date(`${tx.transaction_date}T00:00:00`);
            return date.getFullYear() === year && date.getMonth() + 1 === month;
          })
          .map<CalendarEvent>((tx) => ({
            id: tx.id,
            date: tx.transaction_date,
            type: tx.type === "income" ? "income" : "expense",
            title: tx.title,
            amount: Number(tx.amount),
            icon: tx.category?.icon ?? null,
            color: tx.type === "income" ? "#10B981" : "#F43F5E",
            source: "transaction",
            source_id: tx.id,
            action_url: "/transactions",
          }));
      }

      try {
        const data = await fetchJson<{ events: CalendarEvent[] }>(`/api/calendar?year=${year}&month=${month}`);
        return data.events ?? [];
      } catch (error) {
        console.warn("[Spendix] Calendar fetch failed", error);
        return [];
      }
    },
    staleTime: 60_000,
  });
}

// ══════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ══════════════════════════════════════════════════════════════

export function useNotifications(enabled = true) {
  const { isGuest, isLoading } = useGuest();
  return useQuery({
    queryKey: queryKeys.notifications.list(),
    enabled: enabled && !isGuest,
    queryFn: async () => {
      const data = await fetchJson<{ notifications: AppNotification[]; unreadCount: number }>("/api/notifications");
      return data;
    },
    staleTime: 15_000,
  });
}

// ══════════════════════════════════════════════════════════════
// GOALS (factory + custom contribute action)
// ══════════════════════════════════════════════════════════════

export function useGoals(enabled = true) {
  const { isGuest, isLoading } = useGuest();
  return useQuery({
    queryKey: goalListKey(isGuest),
    enabled,
    queryFn: async () => {
      if (isGuest) return getGuestGoals();
      const data = await fetchJson<{ goals: Goal[] }>("/api/goals");
      return data.goals ?? [];
    },
    staleTime: 30_000,
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  const { isGuest } = useGuest();
  const listKey = goalListKey(isGuest);

  return useMutation({
    mutationFn: async (data: GoalFormData) => {
      if (isGuest) return addGuestGoal(data);
      const res = await postJson<{ goal: Goal }>("/api/goals", data);
      return res.goal;
    },
    onSuccess: (goal) => {
      qc.setQueryData<Goal[]>(listKey, (old = []) => {
        const withoutDuplicate = old.filter((item) => item.id !== goal.id);
        return [goal, ...withoutDuplicate];
      });
      financialBus.emit("goal:progress_updated", {
        goalId: goal.id,
        progress: goal.progress,
        completed: goal.status === "completed",
      });
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: queryKeys.goals.all, refetchType: "all" }),
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  const { isGuest } = useGuest();
  const listKey = goalListKey(isGuest);

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: GoalFormData }) => {
      if (isGuest) {
        const goal = updateGuestGoal(id, data);
        if (!goal) throw new Error("goals.not_found");
        return goal;
      }
      const res = await putJson<{ goal: Goal }>(`/api/goals/${id}`, data);
      return res.goal;
    },
    onSuccess: (goal) => {
      qc.setQueryData<Goal[]>(listKey, (old = []) =>
        old.map((item) => item.id === goal.id ? goal : item)
      );
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: queryKeys.goals.all, refetchType: "all" }),
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  const { isGuest } = useGuest();
  const listKey = goalListKey(isGuest);

  return useMutation({
    mutationFn: async (id: string) => {
      if (isGuest) {
        deleteGuestGoal(id);
        return id;
      }
      await deleteItem(`/api/goals/${id}`);
      return id;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: listKey });
      const previous = qc.getQueryData<Goal[]>(listKey);
      qc.setQueryData<Goal[]>(listKey, (old = []) => old.filter((goal) => goal.id !== id));
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) qc.setQueryData(listKey, context.previous);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: queryKeys.goals.all, refetchType: "all" }),
  });
}

export function useContributeToGoal() {
  const qc = useQueryClient();
  const { isGuest } = useGuest();
  const listKey = goalListKey(isGuest);

  return useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      if (isGuest) {
        const result = contributeGuestGoal(id, amount);
        if (!result) throw new Error("goals.contribute_error");
        return result;
      }
      return postJson<{ success: boolean; new_saved: number; completed: boolean; completed_at?: string | null }>(
        `/api/goals/${id}/contribute`, { amount },
      );
    },
    onSuccess: (res, { id }) => {
      qc.setQueryData<Goal[]>(listKey, (old = []) =>
        old.map((g) => g.id === id
          ? { ...g, saved_amount: res.new_saved, computed_saved: res.new_saved,
              progress: g.target_amount > 0 ? Math.min(100, Math.round((res.new_saved / g.target_amount) * 100)) : 0,
              remaining: Math.max(0, g.target_amount - res.new_saved),
              completed_at: res.completed_at ?? (res.completed ? new Date().toISOString() : g.completed_at ?? null),
              status: res.completed ? "completed" : g.status }
          : g)
      );
      if (res.completed)
        financialBus.emit("goal:progress_updated", { goalId: id, progress: 100, completed: true });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.goals.all,      refetchType: "all" });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard.all,  refetchType: "all" });
      void qc.invalidateQueries({ queryKey: queryKeys.analytics.bundle(), refetchType: "all" });
    },
  });
}

// ══════════════════════════════════════════════════════════════
// SAVINGS (factory + deposit/withdraw actions)
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
// CATEGORIES
// ══════════════════════════════════════════════════════════════

export type CategoryFormData = {
  name: string;
  type: "income" | "expense";
  color: string;
  icon?: string | null;
  section?: Category["section"];
  parent_id?: string | null;
};

function sortCategories(items: Category[]) {
  return [...items].sort((a, b) =>
    (a.section ?? a.type).localeCompare(b.section ?? b.type) ||
    a.type.localeCompare(b.type) ||
    (a.parent_id ?? "").localeCompare(b.parent_id ?? "") ||
    a.name.localeCompare(b.name)
  );
}

export function useCategories(enabled = true) {
  const { isGuest, isLoading } = useGuest();
  return useQuery({
    queryKey: categoryListKey(isGuest),
    enabled,
    queryFn: async () => {
      if (isGuest) return getGuestCategories();
      const data = await fetchJson<{ categories: Category[] }>("/api/categories");
      return data.categories ?? [];
    },
    staleTime: 30_000,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  const { isGuest } = useGuest();
  const listKey = categoryListKey(isGuest);

  return useMutation({
    mutationFn: async (data: CategoryFormData) => {
      if (isGuest) return addGuestCategory(data);
      const res = await postJson<{ category: Category }>("/api/categories", data);
      return res.category;
    },
    onSuccess: (category) => {
      qc.setQueryData<Category[]>(listKey, (old = []) =>
        sortCategories([...old.filter((item) => item.id !== category.id), category])
      );
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.categories.all, refetchType: "all" });
      void qc.invalidateQueries({ queryKey: queryKeys.budgets.all, refetchType: "all" });
    },
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  const { isGuest } = useGuest();
  const listKey = categoryListKey(isGuest);

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CategoryFormData }) => {
      if (isGuest) {
        const category = updateGuestCategory(id, data);
        if (!category) throw new Error("categories.error_save");
        return category;
      }
      const res = await patchJson<{ category: Category }>("/api/categories", { id, ...data });
      return res.category;
    },
    onSuccess: (category) => {
      qc.setQueryData<Category[]>(listKey, (old = []) =>
        sortCategories(old.map((item) => item.id === category.id ? category : item))
      );
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: queryKeys.categories.all, refetchType: "all" }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  const { isGuest } = useGuest();
  const listKey = categoryListKey(isGuest);

  return useMutation({
    mutationFn: async (id: string) => {
      if (isGuest) {
        deleteGuestCategory(id);
        return id;
      }
      await deleteItem(`/api/categories?id=${encodeURIComponent(id)}`);
      return id;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: listKey });
      const previous = qc.getQueryData<Category[]>(listKey);
      qc.setQueryData<Category[]>(listKey, (old = []) => old.filter((category) => category.id !== id));
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) qc.setQueryData(listKey, context.previous);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: queryKeys.categories.all, refetchType: "all" }),
  });
}

// ══════════════════════════════════════════════════════════════
// CONTACTS
// ══════════════════════════════════════════════════════════════

export function useContacts(enabled = true) {
  const { isGuest, isLoading } = useGuest();
  return useQuery({
    queryKey: contactListKey(isGuest),
    enabled,
    queryFn: async () => {
      if (isGuest) return getGuestContacts();
      const data = await fetchJson<{ contacts: FinancialContact[] }>("/api/contacts");
      return data.contacts ?? [];
    },
    staleTime: 30_000,
  });
}

export function useCreateContact() {
  const qc = useQueryClient();
  const { isGuest } = useGuest();
  const listKey = contactListKey(isGuest);

  return useMutation({
    mutationFn: async (data: ContactFormData) => {
      if (isGuest) return addGuestContact(data);
      const res = await postJson<{ contact: FinancialContact }>("/api/contacts", data);
      return res.contact;
    },
    onSuccess: (contact) => {
      qc.setQueryData<FinancialContact[]>(listKey, (old = []) =>
        [...old.filter((item) => item.id !== contact.id), contact]
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: queryKeys.contacts.all, refetchType: "all" }),
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  const { isGuest } = useGuest();
  const listKey = contactListKey(isGuest);

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ContactFormData }) => {
      if (isGuest) {
        const contact = updateGuestContact(id, data);
        if (!contact) throw new Error("contacts.fetch_error");
        return contact;
      }
      const res = await putJson<{ contact: FinancialContact }>(`/api/contacts/${id}`, data);
      return res.contact;
    },
    onSuccess: (contact) => {
      qc.setQueryData<FinancialContact[]>(listKey, (old = []) =>
        old.map((item) => item.id === contact.id ? contact : item)
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: queryKeys.contacts.all, refetchType: "all" }),
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  const { isGuest } = useGuest();
  const listKey = contactListKey(isGuest);

  return useMutation({
    mutationFn: async (id: string) => {
      if (isGuest) {
        deleteGuestContact(id);
        return id;
      }
      await deleteItem(`/api/contacts/${id}`);
      return id;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: listKey });
      const previous = qc.getQueryData<FinancialContact[]>(listKey);
      qc.setQueryData<FinancialContact[]>(listKey, (old = []) => old.filter((contact) => contact.id !== id));
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) qc.setQueryData(listKey, context.previous);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: queryKeys.contacts.all, refetchType: "all" }),
  });
}

// ══════════════════════════════════════════════════════════════
// TAGS
// ══════════════════════════════════════════════════════════════

function tagListKey(isGuest: boolean) {
  return [...queryKeys.tags.list(), isGuest ? "guest" : "user"] as const;
}

export function useTags(enabled = true) {
  const { isGuest, isLoading } = useGuest();
  return useQuery({
    queryKey: tagListKey(isGuest),
    enabled,
    queryFn: async () => {
      if (isGuest) return getGuestTags();
      try {
        const data = await fetchJson<{ tags: Tag[] }>("/api/tags");
        return data.tags ?? [];
      } catch {
        return [];
      }
    },
    staleTime: 30_000,
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  const { isGuest } = useGuest();
  const listKey = tagListKey(isGuest);
  return useMutation({
    mutationFn: async (body: TagFormData) => {
      if (isGuest) return addGuestTag(body);
      return postJson<{ tag: Tag }>("/api/tags", body).then((r) => r.tag);
    },
    onMutate: async (body) => {
      if (isGuest) return { previous: undefined };
      await qc.cancelQueries({ queryKey: listKey });
      const previous = qc.getQueryData<Tag[]>(listKey);
      const optimistic: Tag = {
        id: `opt-${Date.now()}`,
        user_id: "",
        name: body.name,
        color: body.color,
        created_at: new Date().toISOString(),
        transaction_count: 0,
      };
      qc.setQueryData<Tag[]>(listKey, (old = []) =>
        [...old, optimistic].sort((a, b) => a.name.localeCompare(b.name))
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => { if (ctx?.previous) qc.setQueryData(listKey, ctx.previous); },
    onSettled: () => void qc.invalidateQueries({ queryKey: queryKeys.tags.all, refetchType: "all" }),
  });
}

export function useUpdateTag() {
  const qc = useQueryClient();
  const { isGuest } = useGuest();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TagFormData> }) => {
      if (isGuest) return { tag: updateGuestTag(id, data) };
      return putJson<{ tag: Tag }>(`/api/tags/${id}`, data);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: queryKeys.tags.all, refetchType: "all" }),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  const { isGuest } = useGuest();
  const listKey = tagListKey(isGuest);
  return useMutation({
    mutationFn: async (id: string) => {
      if (isGuest) { deleteGuestTag(id); return { success: true }; }
      return fetchJson<{ success: boolean }>(`/api/tags/${id}`, { method: "DELETE" });
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: listKey });
      const previous = qc.getQueryData<Tag[]>(listKey);
      qc.setQueryData<Tag[]>(listKey, (old = []) => old.filter((t) => t.id !== id));
      return { previous };
    },
    onError: (_e, _id, ctx) => { if (ctx?.previous) qc.setQueryData(listKey, ctx.previous); },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.tags.all,         refetchType: "all" });
      void qc.invalidateQueries({ queryKey: queryKeys.transactions.all, refetchType: "all" });
    },
  });
}

// ══════════════════════════════════════════════════════════════
// HOUSEHOLD
// ══════════════════════════════════════════════════════════════

interface HouseholdDetailResult {
  household: Household | null;
  role?: HouseholdRole;
  joined_at?: string;
  user_id?: string;
}

interface PendingResult {
  received: HouseholdInvitation[];
  sent: HouseholdInvitation[];
}

export function useHousehold(enabled = true) {
  return useQuery({
    queryKey: queryKeys.household.detail(),
    enabled,
    queryFn: () => fetchJson<HouseholdDetailResult>("/api/household"),
    staleTime: 60_000,
  });
}

export function useHouseholdMembers(enabled = true) {
  return useQuery({
    queryKey: queryKeys.household.members(),
    enabled,
    queryFn: async () => {
      const data = await fetchJson<{ members: HouseholdMember[]; household_id: string }>("/api/household/members");
      return data.members ?? [];
    },
    staleTime: 30_000,
  });
}

export function useHouseholdSummary(enabled = true) {
  return useQuery({
    queryKey: queryKeys.household.summary(),
    enabled,
    queryFn: async () => {
      const data = await fetchJson<{ summary: HouseholdSummary[] }>("/api/household/summary");
      return data.summary ?? [];
    },
    staleTime: 60_000,
  });
}

export function useHouseholdPending(enabled = true) {
  return useQuery({
    queryKey: queryKeys.household.pending(),
    enabled,
    queryFn: () => fetchJson<PendingResult>("/api/household/pending"),
    staleTime: 30_000,
  });
}

const settleHousehold = (qc: QC) =>
  void qc.invalidateQueries({ queryKey: queryKeys.household.all, refetchType: "all" });

export function useCreateHousehold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => postJson<{ household: Household }>("/api/household", { name }),
    onSettled: () => settleHousehold(qc),
  });
}

export function useDeleteHousehold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => fetchJson<{ ok: boolean }>("/api/household", { method: "DELETE" }),
    onSettled: () => settleHousehold(qc),
  });
}

export function useInviteToHousehold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ email, role }: { email: string; role?: string }) =>
      postJson<{ invitation: HouseholdInvitation }>("/api/household/invite", { email, role }),
    onSettled: () =>
      void qc.invalidateQueries({ queryKey: queryKeys.household.pending(), refetchType: "all" }),
  });
}

export function useCancelInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invitation_id: string) =>
      fetchJson<{ ok: boolean }>("/api/household/invite", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitation_id }),
      }),
    onSettled: () =>
      void qc.invalidateQueries({ queryKey: queryKeys.household.pending(), refetchType: "all" }),
  });
}

export function useAcceptInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) =>
      postJson<{ household_id: string }>("/api/household/accept", { token }),
    onSettled: () => settleHousehold(qc),
  });
}

export function useLeaveHousehold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchJson<{ ok: boolean }>("/api/household/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    onSettled: () => settleHousehold(qc),
  });
}

export function useRemoveHouseholdMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (target_user_id: string) =>
      fetchJson<{ ok: boolean }>("/api/household/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_user_id }),
      }),
    onSettled: () => settleHousehold(qc),
  });
}

export function useUpdateHouseholdMemberRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ target_user_id, role }: { target_user_id: string; role: Exclude<HouseholdRole, "owner"> }) =>
      fetchJson<{ member: HouseholdMember }>("/api/household/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_user_id, role }),
      }),
    onSettled: () => settleHousehold(qc),
  });
}
