import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MonthPoint } from "./ledger-engine";

export interface ForecastPoint {
  date:             string;  // "2026-07-01"
  label:            string;  // "Jul 2026"
  projectedIncome:  number;
  projectedExpenses: number;
  projectedNet:     number;
  cumulative:       number;  // cumulative net from today
  isActual:         boolean;
}

export interface ForecastBundle {
  points30:  ForecastPoint[];
  points90:  ForecastPoint[];
  points365: ForecastPoint[];
  // Drivers
  fixedMonthlyIncome:    number;
  fixedMonthlyExpenses:  number;
  baselineIncome:        number;
  baselineExpenses:      number;
  projectedSavingsRate:  number;
}

function dateLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function monthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export async function getForecasts(
  supabase: SupabaseClient,
  userId:   string,
  historical: MonthPoint[],
): Promise<ForecastBundle> {
  const now = new Date();

  // ── Fetch recurring + subscriptions ────────────────────────

  const [recurringRes, subsRes] = await Promise.all([
    supabase
      .from("recurring_transactions")
      .select("id,amount,type,frequency")
      .eq("user_id", userId)
      .eq("is_active", true),

    supabase
      .from("subscriptions")
      .select("id,amount,billing_cycle")
      .eq("user_id", userId)
      .eq("status", "active"),
  ]);

  const recurring    = recurringRes.data ?? [];
  const subs         = subsRes.data ?? [];

  // ── Normalize everything to monthly amounts ─────────────

  let fixedMonthlyIncome   = 0;
  let fixedMonthlyExpenses = 0;

  for (const r of recurring) {
    const amt = Number(r.amount) || 0;
    let monthly = amt;
    switch (r.frequency) {
      case "weekly":    monthly = amt * 4.33; break;
      case "biweekly":  monthly = amt * 2.17; break;
      case "monthly":   monthly = amt;        break;
      case "quarterly": monthly = amt / 3;    break;
      case "yearly":    monthly = amt / 12;   break;
    }
    if (r.type === "income") fixedMonthlyIncome   += monthly;
    else                     fixedMonthlyExpenses += monthly;
  }

  for (const s of subs) {
    const amt = Number(s.amount) || 0;
    let monthly = amt;
    switch (s.billing_cycle) {
      case "monthly":  monthly = amt;        break;
      case "yearly":   monthly = amt / 12;   break;
      case "weekly":   monthly = amt * 4.33; break;
      case "quarterly":monthly = amt / 3;    break;
      default:         monthly = amt;
    }
    fixedMonthlyExpenses += monthly;
  }

  // ── Baseline from last 3 months historical data ─────────

  const past3 = historical.slice(-4, -1);  // exclude current (last) month
  const baselineIncome   = past3.length ? past3.reduce((s, m) => s + m.income,   0) / past3.length : 0;
  const baselineExpenses = past3.length ? past3.reduce((s, m) => s + m.expenses, 0) / past3.length : 0;

  // Blend: use baseline unless recurring is higher (recurring is a floor)
  const projectedIncome   = Math.max(baselineIncome,   fixedMonthlyIncome);
  const projectedExpenses = Math.max(baselineExpenses, fixedMonthlyExpenses);
  const projectedNet      = projectedIncome - projectedExpenses;
  const projectedSavingsRate = projectedIncome > 0
    ? Math.round((projectedNet / projectedIncome) * 100)
    : 0;

  // ── Build forecast series ───────────────────────────────

  function buildSeries(months: number): ForecastPoint[] {
    const points: ForecastPoint[] = [];
    let cumulative = 0;

    for (let i = 0; i < months; i++) {
      const d = addMonths(monthStart(now), i + 1);
      const net = projectedNet;
      cumulative += net;
      points.push({
        date:              d.toISOString().slice(0, 10),
        label:             dateLabel(d),
        projectedIncome,
        projectedExpenses,
        projectedNet:      net,
        cumulative,
        isActual:          false,
      });
    }
    return points;
  }

  return {
    points30:  buildSeries(1),
    points90:  buildSeries(3),
    points365: buildSeries(12),
    fixedMonthlyIncome,
    fixedMonthlyExpenses,
    baselineIncome,
    baselineExpenses,
    projectedSavingsRate,
  };
}
