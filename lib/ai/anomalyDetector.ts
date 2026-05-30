import type { Transaction } from "@/types";

export interface SpendingAnomaly {
  categoryName: string;
  currentMonthAmount: number;
  avgPreviousMonths: number;
  pctIncrease: number;
  monthsAnalyzed: number;
  type: "category_spike" | "large_transaction";
  transactionTitle?: string;
}

/**
 * Detects spending anomalies by comparing the current month's per-category
 * spending against the 3-month average for the same categories.
 */
export function runAnomalyDetector(
  transactions: Transaction[],
  now: Date = new Date(),
): SpendingAnomaly[] {
  const expenses = transactions.filter((t) => t.type === "expense");
  if (expenses.length === 0) return [];

  const currentYear  = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentKey   = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;

  // Group by category → month → total amount
  const grouped: Record<string, Record<string, number>> = {};
  for (const tx of expenses) {
    const ym  = tx.transaction_date?.slice(0, 7);
    if (!ym) continue;
    const cat = tx.category?.name ?? "Uncategorized";
    grouped[cat]     ??= {};
    grouped[cat][ym] = (grouped[cat][ym] ?? 0) + Number(tx.amount);
  }

  const results: SpendingAnomaly[] = [];
  const seen = new Set<string>();

  // Category spike detection
  for (const [cat, byMonth] of Object.entries(grouped)) {
    const current = byMonth[currentKey] ?? 0;
    if (current === 0) continue;

    const prev = Object.entries(byMonth)
      .filter(([k]) => k < currentKey)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 3)
      .map(([, v]) => v);

    if (prev.length === 0) continue;

    const avg        = prev.reduce((s, v) => s + v, 0) / prev.length;
    const pctIncrease = avg > 0 ? Math.round(((current - avg) / avg) * 100) : 0;

    if (pctIncrease >= 35 && current - avg >= 20) {
      results.push({
        categoryName:        cat,
        currentMonthAmount:  current,
        avgPreviousMonths:   Math.round(avg),
        pctIncrease,
        monthsAnalyzed:      prev.length,
        type:                "category_spike",
      });
      seen.add(cat);
    }
  }

  // Large-transaction detection within current month (>3× category average)
  const currentMonthTx = expenses.filter((t) => t.transaction_date?.startsWith(currentKey));
  for (const tx of currentMonthTx) {
    const cat    = tx.category?.name ?? "Uncategorized";
    if (seen.has(cat)) continue;
    const allAmt = expenses
      .filter((t) => t.category?.name === cat)
      .map((t) => Number(t.amount));
    if (allAmt.length < 3) continue;
    const avg = allAmt.reduce((s, v) => s + v, 0) / allAmt.length;
    if (Number(tx.amount) > avg * 3 && Number(tx.amount) > 80) {
      results.push({
        categoryName:        cat,
        currentMonthAmount:  Number(tx.amount),
        avgPreviousMonths:   Math.round(avg),
        pctIncrease:         Math.round(((Number(tx.amount) - avg) / avg) * 100),
        monthsAnalyzed:      1,
        type:                "large_transaction",
        transactionTitle:    tx.title,
      });
      seen.add(cat);
    }
  }

  return results.sort((a, b) => b.pctIncrease - a.pctIncrease);
}
