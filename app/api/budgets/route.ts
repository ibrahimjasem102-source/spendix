import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Budget, BudgetFormData, BudgetStatus, BudgetSummary, Category } from "@/types";

const BUDGET_SELECT =
  "id,user_id,category_id,monthly_limit,month,year,created_at,category:categories(id,name,color,icon)";
const BUDGET_SELECT_LEGACY =
  "id,user_id,category_id,monthly_limit,month,year,created_at,category:categories(id,name,color)";
const CATEGORY_SELECT = "id,user_id,name,type,color,icon,created_at";
const CATEGORY_SELECT_LEGACY = "id,user_id,name,type,color,created_at";

function isOptionalCategoryError(message = "") {
  return message.includes("categories.icon") ||
    message.includes("schema cache") ||
    message.includes("Could not find");
}

function numberValue(value: unknown) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function clampMonth(value: string | null) {
  const month = Number(value);
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : new Date().getMonth() + 1;
}

function clampYear(value: string | null) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : new Date().getFullYear();
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function monthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start: dateOnly(start), end: dateOnly(end) };
}

function withRuntimeStats(rows: unknown[], spendingByCategory: Map<string, number>) {
  return (rows as Budget[]).map((budget) => {
    const spent = spendingByCategory.get(budget.category_id) ?? 0;
    const limit = numberValue(budget.monthly_limit);
    const percent = limit > 0 ? Math.round((spent / limit) * 100) : 0;
    const status: BudgetStatus = spent > limit ? "over" : percent >= 85 ? "near_limit" : "safe";
    return {
      ...budget,
      monthly_limit: limit,
      spent,
      remaining: Math.max(limit - spent, 0),
      percent,
      status,
    };
  });
}

function summarize(budgets: Budget[]): BudgetSummary {
  return budgets.reduce<BudgetSummary>((summary, budget) => {
    summary.totalBudget += numberValue(budget.monthly_limit);
    summary.totalSpent += numberValue(budget.spent);
    summary.totalRemaining += numberValue(budget.remaining);
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

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = clampMonth(searchParams.get("month"));
  const year = clampYear(searchParams.get("year"));
  const { start, end } = monthRange(year, month);

  const budgetResult = await supabase
    .from("budgets")
    .select(BUDGET_SELECT)
    .eq("user_id", user.id)
    .eq("month", month)
    .eq("year", year)
    .order("created_at", { ascending: false });
  let budgetRows: unknown[] = budgetResult.data ?? [];
  let budgetError = budgetResult.error;

  if (budgetError && isOptionalCategoryError(budgetError.message)) {
    const legacy = await supabase
      .from("budgets")
      .select(BUDGET_SELECT_LEGACY)
      .eq("user_id", user.id)
      .eq("month", month)
      .eq("year", year)
      .order("created_at", { ascending: false });
    budgetRows = legacy.data ?? [];
    budgetError = legacy.error;
  }

  if (budgetError) {
    return NextResponse.json({ error: budgetError.message }, { status: 500 });
  }

  const txResult = await supabase
    .from("transactions")
    .select("category_id,amount")
    .eq("user_id", user.id)
    .eq("type", "expense")
    .gte("transaction_date", start)
    .lt("transaction_date", end);

  if (txResult.error) return NextResponse.json({ error: txResult.error.message }, { status: 500 });

  const spendingByCategory = new Map<string, number>();
  (txResult.data ?? []).forEach((transaction) => {
    if (!transaction.category_id) return;
    spendingByCategory.set(
      transaction.category_id,
      (spendingByCategory.get(transaction.category_id) ?? 0) + numberValue(transaction.amount),
    );
  });

  const categoryResult = await supabase
    .from("categories")
    .select(CATEGORY_SELECT)
    .eq("user_id", user.id)
    .eq("type", "expense")
    .order("name");
  let categories: unknown[] = categoryResult.data ?? [];
  let categoryError = categoryResult.error;

  if (categoryError && isOptionalCategoryError(categoryError.message)) {
    const legacy = await supabase
      .from("categories")
      .select(CATEGORY_SELECT_LEGACY)
      .eq("user_id", user.id)
      .eq("type", "expense")
      .order("name");
    categories = legacy.data ?? [];
    categoryError = legacy.error;
  }

  if (categoryError) return NextResponse.json({ error: categoryError.message }, { status: 500 });

  const budgets = withRuntimeStats(budgetRows, spendingByCategory);

  return NextResponse.json({
    budgets,
    categories: categories as Category[],
    summary: summarize(budgets),
    period: { month, year, start, end },
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });

  const body = await request.json() as BudgetFormData;
  const month = clampMonth(String(body.month));
  const year = clampYear(String(body.year));
  const monthlyLimit = numberValue(body.monthly_limit);

  if (!body.category_id || monthlyLimit <= 0) {
    return NextResponse.json({ errorKey: "budgets.form_error" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("budgets")
    .select("id")
    .eq("user_id", user.id)
    .eq("category_id", body.category_id)
    .eq("month", month)
    .eq("year", year)
    .maybeSingle();

  const query = existing?.id
    ? supabase
      .from("budgets")
      .update({ monthly_limit: monthlyLimit })
      .eq("id", existing.id)
      .eq("user_id", user.id)
    : supabase
      .from("budgets")
      .insert({
        user_id: user.id,
        category_id: body.category_id,
        monthly_limit: monthlyLimit,
        month,
        year,
      });

  const { data, error } = await query
    .select("id,user_id,category_id,monthly_limit,month,year,created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ budget: data }, { status: existing?.id ? 200 : 201 });
}
