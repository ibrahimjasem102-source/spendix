import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getDashboardStats } from "@/lib/analytics/analyticsService";

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  de: "German (Deutsch)",
  ar: "Arabic (العربية)",
};

const client = new Anthropic();

interface RequestBody {
  messages: { role: "user" | "assistant"; content: string }[];
  language: string;
}

export async function POST(request: Request) {
  const body: RequestBody = await request.json();
  const { messages, language } = body;
  const languageName = LANGUAGE_NAMES[language] ?? "English";

  // ── Build rich financial context from real DB ─────────────────
  let financialContext = "";
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const dashboard = await getDashboardStats(user.id, supabase);

      const topCategories = dashboard.spendingByCategory
        .slice(0, 5)
        .map((c) => `${c.name}: €${c.value.toFixed(0)}`)
        .join(", ");

      const debtInfo = dashboard.debtTruth;

      financialContext = `
REAL-TIME FINANCIAL CONTEXT (live from user's database):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 BALANCE & CASHFLOW:
- Net Balance: €${dashboard.totalBalance.toFixed(2)}
- Monthly Income: €${dashboard.monthlyIncome.toFixed(2)}
- Monthly Expenses: €${dashboard.monthlyExpenses.toFixed(2)}
- Savings Rate: ${dashboard.savingsRate}%
- Daily Burn Rate: €${dashboard.dailyBurn.toFixed(2)}/day
- Work Income: €${dashboard.workIncome.toFixed(2)}
- Total Transactions: ${dashboard.transactionCount}

🏦 DEBT SITUATION:
- Net Debt Exposure: €${debtInfo.net_debt_exposure.toFixed(2)}
- Money I Owe (Payable): €${debtInfo.total_payable_remaining.toFixed(2)}
- Money Owed to Me (Receivable): €${debtInfo.total_receivable_remaining.toFixed(2)}
- Active Debts: ${debtInfo.active_debts}
- Overdue Debts: ${debtInfo.overdue_debts}
- Debt Recovery Rate: ${(debtInfo.debt_recovery_rate * 100).toFixed(0)}%
- Overdue Ratio: ${(debtInfo.overdue_ratio * 100).toFixed(0)}%

📊 TOP SPENDING CATEGORIES (this month):
${topCategories || "No spending data yet"}

📈 INCOME VS EXPENSES TREND (last 6 months):
${dashboard.incomeVsExpenses.slice(-3).map(m => `${m.month}: income €${m.income.toFixed(0)}, expenses €${m.expenses.toFixed(0)}, savings €${m.savings.toFixed(0)}`).join("\n")}

📋 RECENT TRANSACTIONS:
${dashboard.recentTransactions.slice(0, 5).map(t => `- ${t.title}: €${Number(t.amount).toFixed(2)} (${t.type}, ${t.transaction_date})`).join("\n")}
`.trim();
    }
  } catch {
    // Fallback if analytics unavailable
    financialContext = "Note: Live financial data temporarily unavailable. Provide general advice.";
  }

  const systemPrompt = `You are Spendix AI, an expert personal finance advisor embedded in the Spendix Financial OS.

CRITICAL: You MUST respond ONLY in ${languageName}. Every single word must be in ${languageName}.

${financialContext}

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
- Be encouraging but honest about problems
- Never give generic advice that ignores their real data`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });

  const reply = message.content[0].type === "text" ? message.content[0].text : "";
  return NextResponse.json({ reply });
}
