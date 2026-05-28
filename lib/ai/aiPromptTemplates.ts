import type { FinancialSummary } from "./aiTypes";

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  de: "German (Deutsch)",
  ar: "Arabic (العربية)",
};

export function getLanguageName(language: string): string {
  return LANGUAGE_NAMES[language] ?? "English";
}

export function buildFinancialContextString(summary: FinancialSummary): string {
  const topCats = summary.topCategories
    .map((c) => `${c.name}: €${c.amount.toFixed(0)}`)
    .join(", ");

  const trend = summary.monthlyTrend
    .map((m) => `${m.month}: income €${m.income.toFixed(0)}, expenses €${m.expenses.toFixed(0)}`)
    .join("\n");

  const recent = summary.recentTransactions
    .map((t) => `- ${t.title}: €${t.amount.toFixed(2)} (${t.type}, ${t.date})`)
    .join("\n");

  return `
REAL-TIME FINANCIAL CONTEXT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 BALANCE & CASHFLOW:
- Net Balance: €${summary.totalBalance.toFixed(2)}
- Monthly Income: €${summary.monthlyIncome.toFixed(2)}
- Monthly Expenses: €${summary.monthlyExpenses.toFixed(2)}
- Savings Rate: ${summary.savingsRate}%
- Daily Burn Rate: €${summary.dailyBurn.toFixed(2)}/day
- Work Income: €${summary.workIncome.toFixed(2)}
- Total Transactions: ${summary.transactionCount}

🏦 DEBT SITUATION:
- Money I Owe (Payable): €${summary.debtPayable.toFixed(2)}
- Money Owed to Me (Receivable): €${summary.debtReceivable.toFixed(2)}
- Active Debts: ${summary.activeDebts}
- Overdue Debts: ${summary.overdueDebts}

📊 TOP SPENDING CATEGORIES:
${topCats || "No spending data yet"}

📈 INCOME VS EXPENSES TREND (last 3 months):
${trend || "No trend data yet"}

📋 RECENT TRANSACTIONS:
${recent || "No recent transactions"}
`.trim();
}

export function buildChatSystemPrompt(language: string, contextString: string): string {
  const languageName = getLanguageName(language);
  return `You are Spendix AI, an expert personal finance advisor embedded in the Spendix Financial OS.

CRITICAL: You MUST respond ONLY in ${languageName}. Every single word must be in ${languageName}.

${contextString}

YOUR ROLE:
- Analyze the user's REAL financial data above
- Give specific, actionable advice based on their actual numbers
- Reference specific amounts from their data when relevant
- Identify risks (overdue debts, high burn rate, low savings)
- Celebrate wins (good savings rate, debt recovery)
- Suggest concrete next steps

RESPONSE STYLE:
- Be direct and specific, not generic
- 2-4 sentences for simple questions, up to 8 for complex analysis
- Use numbers from their data
- Be encouraging but honest about problems`;
}

export function buildInsightGenerationPrompt(
  language: string,
  contextString: string
): string {
  const languageName = getLanguageName(language);

  return `You are a financial analysis engine. Analyze the user's real financial data and generate structured insights.

CRITICAL: All "title" and "body" values MUST be written ONLY in ${languageName}.

${contextString}

Generate 4-6 financial insights as a JSON array. Each insight must have:
- "category": one of "savings" | "spending" | "debt" | "investment" | "income" | "cashflow" | "risk" | "goal"
- "severity": one of "critical" | "warning" | "positive" | "info"
- "title": short title (max 8 words) in ${languageName}
- "body": actionable insight (1-2 sentences) in ${languageName}
- "action": optional short action text (e.g. "Review debts") in ${languageName}
- "action_url": optional URL path from: "/debts", "/transactions", "/investments", "/work", "/analytics"
- "confidence": number 0.0-1.0

Severity rules:
- "critical": immediate action needed (overdue debts, negative balance, burn > 100% income)
- "warning": attention needed (savings < 10%, high burn 80-100%, approaching debt due)
- "positive": good habits or achievements (savings > 20%, debts reducing, income growing)
- "info": neutral observations and tips

Return ONLY a valid JSON array, no markdown fences, no other text.`;
}
