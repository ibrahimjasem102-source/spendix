import "server-only";

import { createClient } from "@/lib/supabase/server";
import { calculateDebtHealth, calculateRealRemainingDebt, type RelationshipHealth } from "@/lib/finance/relationshipEngine";
import { isOptionalTransactionColumnError } from "@/lib/finance/serverTransactions";
import type { Debt, Investment, Transaction, TransactionSource, WorkPayment, WorkSession } from "@/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface CategorySpend {
  name: string;
  value: number;
  color: string;
}

export interface IncomeExpensePoint {
  month: string;
  income: number;
  expenses: number;
  savings: number;
}

export interface CashflowPoint {
  day: number;
  date: string;
  amount: number;
}

export interface SourceBreakdownPoint {
  source: TransactionSource;
  label: string;
  income: number;
  expenses: number;
  total: number;
  count: number;
  color: string;
}

export interface DashboardAnalytics {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  savingsRate: number;
  dailyBurn: number;
  workIncome: number;
  transactionCount: number;
  recentTransactions: Transaction[];
  spendingByCategory: CategorySpend[];
  incomeVsExpenses: IncomeExpensePoint[];
  monthlyCashflow: CashflowPoint[];
  sourceBreakdown: SourceBreakdownPoint[];
  debtTruth: DebtAnalytics;
  hasTransactions: boolean;
}

export interface DebtAnalytics {
  total_payable: number;
  total_receivable: number;
  total_paid: number;
  total_remaining: number;
  total_payable_remaining: number;
  total_receivable_remaining: number;
  net_debt_exposure: number;
  debt_recovery_rate: number;
  repayment_rate: number;
  overdue_ratio: number;
  payment_velocity: number;
  health_distribution: Record<RelationshipHealth, number>;
  active_debts: number;
  paid_debts: number;
  overdue_debts: number;
}

export interface InvestmentAnalytics {
  total_invested: number;
  current_value: number;
  profit_loss: number;
  profit_loss_percentage: number;
  investments_count: number;
}

export interface WorkAnalytics {
  hours_this_month: number;
  expected_work_income: number;
  received_work_income: number;
  unpaid_work_balance: number;
}

const CATEGORY_COLORS = [
  "#06B6D4",
  "#10B981",
  "#F43F5E",
  "#8B5CF6",
  "#F59E0B",
  "#EC4899",
  "#3B82F6",
  "#22C55E",
];

const SOURCE_META: Record<TransactionSource, { label: string; color: string }> = {
  manual: { label: "Manual", color: "#06B6D4" },
  investment: { label: "Investment", color: "#8B5CF6" },
  debt: { label: "Debt", color: "#F97316" },
  debt_payment: { label: "Debt payment", color: "#F59E0B" },
  work: { label: "Work", color: "#14B8A6" },
  work_payment: { label: "Work payment", color: "#10B981" },
  subscription: { label: "Subscription", color: "#8B5CF6" },
};

function numberValue(value: unknown) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function currentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start: dateOnly(start), end: dateOnly(end) };
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function isWithin(date: string, start: string, end: string) {
  return date >= start && date < end;
}

async function getSupabase(supabase?: Supabase) {
  return supabase ?? createClient();
}

async function fetchTransactions(userId: string, supabase?: Supabase) {
  const db = await getSupabase(supabase);
  const selects = [
    "id,user_id,category_id,title,notes,amount,type,source,related_source_id,contact_id,transaction_date,created_at,updated_at,category:categories(id, name, color, icon)",
    "id,user_id,category_id,title,notes,amount,type,source,related_source_id,contact_id,transaction_date,created_at,updated_at",
    "id,user_id,category_id,title,notes,amount,type,transaction_date,created_at,updated_at,category:categories(id, name, color)",
    "id,user_id,category_id,title,notes,amount,type,transaction_date,created_at,updated_at",
  ];

  let data: unknown = [];
  let error: { message: string } | null = null;

  for (const select of selects) {
    const result = await db
      .from("transactions")
      .select(select)
      .eq("user_id", userId)
      .order("transaction_date", { ascending: false });
    data = result.data;
    error = result.error;
    if (!error || !isOptionalTransactionColumnError(error.message)) break;
  }

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Transaction[]).map((transaction) => ({
    ...transaction,
    source: transaction.source ?? "manual",
  }));
}

async function fetchTransactionsOrEmpty(userId: string, supabase?: Supabase) {
  try {
    return await fetchTransactions(userId, supabase);
  } catch {
    return [];
  }
}

function sumTransactions(transactions: Transaction[], type: "income" | "expense", start?: string, end?: string) {
  return transactions
    .filter((transaction) => transaction.type === type)
    .filter((transaction) => !start || !end || isWithin(transaction.transaction_date, start, end))
    .reduce((sum, transaction) => sum + numberValue(transaction.amount), 0);
}

function calculateTotalBalance(transactions: Transaction[]) {
  return sumTransactions(transactions, "income") - sumTransactions(transactions, "expense");
}

function calculateMonthlyIncome(transactions: Transaction[]) {
  const { start, end } = currentMonthRange();
  return sumTransactions(transactions, "income", start, end);
}

function calculateMonthlyExpenses(transactions: Transaction[]) {
  const { start, end } = currentMonthRange();
  return sumTransactions(transactions, "expense", start, end);
}

function calculateSavingsRate(monthlyIncome: number, monthlyExpenses: number) {
  return monthlyIncome > 0 ? Math.round(((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100) : 0;
}

function calculateRecentTransactions(transactions: Transaction[], limit = 10) {
  return [...transactions]
    .sort((a, b) => {
      const first = b.created_at || b.transaction_date;
      const second = a.created_at || a.transaction_date;
      return first.localeCompare(second);
    })
    .slice(0, limit);
}

function calculateSpendingByCategory(transactions: Transaction[]) {
  const { start, end } = currentMonthRange();
  const totals = new Map<string, CategorySpend>();

  transactions
    .filter((transaction) => transaction.type === "expense" && isWithin(transaction.transaction_date, start, end))
    .forEach((transaction) => {
      const name = transaction.category?.name || "Uncategorized";
      const existing = totals.get(name);
      totals.set(name, {
        name,
        value: (existing?.value ?? 0) + numberValue(transaction.amount),
        color: transaction.category?.color || existing?.color || CATEGORY_COLORS[totals.size % CATEGORY_COLORS.length],
      });
    });

  return [...totals.values()].sort((a, b) => b.value - a.value);
}

function calculateIncomeVsExpenses(transactions: Transaction[], months = 6) {
  const now = new Date();
  const points = Array.from({ length: months }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (months - 1 - index), 1);
      return {
        key: monthKey(date),
      month: monthKey(date),
      income: 0,
      expenses: 0,
      savings: 0,
    };
  });

  const byMonth = new Map(points.map((point) => [point.key, point]));

  transactions.forEach((transaction) => {
    const date = new Date(`${transaction.transaction_date}T00:00:00`);
    const point = byMonth.get(monthKey(date));
    if (!point) return;

    if (transaction.type === "income") point.income += numberValue(transaction.amount);
    if (transaction.type === "expense") point.expenses += numberValue(transaction.amount);
    point.savings = point.income - point.expenses;
  });

  return points.map(({ key: _key, ...point }) => point);
}

function calculateMonthlyCashflow(transactions: Transaction[], days = 30) {
  const now = new Date();
  const points = Array.from({ length: days }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (days - 1 - index));
    return {
      day: date.getDate(),
      date: dateOnly(date),
      amount: 0,
    };
  });
  const byDate = new Map(points.map((point) => [point.date, point]));

  transactions
    .filter((transaction) => transaction.type === "expense")
    .forEach((transaction) => {
      const point = byDate.get(transaction.transaction_date);
      if (point) point.amount += numberValue(transaction.amount);
    });

  return points;
}

function calculateSourceBreakdown(transactions: Transaction[]) {
  const empty = Object.entries(SOURCE_META).map(([source, meta]) => ({
    source: source as TransactionSource,
    label: meta.label,
    income: 0,
    expenses: 0,
    total: 0,
    count: 0,
    color: meta.color,
  }));
  const bySource = new Map(empty.map((item) => [item.source, item]));

  transactions.forEach((transaction) => {
    const source = transaction.source ?? "manual";
    const item = bySource.get(source);
    if (!item) return;

    const amount = numberValue(transaction.amount);
    if (transaction.type === "income") item.income += amount;
    if (transaction.type === "expense") item.expenses += amount;
    item.total += amount;
    item.count += 1;
  });

  return [...bySource.values()].filter((item) => item.count > 0);
}

async function safeSelect<T>(query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const { data, error } = await query;
  if (error) return [];
  return data ?? [];
}

export async function getTotalBalance(userId: string, supabase?: Supabase) {
  return calculateTotalBalance(await fetchTransactions(userId, supabase));
}

export async function getMonthlyIncome(userId: string, supabase?: Supabase) {
  return calculateMonthlyIncome(await fetchTransactions(userId, supabase));
}

export async function getMonthlyExpenses(userId: string, supabase?: Supabase) {
  return calculateMonthlyExpenses(await fetchTransactions(userId, supabase));
}

export async function getSavingsRate(userId: string, supabase?: Supabase) {
  const transactions = await fetchTransactions(userId, supabase);
  return calculateSavingsRate(calculateMonthlyIncome(transactions), calculateMonthlyExpenses(transactions));
}

export async function getRecentTransactions(userId: string, supabase?: Supabase) {
  return calculateRecentTransactions(await fetchTransactions(userId, supabase), 10);
}

export async function getSpendingByCategory(userId: string, supabase?: Supabase) {
  return calculateSpendingByCategory(await fetchTransactions(userId, supabase));
}

export async function getIncomeVsExpenses(userId: string, supabase?: Supabase) {
  return calculateIncomeVsExpenses(await fetchTransactions(userId, supabase));
}

export async function getMonthlyCashflow(userId: string, supabase?: Supabase) {
  return calculateMonthlyCashflow(await fetchTransactions(userId, supabase));
}

export async function getSourceBreakdown(userId: string, supabase?: Supabase) {
  return calculateSourceBreakdown(await fetchTransactions(userId, supabase));
}

export async function getDashboardStats(userId: string, supabase?: Supabase): Promise<DashboardAnalytics> {
  const transactions = await fetchTransactionsOrEmpty(userId, supabase);
  const debtTruth = await getDebtAnalytics(userId, supabase).catch(() => ({
    total_payable: 0,
    total_receivable: 0,
    total_paid: 0,
    total_remaining: 0,
    total_payable_remaining: 0,
    total_receivable_remaining: 0,
    net_debt_exposure: 0,
    debt_recovery_rate: 0,
    repayment_rate: 0,
    overdue_ratio: 0,
    payment_velocity: 0,
    health_distribution: { healthy: 0, attention_needed: 0, high_risk: 0, overdue: 0, settled: 0 },
    active_debts: 0,
    paid_debts: 0,
    overdue_debts: 0,
  }));
  const monthlyIncome = calculateMonthlyIncome(transactions);
  const monthlyExpenses = calculateMonthlyExpenses(transactions);
  const monthlyCashflow = calculateMonthlyCashflow(transactions);

  return {
    totalBalance: calculateTotalBalance(transactions),
    monthlyIncome,
    monthlyExpenses,
    savingsRate: calculateSavingsRate(monthlyIncome, monthlyExpenses),
    dailyBurn: monthlyCashflow.reduce((sum, point) => sum + point.amount, 0) / monthlyCashflow.length,
    workIncome: transactions
      .filter((transaction) => transaction.source === "work_payment")
      .reduce((sum, transaction) => sum + numberValue(transaction.amount), 0),
    transactionCount: transactions.length,
    recentTransactions: calculateRecentTransactions(transactions, 10),
    spendingByCategory: calculateSpendingByCategory(transactions),
    incomeVsExpenses: calculateIncomeVsExpenses(transactions),
    monthlyCashflow,
    sourceBreakdown: calculateSourceBreakdown(transactions),
    debtTruth,
    hasTransactions: transactions.length > 0,
  };
}

export async function getDashboardSummary(userId: string, supabase?: Supabase) {
  return getDashboardStats(userId, supabase);
}

export async function getAnalyticsCharts(userId: string, supabase?: Supabase) {
  const transactions = await fetchTransactionsOrEmpty(userId, supabase);
  return {
    spendingByCategory: calculateSpendingByCategory(transactions),
    incomeVsExpenses: calculateIncomeVsExpenses(transactions),
    monthlyCashflow: calculateMonthlyCashflow(transactions),
    sourceBreakdown: calculateSourceBreakdown(transactions),
  };
}

export async function getCashflow(userId: string, supabase?: Supabase) {
  return getMonthlyCashflow(userId, supabase);
}

export async function getCategoryBreakdown(userId: string, supabase?: Supabase) {
  return getSpendingByCategory(userId, supabase);
}

export async function getDebtAnalytics(userId: string, supabase?: Supabase): Promise<DebtAnalytics> {
  const db = await getSupabase(supabase);
  const debts = await safeSelect<Debt>(
    db.from("debts").select("id,user_id,person_or_entity,debt_type,total_amount,paid_amount,due_date,status,notes,contact_id,created_at,updated_at").eq("user_id", userId)
  );
  const payments = await safeSelect<{ id: string; debt_id: string; amount: number; payment_date: string; created_at: string | null }>(
    db.from("debt_payments").select("id,debt_id,amount,payment_date,created_at").eq("user_id", userId)
  );

  const today = dateOnly(new Date());
  const { start } = currentMonthRange();
  const paymentsByDebt = new Map<string, typeof payments>();
  payments.forEach((payment) => {
    const list = paymentsByDebt.get(payment.debt_id) ?? [];
    list.push(payment);
    paymentsByDebt.set(payment.debt_id, list);
  });

  const stats = debts.reduce<DebtAnalytics>(
    (stats, debt) => {
      const total = numberValue(debt.total_amount);
      const debtPayments = paymentsByDebt.get(debt.id) ?? [];
      const real = calculateRealRemainingDebt(debt, debtPayments);
      const paid = real.paid;
      const remaining = real.remaining;
      const health = calculateDebtHealth(debt, debtPayments);

      if (debt.debt_type === "payable") stats.total_payable += total;
      if (debt.debt_type === "payable") stats.total_payable_remaining += remaining;
      if (debt.debt_type === "receivable") stats.total_receivable += total;
      if (debt.debt_type === "receivable") stats.total_receivable_remaining += remaining;

      stats.total_paid += paid;
      stats.total_remaining += remaining;
      stats.health_distribution[health] += 1;
      if (health === "settled") stats.paid_debts += 1;
      if (health !== "settled") stats.active_debts += 1;
      if (health === "overdue" || (debt.status !== "paid" && debt.due_date && debt.due_date < today)) {
        stats.overdue_debts += 1;
      }
      stats.payment_velocity += debtPayments
        .filter((payment) => payment.payment_date >= start)
        .reduce((sum, payment) => sum + numberValue(payment.amount), 0);

      return stats;
    },
    {
      total_payable: 0,
      total_receivable: 0,
      total_paid: 0,
      total_remaining: 0,
      total_payable_remaining: 0,
      total_receivable_remaining: 0,
      net_debt_exposure: 0,
      debt_recovery_rate: 0,
      repayment_rate: 0,
      overdue_ratio: 0,
      payment_velocity: 0,
      health_distribution: { healthy: 0, attention_needed: 0, high_risk: 0, overdue: 0, settled: 0 },
      active_debts: 0,
      paid_debts: 0,
      overdue_debts: 0,
    }
  );

  stats.net_debt_exposure = stats.total_receivable_remaining - stats.total_payable_remaining;
  stats.debt_recovery_rate = stats.total_receivable > 0
    ? ((stats.total_receivable - stats.total_receivable_remaining) / stats.total_receivable) * 100
    : 0;
  stats.repayment_rate = stats.total_payable > 0
    ? ((stats.total_payable - stats.total_payable_remaining) / stats.total_payable) * 100
    : 0;
  stats.overdue_ratio = debts.length > 0 ? (stats.overdue_debts / debts.length) * 100 : 0;

  return stats;
}

export async function getInvestmentAnalytics(userId: string, supabase?: Supabase): Promise<InvestmentAnalytics> {
  const db = await getSupabase(supabase);
  const investments = await safeSelect<Investment>(
    db.from("investments").select("id,user_id,asset_name,asset_type,amount_invested,current_value,investment_date,notes,transaction_id,created_at,updated_at").eq("user_id", userId)
  );

  const totalInvested = investments.reduce((sum, investment) => sum + numberValue(investment.amount_invested), 0);
  const currentValue = investments.reduce(
    (sum, investment) => sum + numberValue(investment.current_value ?? investment.amount_invested),
    0
  );
  const profitLoss = currentValue - totalInvested;

  return {
    total_invested: totalInvested,
    current_value: currentValue,
    profit_loss: profitLoss,
    profit_loss_percentage: totalInvested > 0 ? (profitLoss / totalInvested) * 100 : 0,
    investments_count: investments.length,
  };
}

export async function getWorkAnalytics(userId: string, supabase?: Supabase): Promise<WorkAnalytics> {
  const db = await getSupabase(supabase);
  const { start, end } = currentMonthRange();

  const sessions = await safeSelect<WorkSession>(
    db.from("work_sessions").select("id,user_id,title,employer_or_client,hourly_rate,hours_worked,expected_amount,work_date,notes,recurrence,recurrence_end_date,created_at,updated_at").eq("user_id", userId).gte("work_date", start).lt("work_date", end)
  );
  const payments = await safeSelect<WorkPayment>(
    db.from("work_payments").select("id,user_id,work_session_id,employer_or_client,amount,payment_date,notes,transaction_id,created_at").eq("user_id", userId).gte("payment_date", start).lt("payment_date", end)
  );

  const expected = sessions.reduce((sum, session) => {
    const generated = numberValue(session.hourly_rate) * numberValue(session.hours_worked);
    return sum + numberValue(session.expected_amount || generated);
  }, 0);
  const received = payments.reduce((sum, payment) => sum + numberValue(payment.amount), 0);

  return {
    hours_this_month: sessions.reduce((sum, session) => sum + numberValue(session.hours_worked), 0),
    expected_work_income: expected,
    received_work_income: received,
    unpaid_work_balance: Math.max(expected - received, 0),
  };
}
