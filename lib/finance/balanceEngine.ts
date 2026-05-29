import type { UnifiedLedgerEntry } from "@/lib/ledger/types";

// ── Types ─────────────────────────────────────────────────────

export interface BalanceBreakdown {
  transactionInflow:  number;
  transactionOutflow: number;
  workIncome:         number;
  investmentOutflow:  number;
  netCashPosition:    number;
  netWorthPosition:   number;   // cash + portfolio − outstanding debt
}

export interface MonthlyBalance {
  month:   string;   // short label e.g. "Jan 25"
  yearMonth: string; // YYYY-MM for sorting
  inflow:  number;
  outflow: number;
  net:     number;
  savings: number;   // savings rate %
}

// ── Pure functions ─────────────────────────────────────────────

export function computeBalanceBreakdown(
  ledgerEntries: UnifiedLedgerEntry[],
  portfolioValue: number,
  debtPayable:    number,
): BalanceBreakdown {
  let transactionInflow  = 0;
  let transactionOutflow = 0;
  let workIncome         = 0;
  let investmentOutflow  = 0;

  for (const e of ledgerEntries) {
    if (e.type === "transaction") {
      if (e.direction === "inflow")  transactionInflow  += e.amount;
      if (e.direction === "outflow") transactionOutflow += e.amount;
    } else if (e.type === "income") {
      workIncome += e.amount;
    } else if (e.type === "investment") {
      investmentOutflow += e.amount;
    }
  }

  const netCashPosition  = transactionInflow + workIncome - transactionOutflow;
  const netWorthPosition = netCashPosition + portfolioValue - debtPayable;

  return {
    transactionInflow,
    transactionOutflow,
    workIncome,
    investmentOutflow,
    netCashPosition,
    netWorthPosition,
  };
}

export function computeMonthlyBalances(
  ledgerEntries: UnifiedLedgerEntry[],
  monthCount = 6,
): MonthlyBalance[] {
  const map = new Map<string, { inflow: number; outflow: number }>();

  for (const e of ledgerEntries) {
    if (e.type !== "transaction" && e.type !== "income") continue;
    const ym = e.date.slice(0, 7);
    if (!map.has(ym)) map.set(ym, { inflow: 0, outflow: 0 });
    const m = map.get(ym)!;
    if (e.direction === "inflow")  m.inflow  += e.amount;
    if (e.direction === "outflow") m.outflow += e.amount;
  }

  const now    = new Date();
  const result: MonthlyBalance[] = [];

  for (let i = monthCount - 1; i >= 0; i--) {
    const d  = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = d.toISOString().slice(0, 7);
    const label = d.toLocaleString("default", { month: "short", year: "2-digit" });
    const data  = map.get(ym) ?? { inflow: 0, outflow: 0 };
    result.push({
      month:     label,
      yearMonth: ym,
      inflow:    data.inflow,
      outflow:   data.outflow,
      net:       data.inflow - data.outflow,
      savings:   data.inflow > 0
        ? Math.round(((data.inflow - data.outflow) / data.inflow) * 100)
        : 0,
    });
  }

  return result;
}
