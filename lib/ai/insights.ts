import Anthropic from "@anthropic-ai/sdk";
import { Transaction, AIInsight } from "@/types";

const client = new Anthropic();

const LANGUAGE_NAMES: Record<string, string> = {
  ar: "Arabic",
  en: "English",
  de: "German",
};

const EMPTY_INSIGHT: Record<string, Pick<AIInsight, "title" | "body">> = {
  ar: {
    title: "لا توجد بيانات بعد",
    body: "أضف بعض المعاملات للحصول على رؤى ذكية حول الإنفاق.",
  },
  en: {
    title: "No data yet",
    body: "Add some transactions to get AI-powered spending insights.",
  },
  de: {
    title: "Noch keine Daten",
    body: "Fuege Transaktionen hinzu, um KI-gestuetzte Ausgabeneinblicke zu erhalten.",
  },
};

export async function generateInsights(
  transactions: Transaction[],
  language = "en"
): Promise<AIInsight[]> {
  const languageName = LANGUAGE_NAMES[language] ?? LANGUAGE_NAMES.en;
  const empty = EMPTY_INSIGHT[language] ?? EMPTY_INSIGHT.en;

  if (transactions.length === 0) {
    return [{
      id: "1",
      title: empty.title,
      body: empty.body,
      type: "tip",
    }];
  }

  const totalIncome = transactions
    .filter((transaction) => transaction.type === "income")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const totalExpenses = transactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const categoryBreakdown = transactions
    .filter((transaction) => transaction.type === "expense")
    .reduce<Record<string, number>>((acc, transaction) => {
      const name = transaction.category?.name ?? "Uncategorised";
      acc[name] = (acc[name] || 0) + transaction.amount;
      return acc;
    }, {});

  const topCategories = Object.entries(categoryBreakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([category, amount]) => `${category}: EUR ${amount.toFixed(2)}`)
    .join(", ");

  const prompt = `Analyze this financial data and return exactly 3 insights as a JSON array.

Respond only in ${languageName}.

Financial summary:
- Total income: EUR ${totalIncome.toFixed(2)}
- Total expenses: EUR ${totalExpenses.toFixed(2)}
- Net balance: EUR ${(totalIncome - totalExpenses).toFixed(2)}
- Top spending categories: ${topCategories || "none"}
- Transaction count: ${transactions.length}

Return a JSON array with exactly 3 objects, each with:
- "id": unique string ("1", "2", "3")
- "title": short title (max 8 words)
- "body": actionable insight (1-2 sentences)
- "type": one of "tip", "warning", or "positive"

Use "warning" for overspending or negative balance, "positive" for good habits, "tip" for actionable advice.
Return ONLY the JSON array, no other text.`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "[]";

  try {
    const insights = JSON.parse(text) as AIInsight[];
    return Array.isArray(insights) ? insights : [];
  } catch {
    return [{ id: "1", title: empty.title, body: text.slice(0, 200), type: "tip" }];
  }
}
