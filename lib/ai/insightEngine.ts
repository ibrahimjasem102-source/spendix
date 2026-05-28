import "server-only";
import { callLLM } from "./aiClient";
import { buildInsightGenerationPrompt, buildFinancialContextString } from "./aiPromptTemplates";
import type {
  FinancialSummary,
  AIInsightRecord,
  InsightCategory,
  InsightSeverity,
} from "./aiTypes";

interface RawInsight {
  category?: string;
  severity?: string;
  title?: string;
  body?: string;
  action?: string;
  action_url?: string;
  confidence?: number;
}

const VALID_CATEGORIES: InsightCategory[] = [
  "savings", "spending", "debt", "investment", "income", "cashflow", "risk", "goal",
];
const VALID_SEVERITIES: InsightSeverity[] = ["critical", "warning", "positive", "info"];

function sanitize(
  raw: RawInsight
): Omit<AIInsightRecord, "id" | "user_id" | "status" | "created_at" | "updated_at"> {
  return {
    category: VALID_CATEGORIES.includes(raw.category as InsightCategory)
      ? (raw.category as InsightCategory)
      : "cashflow",
    severity: VALID_SEVERITIES.includes(raw.severity as InsightSeverity)
      ? (raw.severity as InsightSeverity)
      : "info",
    title: String(raw.title ?? "").slice(0, 120),
    body: String(raw.body ?? "").slice(0, 500),
    action: raw.action ? String(raw.action).slice(0, 60) : null,
    action_url: raw.action_url ? String(raw.action_url).slice(0, 120) : null,
    confidence: Math.min(1, Math.max(0, Number(raw.confidence ?? 0.7))),
  };
}

export async function generateStructuredInsights(
  summary: FinancialSummary,
  language: string
): Promise<Omit<AIInsightRecord, "id" | "user_id" | "status" | "created_at" | "updated_at">[]> {
  const contextString = buildFinancialContextString(summary);
  const prompt = buildInsightGenerationPrompt(language, contextString);

  const result = await callLLM({
    maxTokens: 1200,
    messages: [{ role: "user", content: prompt }],
    jsonMode: true,
  });

  // Strip markdown code fences if present
  let jsonText = result.text.trim();
  const fenced = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) jsonText = fenced[1].trim();

  let parsed: RawInsight[] = [];
  try {
    const candidate = JSON.parse(jsonText);
    parsed = Array.isArray(candidate) ? candidate : [];
  } catch {
    parsed = [];
  }

  return parsed.slice(0, 6).map(sanitize);
}
