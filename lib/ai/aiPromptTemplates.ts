import type { FinancialSummary, FinancialSummaryV2, AdvisorType, ReportPeriod } from "./aiTypes";

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  de: "German (Deutsch)",
  ar: "Arabic",
};

export function getLanguageName(language: string): string {
  return LANGUAGE_NAMES[language] ?? "English";
}

export function buildFinancialContextString(summary: FinancialSummary): string {
  const topCats = summary.topCategories
    .map((category) => `${category.name}: ${category.amount.toFixed(0)}`)
    .join(", ");

  const budgets = summary.budgets
    .map((budget) =>
      `${budget.name}: spent ${budget.spent.toFixed(0)} / limit ${budget.limit.toFixed(0)} ` +
      `(${budget.percent}%, ${budget.status}, remaining ${budget.remaining.toFixed(0)})`
    )
    .join("\n");

  const trend = summary.monthlyTrend
    .map((month) => `${month.month}: income ${month.income.toFixed(0)}, expenses ${month.expenses.toFixed(0)}`)
    .join("\n");

  const recent = summary.recentTransactions
    .map((transaction) =>
      `- ${transaction.title}: ${transaction.amount.toFixed(2)} (${transaction.type}, ${transaction.date})`
    )
    .join("\n");

  return `
REAL-TIME FINANCIAL CONTEXT:

BALANCE & CASHFLOW:
- Net Balance: ${summary.totalBalance.toFixed(2)}
- Monthly Income: ${summary.monthlyIncome.toFixed(2)}
- Monthly Expenses: ${summary.monthlyExpenses.toFixed(2)}
- Savings Rate: ${summary.savingsRate}%
- Daily Burn Rate: ${summary.dailyBurn.toFixed(2)}/day
- Work Income: ${summary.workIncome.toFixed(2)}
- Total Transactions: ${summary.transactionCount}

DEBT SITUATION:
- Money I Owe (Payable): ${summary.debtPayable.toFixed(2)}
- Money Owed to Me (Receivable): ${summary.debtReceivable.toFixed(2)}
- Active Debts: ${summary.activeDebts}
- Overdue Debts: ${summary.overdueDebts}

TOP SPENDING CATEGORIES:
${topCats || "No spending data yet"}

BUDGETS THIS MONTH:
${budgets || "No budgets configured this month"}

INCOME VS EXPENSES TREND (last 3 months):
${trend || "No trend data yet"}

RECENT TRANSACTIONS:
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
- Do not claim a budget is near/over its limit unless it appears in BUDGETS THIS MONTH with status "near_limit" or "over"
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
- "critical": immediate action needed (overdue debts, negative balance, burn > 100% income, budget status "over")
- "warning": attention needed (savings < 10%, high burn 80-100%, approaching debt due, budget status "near_limit")
- "positive": good habits or achievements (savings > 20%, debts reducing, income growing)
- "info": neutral observations and tips

Budget accuracy rule:
- Only mention a budget as near limit, depleted, or exceeded when BUDGETS THIS MONTH explicitly shows status "near_limit" or "over".
- If no budgets are configured, discuss spending categories instead of budget limits.

Return ONLY a valid JSON array, no markdown fences, no other text.`;
}

// ── Rich context string (v2) ───────────────────────────────────

export function buildRichContextString(summary: FinancialSummaryV2): string {
  const base = buildFinancialContextString(summary);

  const invSection = summary.investments.count > 0
    ? `\nINVESTMENTS:\n- Portfolio Value: ${summary.investments.totalValue.toFixed(2)}\n- Total Invested: ${summary.investments.totalInvested.toFixed(2)}\n- Profit/Loss: ${summary.investments.profitLoss.toFixed(2)} (${summary.investments.profitLossPct}%)\n- Assets: ${summary.investments.count}, Top: ${summary.investments.topAsset ?? "N/A"}`
    : "\nINVESTMENTS: None configured yet";

  const subsSection = summary.subscriptions.active.length > 0
    ? `\nSUBSCRIPTIONS (Monthly total: ${summary.subscriptions.totalMonthly.toFixed(2)}):\n` +
      summary.subscriptions.active.slice(0, 8).map(s => `- ${s.name}: ${s.amount}/${s.cycle}`).join("\n")
    : "\nSUBSCRIPTIONS: None active";

  const goalsSection = summary.goals.length > 0
    ? `\nGOALS:\n` +
      summary.goals.map(g => `- ${g.name}: ${g.progress}% (${g.current.toFixed(0)}/${g.target.toFixed(0)})${g.monthlyNeeded ? `, ~${g.monthlyNeeded} months remaining` : ""}`).join("\n")
    : "\nGOALS: None active";

  const debtSection = summary.debtDetails.length > 0
    ? `\nDEBT DETAILS:\n` +
      summary.debtDetails.slice(0, 6).map(d =>
        `- ${d.name}: ${d.remaining.toFixed(0)} (${d.direction})${d.isOverdue ? " [OVERDUE]" : ""}${d.dueDate ? ` due ${d.dueDate}` : ""}`
      ).join("\n")
    : "\nDEBT DETAILS: No active debts";

  const workSection = summary.workDetails.hoursThisMonth > 0
    ? `\nWORK THIS MONTH:\n- Hours: ${summary.workDetails.hoursThisMonth.toFixed(1)}\n- Expected: ${summary.workDetails.expected.toFixed(2)}\n- Received: ${summary.workDetails.received.toFixed(2)}\n- Unpaid: ${summary.workDetails.unpaid.toFixed(2)}`
    : "\nWORK: No work sessions this month";

  const healthSection = `\nFINANCIAL HEALTH SCORE: ${summary.health.score}/100 (${summary.health.label})\n- Savings Rate: ${summary.health.savingsRate}%\n- Debt Ratio: ${summary.health.debtRatio}× monthly income\n- Net Worth: ${summary.netWorth.toFixed(2)}`;

  const forecastSection = `\nFORECAST (next month projection):\n- Projected Income: ${summary.forecastMonthly.projectedIncome.toFixed(2)}\n- Projected Expenses: ${summary.forecastMonthly.projectedExpenses.toFixed(2)}\n- Projected Net: ${summary.forecastMonthly.projectedNet.toFixed(2)}`;

  return [base, invSection, subsSection, goalsSection, debtSection, workSection, healthSection, forecastSection].join("\n");
}

// ── Advisor system prompts ─────────────────────────────────────

const ADVISOR_INTROS: Record<AdvisorType, string> = {
  budget: "You are a Budget Advisor. Analyze spending patterns and suggest specific, actionable budget optimizations.",
  debt:   "You are a Debt Strategist. Analyze debts and recommend the optimal payoff strategy (Snowball, Avalanche, or Hybrid) with a concrete step-by-step plan.",
  goals:  "You are a Goal Planning Expert. Analyze financial goals and suggest monthly contributions, target dates, and success probability.",
  subscriptions: "You are a Subscription Auditor. Identify waste, detect duplicates, and recommend cuts in subscription spending.",
  investments: "You are a Portfolio Educator. Provide EDUCATIONAL insights about portfolio allocation and diversification. NEVER give specific buy/sell advice. Always clarify you are not a licensed financial advisor.",
  health: "You are a Financial Health Coach. Provide a comprehensive health assessment with prioritized action items.",
};

const ADVISOR_TASK: Record<AdvisorType, string> = {
  budget:        "1. Identify the top 3 overspending categories.\n2. Suggest specific reduction targets with amounts.\n3. Calculate how much could be saved monthly with these cuts.\n4. Recommend which budget category to create or adjust.",
  debt:          "1. List all debts from highest priority to lowest.\n2. Recommend Snowball (smallest first), Avalanche (highest interest first), or Hybrid — explain why.\n3. Calculate estimated months to debt freedom at current pace.\n4. Show how allocating 10-20% more could accelerate payoff.",
  goals:         "1. Assess each goal's feasibility given current income/expenses.\n2. Recommend specific monthly contribution amounts for each goal.\n3. Estimate completion dates.\n4. Flag any goal that is unrealistic at current savings rate.",
  subscriptions: "1. Calculate total monthly subscription cost.\n2. Flag any that seem unused or redundant.\n3. Identify if any appear to be duplicate services.\n4. Estimate monthly savings if recommended cuts are made.",
  investments:   "1. Comment on portfolio diversification (by asset type).\n2. Note any concentration risk (>60% in one asset type).\n3. Comment on overall performance (profit/loss %).\n4. Suggest educational resources or rebalancing concepts — no specific buy/sell advice.",
  health:        "1. Summarize the health score with factor breakdown.\n2. Identify the #1 most impactful improvement to make.\n3. List 3 specific next actions ranked by impact.\n4. Project health score improvement in 3 months if actions are taken.",
};

export function buildAdvisorSystemPrompt(
  type: AdvisorType,
  language: string,
  contextString: string,
): string {
  const languageName = getLanguageName(language);
  return `${ADVISOR_INTROS[type]}

CRITICAL: Respond ONLY in ${languageName}.

${contextString}

YOUR TASK:
${ADVISOR_TASK[type]}

RESPONSE FORMAT:
- Be specific with numbers from the data above
- Use clear sections with headers
- Max 300 words total
- Be direct, not generic`;
}

// ── Financial report prompts ───────────────────────────────────

const REPORT_PERIODS: Record<ReportPeriod, string> = {
  weekly:    "this week",
  monthly:   "this month",
  quarterly: "the last 3 months",
};

export function buildReportPrompt(
  period: ReportPeriod,
  language: string,
  contextString: string,
): string {
  const languageName = getLanguageName(language);
  const periodLabel  = REPORT_PERIODS[period];

  return `You are a Financial Report Generator. Create a concise financial report for ${periodLabel}.

CRITICAL: Respond ONLY in ${languageName}.

${contextString}

Generate a structured financial report with these sections:
1. EXECUTIVE SUMMARY (2-3 sentences: overall financial health for ${periodLabel})
2. INCOME & EXPENSES (key numbers, vs previous period if trend data available)
3. SAVINGS & CASHFLOW (savings rate, net change, key observations)
4. DEBT STATUS (total owed, progress, any overdue issues)
5. GOALS PROGRESS (each goal's status in one line)
6. TOP INSIGHTS (3 bullet points: the most important things to know)
7. ACTION ITEMS (3 concrete next steps for the coming period)

Use the real data from the context above. Be specific with numbers. Keep each section brief.`;
}
