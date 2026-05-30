import type { Investment } from "@/types";

export type InvestmentInsightType =
  | "strong_performer"
  | "underperformer"
  | "concentrated"
  | "stale_data"
  | "diversified";

export interface InvestmentAnalysisResult {
  type:           InvestmentInsightType;
  totalInvested:  number;
  portfolioValue: number;
  totalGain:      number;
  gainPct:        number;
  topAssetType?:  string;
  topAssetPct?:   number;
  bestPerformer?: { name: string; gainPct: number };
  worstPerformer?:{ name: string; gainPct: number; gainAbs: number };
  staleCount?:    number;
}

/**
 * Returns a single top-level insight about the investment portfolio:
 * concentration risk, gain/loss performance, stale valuations, etc.
 */
export function runInvestmentAnalyzer(
  investments: Investment[],
): InvestmentAnalysisResult | null {
  if (investments.length === 0) return null;

  const totalInvested  = investments.reduce((s, i) => s + i.amount_invested, 0);
  const portfolioValue = investments.reduce(
    (s, i) => s + (i.current_value ?? i.amount_invested),
    0,
  );
  const totalGain = portfolioValue - totalInvested;
  const gainPct   = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

  // Asset-type concentration
  const byType: Record<string, number> = {};
  for (const i of investments) {
    const val = i.current_value ?? i.amount_invested;
    byType[i.asset_type] = (byType[i.asset_type] ?? 0) + val;
  }
  const [topType, topVal] = Object.entries(byType).sort(([, a], [, b]) => b - a)[0] ?? [];
  const topAssetPct = portfolioValue > 0 ? Math.round((topVal / portfolioValue) * 100) : 0;

  // Best/worst performers (only those with current_value)
  const valued = investments
    .filter((i) => i.current_value !== null)
    .map((i) => ({
      name:    i.asset_name,
      gainAbs: i.current_value! - i.amount_invested,
      gainPct: i.amount_invested > 0
        ? ((i.current_value! - i.amount_invested) / i.amount_invested) * 100
        : 0,
    }))
    .sort((a, b) => b.gainPct - a.gainPct);

  const best  = valued[0];
  const worst = valued[valued.length - 1];

  const staleCount = investments.filter((i) => i.current_value === null).length;

  // Determine primary insight
  let type: InvestmentInsightType = "diversified";
  if (investments.length > 1 && topAssetPct > 80) type = "concentrated";
  else if (worst && worst.gainPct < -20)           type = "underperformer";
  else if (best  && best.gainPct  > 20)            type = "strong_performer";
  else if (staleCount > 0)                         type = "stale_data";

  return {
    type,
    totalInvested,
    portfolioValue,
    totalGain:      Math.round(totalGain),
    gainPct:        Math.round(gainPct * 10) / 10,
    topAssetType:   topType,
    topAssetPct,
    bestPerformer:  best  ? { name: best.name,  gainPct: Math.round(best.gainPct  * 10) / 10 } : undefined,
    worstPerformer: worst && worst.gainPct < -5
      ? { name: worst.name, gainPct: Math.round(worst.gainPct * 10) / 10, gainAbs: Math.round(worst.gainAbs) }
      : undefined,
    staleCount,
  };
}
