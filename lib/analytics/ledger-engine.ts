import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── Types ──────────────────────────────────────────────────────

export interface MonthPoint {
  month: string;    // "2026-01"
  label: string;    // "Jan 2026"
  income: number;
  expenses: number;
  net: number;
  savingsRate: number;
}

export interface CategoryBreakdown {
  categoryId:   string | null;
  categoryName: string;
  color:        string;
  amount:       number;
  pct:          number;
  count:        number;
}

export interface SourceBreakdown {
  source: string;
  amount: number;
  pct:    number;
  count:  number;
}

export interface DayPoint {
  date:     string;  // "2026-06-01"
  day:      number;
  income:   number;
  expenses: number;
  net:      number;
}

export interface LedgerKPIs {
  // Current month (from ledger)
  monthlyIncome:    number;
  monthlyExpenses:  number;
  monthlyNet:       number;
  savingsRate:      number;
  // YTD
  ytdIncome:        number;
  ytdExpenses:      number;
  ytdNet:           number;
  // Last 12 months avg
  avgMonthlyIncome:   number;
  avgMonthlyExpenses: number;
  // Work (from ledger work_payment entries)
  workIncome:       number;
  // Top expense day this month
  topExpenseAmount: number;
}

export interface LedgerAnalyticsBundle {
  kpis:              LedgerKPIs;
  monthly:           MonthPoint[];      // 12 months
  daily:             DayPoint[];        // current month days
  expenseByCategory: CategoryBreakdown[];
  incomeBySource:    SourceBreakdown[];
  topExpenses:       { description: string; amount: number; date: string; category: string }[];
}

// ── Helpers ────────────────────────────────────────────────────

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return new Date(`${y}-${m}-01`).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function last12MonthKeys(): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(monthKey(d));
  }
  return keys;
}

// ── Main engine function ───────────────────────────────────────

export async function getLedgerAnalytics(
  supabase: SupabaseClient,
  userId:   string,
): Promise<LedgerAnalyticsBundle> {
  const now      = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1;

  // Fetch ledger entries for the last 13 months (include extra for YTD)
  const fromDate = new Date(thisYear - 1, now.getMonth() - 1, 1).toISOString().slice(0, 10);
  const ytdStart = `${thisYear}-01-01`;

  const [entriesRes, categoriesRes] = await Promise.all([
    supabase
      .from("ledger_entries")
      .select("id,entry_type,direction,amount,source_module,category_id,contact_id,description,created_at")
      .eq("user_id", userId)
      .gte("created_at", fromDate)
      .order("created_at", { ascending: true }),

    supabase
      .from("categories")
      .select("id,name,color")
      .eq("user_id", userId),
  ]);

  const entries    = entriesRes.data   ?? [];
  const categories = categoriesRes.data ?? [];
  const catMap     = new Map<string, { name: string; color: string }>(
    categories.map(c => [c.id, { name: c.name, color: c.color ?? "#8B5CF6" }]),
  );

  // ── Group entries ─────────────────────────────────────────

  const monthsMap = new Map<string, { income: number; expenses: number; work: number }>();
  const dayMap    = new Map<string, { income: number; expenses: number }>();
  const catExpMap = new Map<string | null, { amount: number; count: number }>();
  const srcIncMap = new Map<string, { amount: number; count: number }>();
  const topExp: { description: string; amount: number; date: string; categoryId: string | null }[] = [];

  let ytdIncome   = 0, ytdExpenses = 0;
  let curIncome   = 0, curExpenses = 0, curWork = 0;
  const curMonthKey = monthKey(now);

  for (const e of entries) {
    const createdAt = new Date(e.created_at);
    const mKey  = monthKey(createdAt);
    const dKey  = e.created_at.slice(0, 10);
    const isInflow  = e.direction === "inflow";
    const isOutflow = e.direction === "outflow";
    const amt   = Number(e.amount) || 0;

    // Monthly aggregation
    if (!monthsMap.has(mKey)) monthsMap.set(mKey, { income: 0, expenses: 0, work: 0 });
    const slot = monthsMap.get(mKey)!;
    if (isInflow)  { slot.income   += amt; }
    if (isOutflow) { slot.expenses += amt; }
    if (isInflow && (e.entry_type === "work_payment")) slot.work += amt;

    // YTD (from Jan 1 of current year)
    const eDate = e.created_at.slice(0, 10);
    if (eDate >= ytdStart) {
      if (isInflow)  ytdIncome   += amt;
      if (isOutflow) ytdExpenses += amt;
    }

    // Current month
    if (mKey === curMonthKey) {
      if (isInflow)  curIncome   += amt;
      if (isOutflow) curExpenses += amt;
      if (isInflow && e.entry_type === "work_payment") curWork += amt;

      // Daily aggregation (current month only)
      if (!dayMap.has(dKey)) dayMap.set(dKey, { income: 0, expenses: 0 });
      const dSlot = dayMap.get(dKey)!;
      if (isInflow)  dSlot.income   += amt;
      if (isOutflow) dSlot.expenses += amt;
    }

    // Category expense breakdown
    if (isOutflow) {
      const catKey = e.category_id ?? null;
      const prev   = catExpMap.get(catKey) ?? { amount: 0, count: 0 };
      catExpMap.set(catKey, { amount: prev.amount + amt, count: prev.count + 1 });

      // Top expenses list
      if (amt > 0) {
        topExp.push({
          description: e.description ?? e.entry_type,
          amount:      amt,
          date:        eDate,
          categoryId:  e.category_id ?? null,
        });
      }
    }

    // Income by source
    if (isInflow) {
      const src  = e.entry_type ?? e.source_module ?? "other";
      const prev = srcIncMap.get(src) ?? { amount: 0, count: 0 };
      srcIncMap.set(src, { amount: prev.amount + amt, count: prev.count + 1 });
    }
  }

  // ── Build monthly array (last 12 months, fill gaps with 0) ──

  const keys   = last12MonthKeys();
  const monthly: MonthPoint[] = keys.map(k => {
    const s = monthsMap.get(k) ?? { income: 0, expenses: 0, work: 0 };
    const net = s.income - s.expenses;
    return {
      month:       k,
      label:       monthLabel(k),
      income:      s.income,
      expenses:    s.expenses,
      net,
      savingsRate: s.income > 0 ? Math.round((net / s.income) * 100) : 0,
    };
  });

  // Avg of last 12 months (excluding current)
  const pastMonths = monthly.slice(0, 11);
  const avgMonthlyIncome   = pastMonths.length ? pastMonths.reduce((s, m) => s + m.income,   0) / pastMonths.length : 0;
  const avgMonthlyExpenses = pastMonths.length ? pastMonths.reduce((s, m) => s + m.expenses, 0) / pastMonths.length : 0;

  // ── Build daily array (current month) ─────────────────────

  const daysInMonth = new Date(thisYear, thisMonth, 0).getDate();
  const daily: DayPoint[] = Array.from({ length: now.getDate() }, (_, i) => {
    const d   = i + 1;
    const key = `${thisYear}-${String(thisMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const slot = dayMap.get(key) ?? { income: 0, expenses: 0 };
    return { date: key, day: d, income: slot.income, expenses: slot.expenses, net: slot.income - slot.expenses };
  });
  void daysInMonth;

  // ── Expense by category ────────────────────────────────────

  const totalExpenses = Array.from(catExpMap.values()).reduce((s, v) => s + v.amount, 0);
  const expenseByCategory: CategoryBreakdown[] = Array.from(catExpMap.entries())
    .map(([catId, { amount, count }]) => {
      const cat = catId ? catMap.get(catId) : null;
      return {
        categoryId:   catId,
        categoryName: cat?.name ?? "Uncategorized",
        color:        cat?.color ?? "#6B7280",
        amount,
        pct:          totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0,
        count,
      };
    })
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 12);

  // ── Income by source ───────────────────────────────────────

  const totalIncome = Array.from(srcIncMap.values()).reduce((s, v) => s + v.amount, 0);
  const incomeBySource: SourceBreakdown[] = Array.from(srcIncMap.entries())
    .map(([source, { amount, count }]) => ({
      source,
      amount,
      pct:   totalIncome > 0 ? Math.round((amount / totalIncome) * 100) : 0,
      count,
    }))
    .sort((a, b) => b.amount - a.amount);

  // ── Top expenses ───────────────────────────────────────────

  const topExpenses = topExp
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10)
    .map(e => ({
      description: e.description,
      amount:      e.amount,
      date:        e.date,
      category:    e.categoryId ? (catMap.get(e.categoryId)?.name ?? "Uncategorized") : "Uncategorized",
    }));

  // ── KPIs ──────────────────────────────────────────────────

  const monthlyNet  = curIncome - curExpenses;
  const savingsRate = curIncome > 0 ? Math.round((monthlyNet / curIncome) * 100) : 0;
  const topExpenseAmount = daily.reduce((max, d) => Math.max(max, d.expenses), 0);

  const kpis: LedgerKPIs = {
    monthlyIncome:      curIncome,
    monthlyExpenses:    curExpenses,
    monthlyNet,
    savingsRate,
    ytdIncome,
    ytdExpenses,
    ytdNet:             ytdIncome - ytdExpenses,
    avgMonthlyIncome,
    avgMonthlyExpenses,
    workIncome:         curWork,
    topExpenseAmount,
  };

  return { kpis, monthly, daily, expenseByCategory, incomeBySource, topExpenses };
}
