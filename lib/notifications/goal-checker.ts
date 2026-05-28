/**
 * Client-side goal notification checker.
 * Reads goals from localStorage, posts notifications to the API.
 * Deduplicates using sessionStorage so alerts only fire once per session.
 */
"use client";

import { safeFetch } from "@/lib/fetch-safe";
import type { FinancialGoal } from "@/components/goals/GoalFormModal";

const GOALS_KEY   = "spendix_financial_goals";
const SESSION_KEY = "spendix_goal_notifs";

function sentThisSession(key: string): boolean {
  try {
    const sent = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "[]") as string[];
    return sent.includes(key);
  } catch { return false; }
}

function markSent(key: string): void {
  try {
    const sent = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "[]") as string[];
    if (!sent.includes(key)) {
      sent.push(key);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(sent));
    }
  } catch {}
}

async function post(data: {
  title: string; message: string; type: string;
  source: string; priority?: string; action_url?: string;
}): Promise<void> {
  await safeFetch("/api/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ priority: "normal", ...data }),
  }).catch(() => {});
}

export async function runGoalChecker(): Promise<void> {
  try {
    const raw = localStorage.getItem(GOALS_KEY);
    if (!raw) return;
    const goals = JSON.parse(raw) as FinancialGoal[];
    if (!Array.isArray(goals) || goals.length === 0) return;

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);

    for (const goal of goals) {
      const remaining = Math.max(0, (goal.targetAmount ?? 0) - (goal.savedAmount ?? 0));
      const pct       = goal.targetAmount > 0 ? Math.round((goal.savedAmount / goal.targetAmount) * 100) : 0;
      const daysLeft  = Math.ceil((new Date(`${goal.dueDate}T00:00:00`).getTime() - today.getTime()) / 86_400_000);

      // ── Completed ─────────────────────────────────────────────
      if (remaining <= 0) {
        const key = `goal_done_${goal.id}`;
        if (!sentThisSession(key)) {
          await post({
            title:      `هدف "${goal.title}" مكتمل! 🎉`,
            message:    `تهانينا! لقد وصلت إلى هدفك البالغ ${goal.targetAmount.toFixed(2)} بالكامل.`,
            type:       "goal",
            source:     "goal",
            priority:   "high",
            action_url: "/goals",
          });
          markSent(key);
        }
        continue;
      }

      // ── Overdue ───────────────────────────────────────────────
      if (daysLeft < 0) {
        const key = `goal_overdue_${goal.id}_${todayStr}`;
        if (!sentThisSession(key)) {
          await post({
            title:      `هدف متأخر: ${goal.title}`,
            message:    `هدفك تجاوز تاريخ الاستحقاق. المتبقي ${remaining.toFixed(2)} (${pct}% مكتمل). حدّث خطتك.`,
            type:       "warning",
            source:     "goal",
            priority:   "high",
            action_url: "/goals",
          });
          markSent(key);
        }
        continue;
      }

      // ── Near deadline ≤ 7 days ────────────────────────────────
      if (daysLeft <= 7) {
        const key = `goal_near_${goal.id}_${todayStr}`;
        if (!sentThisSession(key)) {
          await post({
            title:      `تذكير: هدف يقترب موعده`,
            message:    `هدف "${goal.title}" يستحق خلال ${daysLeft} يوم${daysLeft !== 1 ? "" : ""}. المتبقي ${remaining.toFixed(2)} (${pct}% مكتمل).`,
            type:       "goal",
            source:     "goal",
            priority:   "high",
            action_url: "/goals",
          });
          markSent(key);
        }
        continue;
      }

      // ── 30 days warning ───────────────────────────────────────
      if (daysLeft <= 30) {
        const key = `goal_30d_${goal.id}_${todayStr.slice(0, 7)}`;
        if (!sentThisSession(key)) {
          await post({
            title:      `هدف يقترب: ${goal.title}`,
            message:    `${daysLeft} يوم متبقي لتحقيق هدفك. تحتاج ${remaining.toFixed(2)} إضافية.`,
            type:       "reminder",
            source:     "goal",
            priority:   "normal",
            action_url: "/goals",
          });
          markSent(key);
        }
        continue;
      }

      // ── Milestone: 50% ───────────────────────────────────────
      if (pct >= 50) {
        const key = `goal_50pct_${goal.id}`;
        if (!sentThisSession(key)) {
          await post({
            title:      `نصف الطريق: ${goal.title}`,
            message:    `وصلت إلى ${pct}% من هدفك. لقد أحرزت تقدماً رائعاً! استمر.`,
            type:       "goal",
            source:     "goal",
            priority:   "low",
            action_url: "/goals",
          });
          markSent(key);
        }
      }
    }
  } catch {
    // Silent fail — never interrupt app load
  }
}
