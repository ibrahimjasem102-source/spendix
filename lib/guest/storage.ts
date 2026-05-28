import { Budget, BudgetFormData, BudgetStatus, BudgetSummary, Transaction, TransactionFormData } from "@/types";
import { GUEST_CATEGORIES } from "./categories";

const GUEST_ID_KEY = "spendix_guest_id";
const GUEST_TX_KEY  = "spendix_guest_transactions";
const GUEST_BUDGET_KEY = "spendix_guest_budgets";

export function getGuestId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(GUEST_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(GUEST_ID_KEY, id);
  }
  return id;
}

export function getGuestTransactions(): Transaction[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(GUEST_TX_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function addGuestTransaction(data: TransactionFormData): Transaction {
  const cat = GUEST_CATEGORIES.find((c) => c.id === data.category_id) ?? null;

  const tx: Transaction = {
    id: crypto.randomUUID(),
    user_id: getGuestId(),
    category_id: data.category_id,
    title: data.title,
    notes: data.notes ?? null,
    amount: data.amount,
    type: data.type,
    source: data.source ?? "manual",
    related_source_id: data.related_source_id ?? null,
    transaction_date: data.transaction_date,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    category: cat ? { id: cat.id, name: cat.name, color: cat.color, icon: cat.icon ?? null } : null,
  };

  const all = getGuestTransactions();
  all.unshift(tx);
  localStorage.setItem(GUEST_TX_KEY, JSON.stringify(all));
  return tx;
}

export function updateGuestTransaction(id: string, data: TransactionFormData): Transaction | null {
  const cat = GUEST_CATEGORIES.find((c) => c.id === data.category_id) ?? null;
  const all = getGuestTransactions();
  const idx = all.findIndex((t) => t.id === id);
  if (idx === -1) return null;

  const updated: Transaction = {
    ...all[idx],
    title: data.title,
    notes: data.notes ?? null,
    amount: data.amount,
    type: data.type,
    category_id: data.category_id,
    transaction_date: data.transaction_date,
    updated_at: new Date().toISOString(),
    category: cat ? { id: cat.id, name: cat.name, color: cat.color, icon: cat.icon ?? null } : null,
  };

  all[idx] = updated;
  localStorage.setItem(GUEST_TX_KEY, JSON.stringify(all));
  return updated;
}

export function deleteGuestTransaction(id: string): void {
  const all = getGuestTransactions().filter((t) => t.id !== id);
  localStorage.setItem(GUEST_TX_KEY, JSON.stringify(all));
}

function getStoredGuestBudgets(): Budget[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(GUEST_BUDGET_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function setStoredGuestBudgets(budgets: Budget[]) {
  localStorage.setItem(GUEST_BUDGET_KEY, JSON.stringify(budgets));
}

function dateInMonth(date: string, month: number, year: number) {
  const parsed = new Date(`${date}T00:00:00`);
  return parsed.getMonth() + 1 === month && parsed.getFullYear() === year;
}

function budgetWithRuntimeStats(budget: Budget, spent: number): Budget {
  const limit = Number(budget.monthly_limit) || 0;
  const percent = limit > 0 ? Math.round((spent / limit) * 100) : 0;
  const status: BudgetStatus = spent > limit ? "over" : percent >= 85 ? "near_limit" : "safe";
  const category = GUEST_CATEGORIES.find((item) => item.id === budget.category_id) ?? null;

  return {
    ...budget,
    monthly_limit: limit,
    category: category ? { id: category.id, name: category.name, color: category.color, icon: category.icon ?? null } : null,
    spent,
    remaining: Math.max(limit - spent, 0),
    percent,
    status,
  };
}

export function getGuestBudgets(month: number, year: number): Budget[] {
  const expenses = getGuestTransactions().filter((tx) => tx.type === "expense" && dateInMonth(tx.transaction_date, month, year));
  const spending = new Map<string, number>();

  expenses.forEach((tx) => {
    if (!tx.category_id) return;
    spending.set(tx.category_id, (spending.get(tx.category_id) ?? 0) + Number(tx.amount));
  });

  return getStoredGuestBudgets()
    .filter((budget) => budget.month === month && budget.year === year)
    .map((budget) => budgetWithRuntimeStats(budget, spending.get(budget.category_id) ?? 0));
}

export function summarizeGuestBudgets(budgets: Budget[]): BudgetSummary {
  return budgets.reduce<BudgetSummary>((summary, budget) => {
    summary.totalBudget += Number(budget.monthly_limit) || 0;
    summary.totalSpent += Number(budget.spent) || 0;
    summary.totalRemaining += Number(budget.remaining) || 0;
    if (budget.status === "over") summary.overBudgetCount += 1;
    if (budget.status === "near_limit") summary.nearLimitCount += 1;
    return summary;
  }, {
    totalBudget: 0,
    totalSpent: 0,
    totalRemaining: 0,
    overBudgetCount: 0,
    nearLimitCount: 0,
  });
}

export function upsertGuestBudget(data: BudgetFormData): Budget {
  const all = getStoredGuestBudgets();
  const existingIndex = all.findIndex((budget) =>
    budget.category_id === data.category_id &&
    budget.month === data.month &&
    budget.year === data.year
  );
  const now = new Date().toISOString();
  const category = GUEST_CATEGORIES.find((item) => item.id === data.category_id) ?? null;
  const base: Budget = {
    id: existingIndex >= 0 ? all[existingIndex].id : crypto.randomUUID(),
    user_id: getGuestId(),
    category_id: data.category_id,
    monthly_limit: Number(data.monthly_limit),
    month: data.month,
    year: data.year,
    created_at: existingIndex >= 0 ? all[existingIndex].created_at : now,
    category: category ? { id: category.id, name: category.name, color: category.color, icon: category.icon ?? null } : null,
    spent: 0,
    remaining: Number(data.monthly_limit),
    percent: 0,
    status: "safe",
  };

  if (existingIndex >= 0) all[existingIndex] = base;
  else all.unshift(base);
  setStoredGuestBudgets(all);
  return base;
}

export function updateGuestBudget(id: string, data: BudgetFormData): Budget | null {
  const all = getStoredGuestBudgets();
  const index = all.findIndex((budget) => budget.id === id);
  if (index === -1) return null;
  const category = GUEST_CATEGORIES.find((item) => item.id === data.category_id) ?? null;
  const updated: Budget = {
    ...all[index],
    category_id: data.category_id,
    monthly_limit: Number(data.monthly_limit),
    month: data.month,
    year: data.year,
    category: category ? { id: category.id, name: category.name, color: category.color, icon: category.icon ?? null } : null,
  };

  all[index] = updated;
  setStoredGuestBudgets(all);
  return updated;
}

export function deleteGuestBudget(id: string): void {
  setStoredGuestBudgets(getStoredGuestBudgets().filter((budget) => budget.id !== id));
}

export function clearGuestData(): void {
  localStorage.removeItem(GUEST_ID_KEY);
  localStorage.removeItem(GUEST_TX_KEY);
  localStorage.removeItem(GUEST_BUDGET_KEY);
}
