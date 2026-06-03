import {
  Budget,
  BudgetFormData,
  BudgetStatus,
  BudgetSummary,
  Category,
  ContactFormData,
  Debt,
  DebtFormData,
  DebtPaymentFormData,
  DebtStatus,
  FinancialContact,
  Goal,
  GoalFormData,
  GoalStatus,
  Investment,
  InvestmentFormData,
  Subscription,
  SubscriptionFormData,
  Tag,
  TagFormData,
  Transaction,
  TransactionFormData,
  WorkSession,
  WorkSessionFormData,
  WorkPayment,
  WorkPaymentFormData,
} from "@/types";
import { GUEST_CATEGORIES } from "./categories";

const GUEST_ID_KEY = "spendix_guest_id";
const GUEST_TX_KEY  = "spendix_guest_transactions";
const GUEST_BUDGET_KEY = "spendix_guest_budgets";
const GUEST_GOAL_KEY = "spendix_guest_goals";
const GUEST_CONTACT_KEY = "spendix_guest_contacts";
const GUEST_CATEGORY_KEY = "spendix_guest_categories";
const GUEST_HIDDEN_CATEGORY_KEY = "spendix_guest_hidden_categories";
const GUEST_TAG_KEY = "spendix_guest_tags";
const GUEST_INVESTMENT_KEY    = "spendix_guest_investments";
const GUEST_DEBT_KEY          = "spendix_guest_debts";
const GUEST_WORK_SESSION_KEY  = "spendix_guest_work_sessions";
const GUEST_WORK_PAYMENT_KEY  = "spendix_guest_work_payments";
const GUEST_SUBSCRIPTION_KEY  = "spendix_guest_subscriptions";
const LEGACY_GOAL_KEY         = "spendix_financial_goals";

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
  const cat = getGuestCategories().find((c) => c.id === data.category_id) ?? null;

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
  const cat = getGuestCategories().find((c) => c.id === data.category_id) ?? null;
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
    source: data.source ?? all[idx].source ?? "manual",
    related_source_id: data.related_source_id ?? all[idx].related_source_id ?? null,
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
  const category = getGuestCategories().find((item) => item.id === budget.category_id) ?? null;

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
  const category = getGuestCategories().find((item) => item.id === data.category_id) ?? null;
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
  const category = getGuestCategories().find((item) => item.id === data.category_id) ?? null;
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

export type GuestCategoryFormData = {
  name: string;
  type: "income" | "expense";
  color: string;
  icon?: string | null;
  section?: Category["section"];
  parent_id?: string | null;
};

function getStoredGuestCategories(): Category[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(GUEST_CATEGORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function setStoredGuestCategories(categories: Category[]) {
  localStorage.setItem(GUEST_CATEGORY_KEY, JSON.stringify(categories));
}

function getHiddenGuestCategoryIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const hidden = JSON.parse(localStorage.getItem(GUEST_HIDDEN_CATEGORY_KEY) ?? "[]");
    return Array.isArray(hidden) ? hidden.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function setHiddenGuestCategoryIds(ids: string[]) {
  localStorage.setItem(GUEST_HIDDEN_CATEGORY_KEY, JSON.stringify(Array.from(new Set(ids))));
}

function normalizeGuestCategory(data: GuestCategoryFormData, existing?: Category): Category {
  return {
    id: existing?.id ?? crypto.randomUUID(),
    user_id: existing?.user_id ?? getGuestId(),
    name: data.name.trim(),
    type: data.type === "income" ? "income" : "expense",
    color: data.color || "#6B7280",
    icon: data.icon ?? "MoreHorizontal",
    section: data.section ?? data.type,
    parent_id: data.parent_id ?? null,
    created_at: existing?.created_at ?? new Date().toISOString(),
  };
}

export function getGuestCategories(): Category[] {
  const custom = getStoredGuestCategories();
  const hidden = new Set(getHiddenGuestCategoryIds());
  const byId = new Map<string, Category>();
  GUEST_CATEGORIES
    .filter((category) => !hidden.has(category.id))
    .forEach((category) => byId.set(category.id, category));
  custom.forEach((category) => byId.set(category.id, category));
  return Array.from(byId.values()).sort((a, b) =>
    (a.section ?? a.type).localeCompare(b.section ?? b.type) ||
    a.type.localeCompare(b.type) ||
    (a.parent_id ?? "").localeCompare(b.parent_id ?? "") ||
    a.name.localeCompare(b.name)
  );
}

export function addGuestCategory(data: GuestCategoryFormData): Category {
  const category = normalizeGuestCategory(data);
  const all = [...getStoredGuestCategories(), category];
  setStoredGuestCategories(all);
  return category;
}

export function updateGuestCategory(id: string, data: GuestCategoryFormData): Category | null {
  const all = getStoredGuestCategories();
  const index = all.findIndex((category) => category.id === id);
  if (index === -1) return null;
  const updated = normalizeGuestCategory(data, all[index]);
  all[index] = updated;
  setStoredGuestCategories(all);
  return updated;
}

export function deleteGuestCategory(id: string): void {
  setStoredGuestCategories(
    getStoredGuestCategories()
      .filter((category) => category.id !== id)
      .map((category) => category.parent_id === id ? { ...category, parent_id: null } : category)
  );
  if (GUEST_CATEGORIES.some((category) => category.id === id)) {
    setHiddenGuestCategoryIds([...getHiddenGuestCategoryIds(), id]);
  }
}

function getStoredGuestContacts(): FinancialContact[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(GUEST_CONTACT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function setStoredGuestContacts(contacts: FinancialContact[]) {
  localStorage.setItem(GUEST_CONTACT_KEY, JSON.stringify(contacts));
}

function normalizeGuestContact(data: ContactFormData, existing?: FinancialContact): FinancialContact {
  const now = new Date().toISOString();
  return {
    id: existing?.id ?? crypto.randomUUID(),
    user_id: existing?.user_id ?? getGuestId(),
    name: data.name.trim(),
    type: data.type ?? "person",
    phone: data.phone?.trim() || null,
    email: data.email?.trim() || null,
    notes: data.notes?.trim() || null,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
}

export function getGuestContacts(): FinancialContact[] {
  return getStoredGuestContacts().sort((a, b) => a.name.localeCompare(b.name));
}

export function addGuestContact(data: ContactFormData): FinancialContact {
  const contact = normalizeGuestContact(data);
  const all = [...getStoredGuestContacts(), contact].sort((a, b) => a.name.localeCompare(b.name));
  setStoredGuestContacts(all);
  return contact;
}

export function updateGuestContact(id: string, data: ContactFormData): FinancialContact | null {
  const all = getStoredGuestContacts();
  const index = all.findIndex((contact) => contact.id === id);
  if (index === -1) return null;

  const updated = normalizeGuestContact(data, all[index]);
  all[index] = updated;
  setStoredGuestContacts(all.sort((a, b) => a.name.localeCompare(b.name)));
  return updated;
}

export function deleteGuestContact(id: string): void {
  setStoredGuestContacts(getStoredGuestContacts().filter((contact) => contact.id !== id));
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function getStoredGuestGoals(): Goal[] {
  if (typeof window === "undefined") return [];
  try {
    const storedRaw = localStorage.getItem(GUEST_GOAL_KEY);
    if (storedRaw !== null) {
      const stored = JSON.parse(storedRaw) as Goal[];
      return Array.isArray(stored) ? stored : [];
    }

    const legacy = JSON.parse(localStorage.getItem(LEGACY_GOAL_KEY) ?? "[]") as Array<{
      id?: string;
      title?: string;
      targetAmount?: number;
      savedAmount?: number;
      monthlyContribution?: number;
      dueDate?: string;
      category?: Goal["category"];
    }>;
    if (!Array.isArray(legacy) || legacy.length === 0) return [];

    const now = new Date().toISOString();
    const migrated = legacy
      .filter((goal) => goal?.title)
      .map((goal): Goal => enrichGuestGoal({
        id: goal.id ?? crypto.randomUUID(),
        user_id: getGuestId(),
        title: String(goal.title ?? "").trim(),
        target_amount: Math.max(0, Number(goal.targetAmount) || 0),
        saved_amount: Math.max(0, Number(goal.savedAmount) || 0),
        monthly_contribution: Math.max(0, Number(goal.monthlyContribution) || 0),
        due_date: goal.dueDate ?? null,
        category: goal.category ?? "other",
        tracking_type: "manual",
        linked_debt_id: null,
        start_date: todayStr(),
        notes: null,
        color: null,
        completed_at: null,
        created_at: now,
        updated_at: now,
        computed_saved: 0,
        progress: 0,
        remaining: 0,
        status: "on_track",
        days_until_due: null,
      }));

    setStoredGuestGoals(migrated);
    localStorage.removeItem(LEGACY_GOAL_KEY);
    return migrated;
  } catch {
    return [];
  }
}

function setStoredGuestGoals(goals: Goal[]) {
  localStorage.setItem(GUEST_GOAL_KEY, JSON.stringify(goals));
  localStorage.removeItem(LEGACY_GOAL_KEY);
}

function computeGuestGoalStatus(goal: Pick<Goal, "target_amount" | "due_date" | "completed_at">, computedSaved: number): GoalStatus {
  if (goal.completed_at) return "completed";
  const remaining = Math.max(0, Number(goal.target_amount) - computedSaved);
  if (remaining <= 0) return "completed";
  if (!goal.due_date) return "on_track";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${goal.due_date}T00:00:00`);
  const daysLeft = Math.ceil((due.getTime() - today.getTime()) / 86_400_000);

  if (daysLeft < 0) return "overdue";
  if (daysLeft <= 30) return "due_soon";
  return "on_track";
}

function computeGuestGoalProgress(goal: Goal): number {
  const savedAmount = Number(goal.saved_amount) || 0;
  const startDate = goal.start_date || "2000-01-01";

  if (goal.tracking_type === "income" || goal.tracking_type === "savings") {
    const transactions = getGuestTransactions().filter((tx) => tx.transaction_date >= startDate);

    if (goal.tracking_type === "income") {
      return transactions
        .filter((tx) => tx.type === "income")
        .reduce((sum, tx) => sum + Number(tx.amount), 0);
    }

    const net = transactions.reduce(
      (sum, tx) => tx.type === "income" ? sum + Number(tx.amount) : sum - Number(tx.amount),
      0,
    );
    return Math.max(0, net);
  }

  return savedAmount;
}

function enrichGuestGoal(goal: Goal): Goal {
  const targetAmount = Number(goal.target_amount) || 0;
  const savedAmount = Math.max(0, Number(goal.saved_amount) || 0);
  const liveComputedSaved = Math.max(0, computeGuestGoalProgress({ ...goal, saved_amount: savedAmount, target_amount: targetAmount }));
  const completedAt = goal.completed_at ?? (targetAmount > 0 && liveComputedSaved >= targetAmount ? new Date().toISOString() : null);
  const computedSaved = completedAt ? Math.max(liveComputedSaved, targetAmount) : liveComputedSaved;
  const progress = targetAmount > 0 ? Math.min(100, Math.round((computedSaved / targetAmount) * 100)) : 0;
  const remaining = Math.max(0, targetAmount - computedSaved);

  let daysUntilDue: number | null = null;
  if (goal.due_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(`${goal.due_date}T00:00:00`);
    daysUntilDue = Math.ceil((due.getTime() - today.getTime()) / 86_400_000);
  }

  const milestones = (goal.milestones ?? [])
    .slice()
    .sort((a, b) => a.amount - b.amount)
    .map((m) => ({ ...m, reached: computedSaved >= m.amount }));

  return {
    ...goal,
    target_amount: targetAmount,
    saved_amount: savedAmount,
    monthly_contribution: Math.max(0, Number(goal.monthly_contribution) || 0),
    due_date: goal.due_date ?? null,
    tracking_type: goal.tracking_type ?? "manual",
    start_date: goal.start_date || todayStr(),
    notes: goal.notes ?? null,
    color: goal.color ?? null,
    milestones,
    completed_at: completedAt,
    computed_saved: computedSaved,
    progress,
    remaining,
    status: computeGuestGoalStatus({ target_amount: targetAmount, due_date: goal.due_date ?? null, completed_at: completedAt }, computedSaved),
    days_until_due: daysUntilDue,
  };
}

function goalFromForm(data: GoalFormData, existing?: Goal): Goal {
  const now = new Date().toISOString();
  const raw: Goal = {
    id: existing?.id ?? crypto.randomUUID(),
    user_id: existing?.user_id ?? getGuestId(),
    title: data.title.trim(),
    target_amount: Math.max(0, Number(data.target_amount) || 0),
    saved_amount: Math.max(0, Number(data.saved_amount) || 0),
    monthly_contribution: Math.max(0, Number(data.monthly_contribution) || 0),
    due_date: data.due_date ?? null,
    category: data.category ?? "other",
    tracking_type: data.tracking_type ?? "manual",
    linked_debt_id: data.linked_debt_id ?? null,
    start_date: data.start_date || existing?.start_date || todayStr(),
    notes: data.notes ?? null,
    color: data.color ?? null,
    milestones: data.milestones ?? existing?.milestones ?? [],
    completed_at: existing?.completed_at ?? null,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    computed_saved: 0,
    progress: 0,
    remaining: 0,
    status: "on_track",
    days_until_due: null,
  };

  return enrichGuestGoal(raw);
}

export function getGuestGoals(): Goal[] {
  return getStoredGuestGoals()
    .map(enrichGuestGoal)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function addGuestGoal(data: GoalFormData): Goal {
  const goal = goalFromForm(data);
  const all = getStoredGuestGoals();
  all.unshift(goal);
  setStoredGuestGoals(all);
  return goal;
}

export function updateGuestGoal(id: string, data: GoalFormData): Goal | null {
  const all = getStoredGuestGoals();
  const index = all.findIndex((goal) => goal.id === id);
  if (index === -1) return null;

  const updated = goalFromForm(data, all[index]);
  all[index] = updated;
  setStoredGuestGoals(all);
  return updated;
}

export function deleteGuestGoal(id: string): void {
  setStoredGuestGoals(getStoredGuestGoals().filter((goal) => goal.id !== id));
}

export function contributeGuestGoal(id: string, amount: number): { success: boolean; new_saved: number; completed: boolean; completed_at?: string | null } | null {
  const all = getStoredGuestGoals();
  const index = all.findIndex((goal) => goal.id === id);
  if (index === -1) return null;
  if (all[index].tracking_type !== "manual") return null;

  const addAmount = Math.max(0, Number(amount) || 0);
  const newSaved = Math.min(Number(all[index].target_amount) || 0, (Number(all[index].saved_amount) || 0) + addAmount);
  const updated = enrichGuestGoal({
    ...all[index],
    saved_amount: newSaved,
    updated_at: new Date().toISOString(),
  });

  all[index] = updated;
  setStoredGuestGoals(all);
  return { success: true, new_saved: newSaved, completed: updated.status === "completed", completed_at: updated.completed_at };
}

// ── Guest Tags ────────────────────────────────────────────────

export function getGuestTags(): Tag[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(GUEST_TAG_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function setGuestTags(tags: Tag[]) {
  localStorage.setItem(GUEST_TAG_KEY, JSON.stringify(tags));
}

export function addGuestTag(data: TagFormData): Tag {
  const tag: Tag = {
    id: crypto.randomUUID(),
    user_id: getGuestId(),
    name: data.name.trim(),
    color: data.color ?? "#06B6D4",
    created_at: new Date().toISOString(),
    transaction_count: 0,
  };
  const all = getGuestTags();
  all.push(tag);
  setGuestTags(all.sort((a, b) => a.name.localeCompare(b.name)));
  return tag;
}

export function updateGuestTag(id: string, data: Partial<TagFormData>): Tag | null {
  const all = getGuestTags();
  const idx = all.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  const updated = { ...all[idx], ...(data.name !== undefined ? { name: data.name.trim() } : {}), ...(data.color !== undefined ? { color: data.color } : {}) };
  all[idx] = updated;
  setGuestTags(all.sort((a, b) => a.name.localeCompare(b.name)));
  return updated;
}

export function deleteGuestTag(id: string): void {
  setGuestTags(getGuestTags().filter((t) => t.id !== id));
  // Remove tag from all transactions
  const txs = getGuestTransactions();
  const updated = txs.map((tx) => ({ ...tx, tags: (tx.tags ?? []).filter((tg) => tg.id !== id) }));
  localStorage.setItem(GUEST_TX_KEY, JSON.stringify(updated));
}

// ── Guest Investments ─────────────────────────────────────────

function getStoredGuestInvestments(): Investment[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(GUEST_INVESTMENT_KEY) ?? "[]");
  } catch { return []; }
}

function setStoredGuestInvestments(items: Investment[]) {
  localStorage.setItem(GUEST_INVESTMENT_KEY, JSON.stringify(items));
}

export function getGuestInvestments(): Investment[] {
  return getStoredGuestInvestments().sort((a, b) => b.investment_date.localeCompare(a.investment_date));
}

export function addGuestInvestment(data: InvestmentFormData): Investment {
  const now = new Date().toISOString();
  const inv: Investment = {
    id: crypto.randomUUID(),
    user_id: getGuestId(),
    asset_name: data.asset_name,
    asset_type: data.asset_type,
    amount_invested: data.amount_invested,
    current_value: data.current_value ?? null,
    investment_date: data.investment_date,
    notes: data.notes ?? null,
    transaction_id: null,
    created_at: now,
    updated_at: now,
  };
  const all = getStoredGuestInvestments();
  all.unshift(inv);
  setStoredGuestInvestments(all);
  return inv;
}

export function updateGuestInvestment(id: string, data: InvestmentFormData): Investment | null {
  const all = getStoredGuestInvestments();
  const idx = all.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  const updated: Investment = {
    ...all[idx],
    asset_name: data.asset_name,
    asset_type: data.asset_type,
    amount_invested: data.amount_invested,
    current_value: data.current_value ?? null,
    investment_date: data.investment_date,
    notes: data.notes ?? null,
    updated_at: new Date().toISOString(),
  };
  all[idx] = updated;
  setStoredGuestInvestments(all);
  return updated;
}

export function deleteGuestInvestment(id: string): void {
  setStoredGuestInvestments(getStoredGuestInvestments().filter((i) => i.id !== id));
}

// ── Guest Debts ───────────────────────────────────────────────

function computeGuestDebtStatus(
  total: number,
  paid: number,
  dueDate: string | null,
): DebtStatus {
  if (total > 0 && paid >= total) return "paid";
  if (!dueDate) return paid > 0 ? "partially_paid" : "active";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dueDate}T00:00:00`);
  if (due < today && paid < total) return "overdue";
  return paid > 0 ? "partially_paid" : "active";
}

function enrichGuestDebt(debt: Debt): Debt {
  const total = Number(debt.total_amount);
  const paid = Number(debt.paid_amount);
  const remaining = Math.max(0, total - paid);
  const status = computeGuestDebtStatus(total, paid, debt.due_date);
  const progress = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

  let overdueDays: number | undefined;
  if (debt.due_date && status === "overdue") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(`${debt.due_date}T00:00:00`);
    overdueDays = Math.ceil((today.getTime() - due.getTime()) / 86_400_000);
  }

  return {
    ...debt,
    status,
    remaining_amount: remaining,
    progress,
    overdueDays,
    paymentsCount: (debt.payments ?? []).length,
  };
}

function getStoredGuestDebts(): Debt[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(GUEST_DEBT_KEY) ?? "[]");
  } catch { return []; }
}

function setStoredGuestDebts(debts: Debt[]) {
  localStorage.setItem(GUEST_DEBT_KEY, JSON.stringify(debts));
}

export function getGuestDebts(): Debt[] {
  return getStoredGuestDebts()
    .map(enrichGuestDebt)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function addGuestDebt(data: DebtFormData): Debt {
  const now = new Date().toISOString();
  const raw: Debt = {
    id: crypto.randomUUID(),
    user_id: getGuestId(),
    person_or_entity: data.person_or_entity,
    debt_type: data.debt_type,
    total_amount: data.total_amount,
    paid_amount: 0,
    due_date: data.due_date ?? null,
    status: "active",
    notes: data.notes ?? null,
    contact_id: data.contact_id ?? null,
    payments: [],
    created_at: now,
    updated_at: now,
  };
  const debt = enrichGuestDebt(raw);
  const all = getStoredGuestDebts();
  all.unshift(debt);
  setStoredGuestDebts(all);
  return debt;
}

export function updateGuestDebt(id: string, data: DebtFormData): Debt | null {
  const all = getStoredGuestDebts();
  const idx = all.findIndex((d) => d.id === id);
  if (idx === -1) return null;
  const updated = enrichGuestDebt({
    ...all[idx],
    person_or_entity: data.person_or_entity,
    debt_type: data.debt_type,
    total_amount: data.total_amount,
    due_date: data.due_date ?? null,
    notes: data.notes ?? null,
    contact_id: data.contact_id ?? null,
    updated_at: new Date().toISOString(),
  });
  all[idx] = updated;
  setStoredGuestDebts(all);
  return updated;
}

export function deleteGuestDebt(id: string): void {
  setStoredGuestDebts(getStoredGuestDebts().filter((d) => d.id !== id));
}

export function addGuestDebtPayment(
  debtId: string,
  data: DebtPaymentFormData,
): Debt | null {
  const all = getStoredGuestDebts();
  const idx = all.findIndex((d) => d.id === debtId);
  if (idx === -1) return null;

  const payment = {
    id: crypto.randomUUID(),
    amount: data.amount,
    payment_date: data.payment_date,
    notes: data.notes ?? null,
  };

  const updated = enrichGuestDebt({
    ...all[idx],
    paid_amount: Number(all[idx].paid_amount) + Number(data.amount),
    payments: [payment, ...(all[idx].payments ?? [])],
    updated_at: new Date().toISOString(),
  });
  all[idx] = updated;
  setStoredGuestDebts(all);
  return updated;
}

// ── Guest Work Sessions ───────────────────────────────────────

function getStoredGuestWorkSessions(): WorkSession[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(GUEST_WORK_SESSION_KEY) ?? "[]");
  } catch { return []; }
}

function setStoredGuestWorkSessions(items: WorkSession[]) {
  localStorage.setItem(GUEST_WORK_SESSION_KEY, JSON.stringify(items));
}

export function getGuestWorkSessions(): WorkSession[] {
  return getStoredGuestWorkSessions().sort((a, b) => b.work_date.localeCompare(a.work_date));
}

export function addGuestWorkSession(data: WorkSessionFormData): WorkSession {
  const now = new Date().toISOString();
  const session: WorkSession = {
    id: crypto.randomUUID(),
    user_id: getGuestId(),
    title: data.title,
    employer_or_client: data.employer_or_client,
    hourly_rate: data.hourly_rate,
    hours_worked: data.hours_worked,
    expected_amount: Number(data.hourly_rate) * Number(data.hours_worked),
    work_date: data.work_date,
    due_date: data.due_date ?? null,
    notes: data.notes ?? null,
    recurrence: data.recurrence,
    recurrence_end_date: data.recurrence_end_date ?? null,
    created_at: now,
    updated_at: now,
  };
  const all = getStoredGuestWorkSessions();
  all.unshift(session);
  setStoredGuestWorkSessions(all);
  return session;
}

export function updateGuestWorkSession(id: string, data: WorkSessionFormData): WorkSession | null {
  const all = getStoredGuestWorkSessions();
  const idx = all.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  const updated: WorkSession = {
    ...all[idx],
    title: data.title,
    employer_or_client: data.employer_or_client,
    hourly_rate: data.hourly_rate,
    hours_worked: data.hours_worked,
    expected_amount: Number(data.hourly_rate) * Number(data.hours_worked),
    work_date: data.work_date,
    due_date: data.due_date ?? null,
    notes: data.notes ?? null,
    recurrence: data.recurrence,
    recurrence_end_date: data.recurrence_end_date ?? null,
    updated_at: new Date().toISOString(),
  };
  all[idx] = updated;
  setStoredGuestWorkSessions(all);
  return updated;
}

export function deleteGuestWorkSession(id: string): void {
  setStoredGuestWorkSessions(getStoredGuestWorkSessions().filter((s) => s.id !== id));
  // Also remove linked payments
  setStoredGuestWorkPayments(getStoredGuestWorkPayments().filter((p) => p.work_session_id !== id));
}

// ── Guest Work Payments ───────────────────────────────────────

function getStoredGuestWorkPayments(): WorkPayment[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(GUEST_WORK_PAYMENT_KEY) ?? "[]");
  } catch { return []; }
}

function setStoredGuestWorkPayments(items: WorkPayment[]) {
  localStorage.setItem(GUEST_WORK_PAYMENT_KEY, JSON.stringify(items));
}

export function getGuestWorkPayments(): WorkPayment[] {
  return getStoredGuestWorkPayments().sort((a, b) => b.payment_date.localeCompare(a.payment_date));
}

export function addGuestWorkPayment(data: WorkPaymentFormData): WorkPayment {
  const payment: WorkPayment = {
    id: crypto.randomUUID(),
    user_id: getGuestId(),
    work_session_id: data.work_session_id ?? null,
    employer_or_client: data.employer_or_client,
    amount: data.amount,
    payment_date: data.payment_date,
    notes: data.notes ?? null,
    transaction_id: null,
    created_at: new Date().toISOString(),
  };
  const all = getStoredGuestWorkPayments();
  all.unshift(payment);
  setStoredGuestWorkPayments(all);
  return payment;
}

export function updateGuestWorkPayment(id: string, data: WorkPaymentFormData): WorkPayment | null {
  const all = getStoredGuestWorkPayments();
  const idx = all.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  const updated: WorkPayment = {
    ...all[idx],
    work_session_id: data.work_session_id ?? null,
    employer_or_client: data.employer_or_client,
    amount: data.amount,
    payment_date: data.payment_date,
    notes: data.notes ?? null,
  };
  all[idx] = updated;
  setStoredGuestWorkPayments(all);
  return updated;
}

export function deleteGuestWorkPayment(id: string): void {
  setStoredGuestWorkPayments(getStoredGuestWorkPayments().filter((p) => p.id !== id));
}

// ── Guest Bills ────────────────────────────────────────────────

function daysBetweenToday(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateStr}T00:00:00`);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

// ── Guest Subscriptions ────────────────────────────────────────

function enrichGuestSubscription(subscription: Subscription): Subscription {
  return {
    ...subscription,
    days_until_billing: daysBetweenToday(subscription.next_billing_date),
  };
}

function getStoredGuestSubscriptions(): Subscription[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(GUEST_SUBSCRIPTION_KEY) ?? "[]");
  } catch { return []; }
}

function setStoredGuestSubscriptions(items: Subscription[]) {
  localStorage.setItem(GUEST_SUBSCRIPTION_KEY, JSON.stringify(items));
}

export function getGuestSubscriptions(): Subscription[] {
  return getStoredGuestSubscriptions()
    .map(enrichGuestSubscription)
    .sort((a, b) => a.next_billing_date.localeCompare(b.next_billing_date));
}

export function addGuestSubscription(data: SubscriptionFormData): Subscription {
  const now = new Date().toISOString();
  const category = data.category_id
    ? getGuestCategories().find((c) => c.id === data.category_id) ?? null
    : null;
  const subscription: Subscription = {
    id: crypto.randomUUID(),
    user_id: getGuestId(),
    name: data.name.trim(),
    amount: Number(data.amount),
    currency: data.currency ?? "USD",
    billing_cycle: data.billing_cycle ?? "monthly",
    next_billing_date: data.next_billing_date,
    category_id: data.category_id ?? null,
    account_id: data.account_id ?? null,
    color: data.color ?? null,
    icon: data.icon ?? null,
    notes: data.notes?.trim() ?? null,
    status: data.status ?? "active",
    remind_days_before: data.remind_days_before ?? 3,
    auto_create_transaction: data.auto_create_transaction ?? true,
    last_billed_date: null,
    created_at: now,
    updated_at: now,
    category: category ? { id: category.id, name: category.name, color: category.color, icon: category.icon ?? null } : null,
    account: null,
  };
  const all = getStoredGuestSubscriptions();
  all.unshift(subscription);
  setStoredGuestSubscriptions(all);
  return enrichGuestSubscription(subscription);
}

export function updateGuestSubscription(id: string, data: Partial<SubscriptionFormData>): Subscription | null {
  const all = getStoredGuestSubscriptions();
  const idx = all.findIndex((subscription) => subscription.id === id);
  if (idx === -1) return null;
  const category = data.category_id
    ? getGuestCategories().find((c) => c.id === data.category_id) ?? null
    : data.category_id === null ? null : all[idx].category ?? null;
  const updated: Subscription = {
    ...all[idx],
    ...(data.name !== undefined && { name: data.name.trim() }),
    ...(data.amount !== undefined && { amount: Number(data.amount) }),
    ...(data.currency !== undefined && { currency: data.currency ?? all[idx].currency }),
    ...(data.billing_cycle !== undefined && { billing_cycle: data.billing_cycle }),
    ...(data.next_billing_date !== undefined && { next_billing_date: data.next_billing_date }),
    ...(data.category_id !== undefined && { category_id: data.category_id ?? null }),
    ...(data.account_id !== undefined && { account_id: data.account_id ?? null }),
    ...(data.color !== undefined && { color: data.color ?? null }),
    ...(data.icon !== undefined && { icon: data.icon ?? null }),
    ...(data.notes !== undefined && { notes: data.notes?.trim() ?? null }),
    ...(data.status !== undefined && { status: data.status }),
    ...(data.remind_days_before !== undefined && { remind_days_before: data.remind_days_before }),
    ...(data.auto_create_transaction !== undefined && { auto_create_transaction: data.auto_create_transaction }),
    category: category ? { id: category.id, name: category.name, color: category.color, icon: category.icon ?? null } : null,
    updated_at: new Date().toISOString(),
  };
  all[idx] = updated;
  setStoredGuestSubscriptions(all);
  return enrichGuestSubscription(updated);
}

export function deleteGuestSubscription(id: string): void {
  setStoredGuestSubscriptions(getStoredGuestSubscriptions().filter((subscription) => subscription.id !== id));
}

export function clearGuestData(): void {
  localStorage.removeItem(GUEST_ID_KEY);
  localStorage.removeItem(GUEST_TX_KEY);
  localStorage.removeItem(GUEST_BUDGET_KEY);
  localStorage.removeItem(GUEST_GOAL_KEY);
  localStorage.removeItem(LEGACY_GOAL_KEY);
  localStorage.removeItem(GUEST_CONTACT_KEY);
  localStorage.removeItem(GUEST_CATEGORY_KEY);
  localStorage.removeItem(GUEST_HIDDEN_CATEGORY_KEY);
  localStorage.removeItem(GUEST_TAG_KEY);
  localStorage.removeItem(GUEST_INVESTMENT_KEY);
  localStorage.removeItem(GUEST_DEBT_KEY);
  localStorage.removeItem(GUEST_WORK_SESSION_KEY);
  localStorage.removeItem(GUEST_WORK_PAYMENT_KEY);
  localStorage.removeItem(GUEST_SUBSCRIPTION_KEY);
}
