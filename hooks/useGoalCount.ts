"use client";

import { useEffect, useState } from "react";
import { on } from "@/lib/events";
import type { FinancialGoal } from "@/components/goals/GoalFormModal";

const STORAGE_KEY = "spendix_financial_goals";

function readActiveCount(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const goals = JSON.parse(raw) as FinancialGoal[];
    return Array.isArray(goals)
      ? goals.filter((g) => (g.savedAmount ?? 0) < (g.targetAmount ?? 0)).length
      : 0;
  } catch { return 0; }
}

/** Returns the count of incomplete (active) financial goals from localStorage. */
export function useGoalCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(readActiveCount());
    const off = on("spendix:goal-added", () => setCount(readActiveCount()));
    return off;
  }, []);

  return count;
}
