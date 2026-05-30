"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addGuestTransaction, deleteGuestBudget, deleteGuestTransaction,
  getGuestBudgets, getGuestTransactions, summarizeGuestBudgets,
  updateGuestBudget, updateGuestTransaction, upsertGuestBudget,
} from "@/lib/guest/storage";
import { GUEST_CATEGORIES } from "@/lib/guest/categories";
import { mockTransactions, mockDebts } from "@/lib/mock-data";
import { queryKeys } from "@/lib/query/keys";
import {
  invalidateDebtQueries,
  invalidateFinancialQueries,
  invalidateInvestmentQueries,
  invalidateWorkQueries,
} from "@/lib/query/invalidation";
import { safeFetch } from "@/lib/fetch-safe";
import { financialBus } from "@/lib/finance/eventBus";
import type {
  Account, AccountFormData,
  Bill, BillFormData, BillPayData,
  CalendarEvent,
  Subscription, SubscriptionFormData,
  AppNotification, Debt, DebtFormData, DebtPaymentFormData,
  Budget, BudgetFormData, BudgetSummary, Category,
  Investment, InvestmentFormData,
  Transaction, TransactionFormData,
  WorkPayment, WorkPaymentFormData, WorkSession, WorkSessionFormData,
} from "@/types";

// ── Shared fetch helper ───────────────────────────────────────
class HttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await safeFetch(url, { ...init, cache: "no-store", signal: controller.signal });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      throw new HttpError(payload?.error || payload?.errorKey || `HTTP ${res.status}`, res.status);
    }
    return payload as T;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw new Error("Request timed out");
    throw err;
  } finally {
    window.clearTimeout(timeout);
  }
}

// ── Shared invalidation helpers ───────────────────────────────
function invalidateFinancial(qc: ReturnType<typeof useQueryClient>) {
  invalidateFinancialQueries(qc);
}

function invalidateDebts(qc: ReturnType<typeof useQueryClient>) {
  invalidateDebtQueries(qc);
}

function invalidateInvestments(qc: ReturnType<typeof useQueryClient>) {
  invalidateInvestmentQueries(qc);
}

function invalidateWork(qc: ReturnType<typeof useQueryClient>) {
  invalidateWorkQueries(qc);
}

// ══════════════════════════════════════════════════════════════
// TRANSACTIONS
// ══════════════════════════════════════════════════════════════

export function useTransactions(isGuest = false, enabled = true) {
  return useQuery({
    queryKey: queryKeys.transactions.list(),
    enabled,
    queryFn: async () => {
      if (isGuest) {
        const g = getGuestTransactions();
        return g.length > 0 ? g : mockTransactions;
      }
      try {
        const data = await fetchJson<{ transactions: Transaction[] }>("/api/transactions");
        return data.transactions ?? [];
      } catch (error) {
        console.warn("[Spendix] Transactions fetch failed", error);
        return [];
      }
    },
    staleTime: isGuest ? Infinity : 30_000,
  });
}

export function useCreateTransaction(isGuest = false) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: TransactionFormData) => {
      if (isGuest) return addGuestTransaction(data);
      const res = await fetchJson<{ transaction: Transaction }>("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.transaction;
    },
    onMutate: async (data) => {
      await qc.cancelQueries({ queryKey: queryKeys.transactions.list() });
      const previous = qc.getQueryData<Transaction[]>(queryKeys.transactions.list());
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
      qc.setQueryData<Transaction[]>(queryKeys.transactions.list(), (old = []) => [optimistic, ...old]);
      return { previous };
    },
    onError: (_e, _d, ctx) => {
      qc.setQueryData(queryKeys.transactions.list(), ctx?.previous ?? []);
    },
    onSuccess: (tx) => {
      qc.setQueryData<Transaction[]>(queryKeys.transactions.list(), (old = []) => [
        tx, ...old.filter((t) => !t.id.startsWith("optimistic-")),
      ]);
      if (!isGuest) financialBus.emit("transaction:added", {
        id: tx.id, amount: tx.amount,
        direction: tx.type === "income" ? "inflow" : "outflow",
      });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.transactions.list() });
      if (!isGuest) invalidateFinancial(qc);
    },
  });
}

export function useUpdateTransaction(isGuest = false) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TransactionFormData }) => {
      if (isGuest) {
        const u = updateGuestTransaction(id, data);
        if (!u) throw new Error("Not found");
        return u;
      }
      const res = await fetchJson<{ transaction: Transaction }>(`/api/transactions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.transaction;
    },
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: queryKeys.transactions.list() });
      const previous = qc.getQueryData<Transaction[]>(queryKeys.transactions.list());
      qc.setQueryData<Transaction[]>(queryKeys.transactions.list(), (old = []) =>
        old.map((t) => t.id === id ? { ...t, ...data, updated_at: new Date().toISOString() } : t)
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(queryKeys.transactions.list(), ctx?.previous ?? []);
    },
    onSuccess: (tx) => {
      qc.setQueryData<Transaction[]>(queryKeys.transactions.list(), (old = []) =>
        old.map((t) => t.id === tx.id ? tx : t)
      );
      if (!isGuest) financialBus.emit("transaction:updated", {
        id: tx.id, amount: tx.amount,
        direction: tx.type === "income" ? "inflow" : "outflow",
      });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.transactions.list() });
      if (!isGuest) invalidateFinancial(qc);
    },
  });
}

export function useDeleteTransaction(isGuest = false) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (isGuest) { deleteGuestTransaction(id); return id; }
      await safeFetch(`/api/transactions/${id}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
      });
      return id;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.transactions.list() });
      const previous = qc.getQueryData<Transaction[]>(queryKeys.transactions.list());
      qc.setQueryData<Transaction[]>(queryKeys.transactions.list(), (old = []) => old.filter((t) => t.id !== id));
      return { previous };
    },
    onError: (_e, _id, ctx) => {
      qc.setQueryData(queryKeys.transactions.list(), ctx?.previous ?? []);
    },
    onSuccess: (id) => {
      if (!isGuest) financialBus.emit("transaction:deleted", { id });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.transactions.list() });
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
  totalBudget: 0,
  totalSpent: 0,
  totalRemaining: 0,
  overBudgetCount: 0,
  nearLimitCount: 0,
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
          categories: GUEST_CATEGORIES.filter((category) => category.type === "expense"),
          summary: summarizeGuestBudgets(budgets),
          period: { month, year, start: "", end: "" },
        };
      }
      const data = await fetchJson<BudgetsQueryResult>(`/api/budgets?month=${month}&year=${year}`);
      return {
        budgets: data.budgets ?? [],
        categories: data.categories ?? [],
        summary: data.summary ?? EMPTY_BUDGET_SUMMARY,
        period: data.period ?? { month, year, start: "", end: "" },
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
      const res = await fetchJson<{ budget: Budget }>("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
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
      const res = await fetchJson<{ budget: Budget }>(`/api/budgets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
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
      if (isGuest) {
        deleteGuestBudget(id);
        return id;
      }
      await safeFetch(`/api/budgets/${id}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
      });
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
        charts: charts.status === "fulfilled" ? charts.value.charts : null,
        debts: debts.status === "fulfilled" ? debts.value.debts : null,
        investments: investments.status === "fulfilled" ? investments.value.investments : null,
        work: work.status === "fulfilled" ? work.value.work : null,
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

export function useDebts(isGuest = false, enabled = true) {
  return useQuery({
    queryKey: queryKeys.debts.list(),
    enabled,
    queryFn: async (): Promise<DebtsQueryResult> => {
      if (isGuest) return {
        debts: mockDebts as unknown as Debt[],
        summary: { totalPayable: 0, totalReceivable: 0, overdueCount: 0, totalDebts: 0, activeDebts: 0 },
        contactsAvailable: false,
      };
      const data = await fetchJson<DebtsQueryResult>("/api/debts");
      return {
        debts: data.debts ?? [],
        summary: data.summary ?? { totalPayable: 0, totalReceivable: 0, overdueCount: 0, totalDebts: 0, activeDebts: 0 },
        contactsAvailable: data.contactsAvailable ?? true,
      };
    },
    staleTime: 30_000,
  });
}

export function useCreateDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: DebtFormData) => {
      const res = await fetchJson<{ debt: Debt }>("/api/debts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.debt;
    },
    onMutate: async (data) => {
      await qc.cancelQueries({ queryKey: queryKeys.debts.list() });
      const previous = qc.getQueryData<Debt[]>(queryKeys.debts.list());
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
      qc.setQueryData<Debt[]>(queryKeys.debts.list(), (old = []) => [optimistic, ...old]);
      return { previous };
    },
    onError: (_e, _d, ctx) => { if (ctx?.previous) qc.setQueryData(queryKeys.debts.list(), ctx.previous); },
    onSuccess: (debt) => {
      qc.setQueryData<Debt[]>(queryKeys.debts.list(), (old = []) => [
        debt, ...old.filter((d) => !d.id.startsWith("optimistic-")),
      ]);
      financialBus.emit("debt:created", {
        debtId: debt.id, amount: debt.total_amount, debtType: debt.debt_type,
      });
    },
    onSettled: () => invalidateDebts(qc),
  });
}

export function useUpdateDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: DebtFormData }) => {
      const res = await fetchJson<{ debt: Debt }>(`/api/debts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.debt;
    },
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: queryKeys.debts.list() });
      const previous = qc.getQueryData<Debt[]>(queryKeys.debts.list());
      qc.setQueryData<Debt[]>(queryKeys.debts.list(), (old = []) =>
        old.map((d) => d.id === id ? { ...d, ...data, updated_at: new Date().toISOString() } : d)
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => { if (ctx?.previous) qc.setQueryData(queryKeys.debts.list(), ctx.previous); },
    onSuccess: (debt) => {
      qc.setQueryData<Debt[]>(queryKeys.debts.list(), (old = []) => old.map((d) => d.id === debt.id ? debt : d));
      financialBus.emit("debt:updated", { debtId: debt.id });
    },
    onSettled: () => invalidateDebts(qc),
  });
}

export function useDeleteDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await safeFetch(`/api/debts/${id}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
      });
      return id;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.debts.list() });
      const previous = qc.getQueryData<Debt[]>(queryKeys.debts.list());
      qc.setQueryData<Debt[]>(queryKeys.debts.list(), (old = []) => old.filter((d) => d.id !== id));
      return { previous };
    },
    onError: (_e, _id, ctx) => { if (ctx?.previous) qc.setQueryData(queryKeys.debts.list(), ctx.previous); },
    onSuccess: (id) => {
      financialBus.emit("debt:deleted", { debtId: id });
    },
    onSettled: () => invalidateDebts(qc),
  });
}

export function useCreateDebtPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ debtId, data }: { debtId: string; data: DebtPaymentFormData }) => {
      const res = await fetchJson<{ debt: Debt }>(`/api/debts/${debtId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.debt;
    },
    onSuccess: (updatedDebt) => {
      qc.setQueryData<Debt[]>(queryKeys.debts.list(), (old = []) =>
        old.map((d) => d.id === updatedDebt.id ? updatedDebt : d)
      );
      financialBus.emit("debt:payment_recorded", {
        debtId: updatedDebt.id,
        amount: updatedDebt.paid_amount,
        debtType: updatedDebt.debt_type,
      });
    },
    onSettled: () => invalidateDebts(qc),
  });
}

// ══════════════════════════════════════════════════════════════
// INVESTMENTS
// ══════════════════════════════════════════════════════════════

export function useInvestments(enabled = true) {
  return useQuery({
    queryKey: queryKeys.investments.list(),
    enabled,
    queryFn: async () => {
      const data = await fetchJson<{ investments: Investment[] }>("/api/investments");
      return data.investments ?? [];
    },
    staleTime: 30_000,
  });
}

export function usePortfolioHistory(enabled = true) {
  return useQuery({
    queryKey: queryKeys.investments.portfolioHistory(),
    enabled,
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
  return useMutation({
    mutationFn: async (data: InvestmentFormData) => {
      const res = await fetchJson<{ investment: Investment }>("/api/investments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.investment;
    },
    onMutate: async (data) => {
      await qc.cancelQueries({ queryKey: queryKeys.investments.list() });
      const previous = qc.getQueryData<Investment[]>(queryKeys.investments.list());
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
      qc.setQueryData<Investment[]>(queryKeys.investments.list(), (old = []) => [optimistic, ...old]);
      return { previous };
    },
    onError: (_e, _d, ctx) => { if (ctx?.previous) qc.setQueryData(queryKeys.investments.list(), ctx.previous); },
    onSuccess: (inv) => {
      qc.setQueryData<Investment[]>(queryKeys.investments.list(), (old = []) => [
        inv, ...old.filter((i) => !i.id.startsWith("optimistic-")),
      ]);
      financialBus.emit("investment:added", { id: inv.id, amount: inv.amount_invested });
    },
    onSettled: () => invalidateInvestments(qc),
  });
}

export function useUpdateInvestment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: InvestmentFormData }) => {
      const res = await fetchJson<{ investment: Investment }>(`/api/investments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.investment;
    },
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: queryKeys.investments.list() });
      const previous = qc.getQueryData<Investment[]>(queryKeys.investments.list());
      qc.setQueryData<Investment[]>(queryKeys.investments.list(), (old = []) =>
        old.map((i) => i.id === id ? { ...i, ...data, updated_at: new Date().toISOString() } : i)
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => { if (ctx?.previous) qc.setQueryData(queryKeys.investments.list(), ctx.previous); },
    onSuccess: (inv) => {
      qc.setQueryData<Investment[]>(queryKeys.investments.list(), (old = []) =>
        old.map((i) => i.id === inv.id ? inv : i)
      );
      financialBus.emit("investment:updated", {
        id: inv.id,
        previousValue: inv.amount_invested,
        currentValue:  inv.current_value ?? inv.amount_invested,
      });
    },
    onSettled: () => invalidateInvestments(qc),
  });
}

export function useDeleteInvestment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await safeFetch(`/api/investments/${id}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
      });
      return id;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.investments.list() });
      const previous = qc.getQueryData<Investment[]>(queryKeys.investments.list());
      qc.setQueryData<Investment[]>(queryKeys.investments.list(), (old = []) => old.filter((i) => i.id !== id));
      return { previous };
    },
    onError: (_e, _id, ctx) => { if (ctx?.previous) qc.setQueryData(queryKeys.investments.list(), ctx.previous); },
    onSuccess: (id) => {
      financialBus.emit("investment:deleted", { id });
    },
    onSettled: () => invalidateInvestments(qc),
  });
}

// ══════════════════════════════════════════════════════════════
// WORK
// ══════════════════════════════════════════════════════════════

export function useWorkSessions(enabled = true) {
  return useQuery({
    queryKey: queryKeys.work.sessions(),
    enabled,
    queryFn: async () => {
      const data = await fetchJson<{ sessions: WorkSession[] }>("/api/work/sessions");
      return data.sessions ?? [];
    },
    staleTime: 30_000,
  });
}

export function useWorkPayments(enabled = true) {
  return useQuery({
    queryKey: queryKeys.work.payments(),
    enabled,
    queryFn: async () => {
      const data = await fetchJson<{ payments: WorkPayment[] }>("/api/work/payments");
      return data.payments ?? [];
    },
    staleTime: 30_000,
  });
}

export function useCreateWorkSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: WorkSessionFormData) => {
      const res = await fetchJson<{ session: WorkSession }>("/api/work/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.session;
    },
    onMutate: async (data) => {
      await qc.cancelQueries({ queryKey: queryKeys.work.sessions() });
      const previous = qc.getQueryData<WorkSession[]>(queryKeys.work.sessions());
      const optimistic: WorkSession = {
        id: `optimistic-${Date.now()}`,
        user_id: "optimistic",
        title: data.title,
        employer_or_client: data.employer_or_client,
        hourly_rate: data.hourly_rate,
        hours_worked: data.hours_worked,
        expected_amount: data.hourly_rate * data.hours_worked,
        work_date: data.work_date,
        notes: data.notes ?? null,
        recurrence: data.recurrence,
        recurrence_end_date: data.recurrence_end_date ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      qc.setQueryData<WorkSession[]>(queryKeys.work.sessions(), (old = []) => [optimistic, ...old]);
      return { previous };
    },
    onError: (_e, _d, ctx) => { if (ctx?.previous) qc.setQueryData(queryKeys.work.sessions(), ctx.previous); },
    onSuccess: (session) => {
      qc.setQueryData<WorkSession[]>(queryKeys.work.sessions(), (old = []) => [
        session, ...old.filter((s) => !s.id.startsWith("optimistic-")),
      ]);
      financialBus.emit("work:session_logged", { hours: session.hours_worked });
    },
    onSettled: () => invalidateWork(qc),
  });
}

export function useUpdateWorkSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: WorkSessionFormData }) => {
      const res = await fetchJson<{ session: WorkSession }>(`/api/work/sessions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.session;
    },
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: queryKeys.work.sessions() });
      const previous = qc.getQueryData<WorkSession[]>(queryKeys.work.sessions());
      qc.setQueryData<WorkSession[]>(queryKeys.work.sessions(), (old = []) =>
        old.map((s) => s.id === id ? { ...s, ...data, updated_at: new Date().toISOString() } : s)
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => { if (ctx?.previous) qc.setQueryData(queryKeys.work.sessions(), ctx.previous); },
    onSuccess: (session) => {
      qc.setQueryData<WorkSession[]>(queryKeys.work.sessions(), (old = []) =>
        old.map((s) => s.id === session.id ? session : s)
      );
      financialBus.emit("work:session_updated", { id: session.id });
    },
    onSettled: () => invalidateWork(qc),
  });
}

export function useDeleteWorkSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await safeFetch(`/api/work/sessions/${id}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
      });
      return id;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.work.sessions() });
      const previous = qc.getQueryData<WorkSession[]>(queryKeys.work.sessions());
      qc.setQueryData<WorkSession[]>(queryKeys.work.sessions(), (old = []) => old.filter((s) => s.id !== id));
      return { previous };
    },
    onError: (_e, _id, ctx) => { if (ctx?.previous) qc.setQueryData(queryKeys.work.sessions(), ctx.previous); },
    onSuccess: (id) => {
      financialBus.emit("work:session_deleted", { id });
    },
    onSettled: () => invalidateWork(qc),
  });
}

export function useCreateWorkPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: WorkPaymentFormData) => {
      const res = await fetchJson<{ payment: WorkPayment }>("/api/work/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.payment;
    },
    onMutate: async (data) => {
      await qc.cancelQueries({ queryKey: queryKeys.work.payments() });
      const previous = qc.getQueryData<WorkPayment[]>(queryKeys.work.payments());
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
      qc.setQueryData<WorkPayment[]>(queryKeys.work.payments(), (old = []) => [optimistic, ...old]);
      return { previous };
    },
    onError: (_e, _d, ctx) => { if (ctx?.previous) qc.setQueryData(queryKeys.work.payments(), ctx.previous); },
    onSuccess: (payment) => {
      qc.setQueryData<WorkPayment[]>(queryKeys.work.payments(), (old = []) => [
        payment, ...old.filter((p) => !p.id.startsWith("optimistic-")),
      ]);
      financialBus.emit("work:payment_received", { amount: payment.amount });
    },
    onSettled: () => invalidateWork(qc),
  });
}

export function useUpdateWorkPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: WorkPaymentFormData }) => {
      const res = await fetchJson<{ payment: WorkPayment }>(`/api/work/payments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.payment;
    },
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: queryKeys.work.payments() });
      const previous = qc.getQueryData<WorkPayment[]>(queryKeys.work.payments());
      qc.setQueryData<WorkPayment[]>(queryKeys.work.payments(), (old = []) =>
        old.map((p) => p.id === id ? { ...p, ...data, id } : p)
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => { if (ctx?.previous) qc.setQueryData(queryKeys.work.payments(), ctx.previous); },
    onSettled: () => invalidateWork(qc),
  });
}

export function useDeleteWorkPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await safeFetch(`/api/work/payments/${id}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
      });
      return id;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.work.payments() });
      const previous = qc.getQueryData<WorkPayment[]>(queryKeys.work.payments());
      qc.setQueryData<WorkPayment[]>(queryKeys.work.payments(), (old = []) => old.filter((p) => p.id !== id));
      return { previous };
    },
    onError: (_e, _id, ctx) => { if (ctx?.previous) qc.setQueryData(queryKeys.work.payments(), ctx.previous); },
    onSuccess: (id) => {
      financialBus.emit("work:payment_deleted", { id });
    },
    onSettled: () => invalidateWork(qc),
  });
}

// ══════════════════════════════════════════════════════════════
// ACCOUNTS
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

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AccountFormData) =>
      fetchJson<{ account: Account }>("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: ({ account }) => {
      financialBus.emit("account:created", { id: account.id, name: account.name });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.accounts.all, refetchType: "all" });
    },
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AccountFormData> }) =>
      fetchJson<{ account: Account }>(`/api/accounts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { id }) => {
      financialBus.emit("account:updated", { id });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.accounts.all, refetchType: "all" });
    },
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await safeFetch(`/api/accounts/${id}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
      });
      return id;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.accounts.all });
      const previous = qc.getQueryData<Account[]>(queryKeys.accounts.list());
      qc.setQueryData<Account[]>(queryKeys.accounts.list(), (old = []) => old.filter((a) => a.id !== id));
      return { previous };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.accounts.list(), ctx.previous);
    },
    onSuccess: (id) => {
      financialBus.emit("account:deleted", { id });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.accounts.all, refetchType: "all" });
    },
  });
}

// ══════════════════════════════════════════════════════════════
// BILLS
// ══════════════════════════════════════════════════════════════

export function useBills(enabled = true) {
  return useQuery({
    queryKey: queryKeys.bills.list(),
    enabled,
    queryFn: async () => {
      try {
        const data = await fetchJson<{ bills: Bill[] }>("/api/bills");
        return data.bills ?? [];
      } catch (error) {
        console.warn("[Spendix] Bills fetch failed", error);
        return [];
      }
    },
    staleTime: 30_000,
  });
}

export function useCreateBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BillFormData) =>
      fetchJson<{ bill: Bill }>("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: ({ bill }) => {
      financialBus.emit("bill:created", { id: bill.id, name: bill.name });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.bills.all, refetchType: "all" });
    },
  });
}

export function useUpdateBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BillFormData> }) =>
      fetchJson<{ bill: Bill }>(`/api/bills/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { id }) => {
      financialBus.emit("bill:updated", { id });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.bills.all, refetchType: "all" });
    },
  });
}

export function useDeleteBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await safeFetch(`/api/bills/${id}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
      });
      return id;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.bills.all });
      const previous = qc.getQueryData<Bill[]>(queryKeys.bills.list());
      qc.setQueryData<Bill[]>(queryKeys.bills.list(), (old = []) => old.filter((b) => b.id !== id));
      return { previous };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.bills.list(), ctx.previous);
    },
    onSuccess: (id) => {
      financialBus.emit("bill:deleted", { id });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.bills.all, refetchType: "all" });
    },
  });
}

export function usePayBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: BillPayData }) =>
      fetchJson<{ success: boolean; transaction_id: string }>(`/api/bills/${id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { id }) => {
      const bills = qc.getQueryData<Bill[]>(queryKeys.bills.list()) ?? [];
      const bill  = bills.find((b) => b.id === id);
      if (bill) financialBus.emit("bill:paid", { id, name: bill.name, amount: bill.amount ?? 0 });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.bills.all, refetchType: "all" });
      void qc.invalidateQueries({ queryKey: queryKeys.transactions.all, refetchType: "all" });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard.all, refetchType: "all" });
      void qc.invalidateQueries({ queryKey: queryKeys.budgets.all, refetchType: "all" });
    },
  });
}

// ══════════════════════════════════════════════════════════════
// SUBSCRIPTIONS
// ══════════════════════════════════════════════════════════════

export function useSubscriptions(enabled = true) {
  return useQuery({
    queryKey: queryKeys.subscriptions.list(),
    enabled,
    queryFn: async () => {
      try {
        const data = await fetchJson<{ subscriptions: Subscription[] }>("/api/subscriptions");
        return data.subscriptions ?? [];
      } catch (error) {
        console.warn("[Spendix] Subscriptions fetch failed", error);
        return [];
      }
    },
    staleTime: 30_000,
  });
}

export function useCreateSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SubscriptionFormData) =>
      fetchJson<{ subscription: Subscription }>("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: ({ subscription }) => {
      financialBus.emit("subscription:created", { id: subscription.id, name: subscription.name, amount: subscription.amount });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.subscriptions.all, refetchType: "all" });
    },
  });
}

export function useUpdateSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SubscriptionFormData> }) =>
      fetchJson<{ subscription: Subscription }>(`/api/subscriptions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { id }) => {
      financialBus.emit("subscription:updated", { id });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.subscriptions.all, refetchType: "all" });
    },
  });
}

export function useDeleteSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await safeFetch(`/api/subscriptions/${id}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
      });
      return id;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.subscriptions.all });
      const previous = qc.getQueryData<Subscription[]>(queryKeys.subscriptions.list());
      qc.setQueryData<Subscription[]>(queryKeys.subscriptions.list(), (old = []) => old.filter((s) => s.id !== id));
      return { previous };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.subscriptions.list(), ctx.previous);
    },
    onSuccess: (id) => {
      financialBus.emit("subscription:deleted", { id });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.subscriptions.all, refetchType: "all" });
    },
  });
}

// ══════════════════════════════════════════════════════════════
// CALENDAR
// ══════════════════════════════════════════════════════════════

export function useCalendar(year: number, month: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.calendar.byMonth(year, month),
    enabled,
    queryFn: async () => {
      try {
        const data = await fetchJson<{ events: CalendarEvent[] }>(
          `/api/calendar?year=${year}&month=${month}`
        );
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
  return useQuery({
    queryKey: queryKeys.notifications.list(),
    enabled,
    queryFn: async () => {
      const data = await fetchJson<{ notifications: AppNotification[]; unreadCount: number }>("/api/notifications");
      return data;
    },
    staleTime: 15_000,
  });
}
