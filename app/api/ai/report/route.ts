import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callLLM } from "@/lib/ai/aiClient";
import { buildRichFinancialContext } from "@/lib/ai/financialContextBuilder";
import { buildRichContextString, buildReportPrompt } from "@/lib/ai/aiPromptTemplates";
import { rateLimit } from "@/lib/api/rate-limit";
import type { ReportRequest, ReportPeriod } from "@/lib/ai/aiTypes";

export const dynamic = "force-dynamic";

const VALID_PERIODS: ReportPeriod[] = ["weekly", "monthly", "quarterly"];

export async function POST(req: Request) {
  const limitRes = rateLimit(req, { key: "report", limit: 5, windowMs: 60_000 });
  if (limitRes) return limitRes;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });

  let body: ReportRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { period = "monthly", language = "en" } = body;

  if (!VALID_PERIODS.includes(period)) {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }

  const summary       = await buildRichFinancialContext(user.id, supabase);
  const contextString = buildRichContextString(summary);
  const prompt        = buildReportPrompt(period, language, contextString);

  const result = await callLLM({
    maxTokens: 1200,
    system:    prompt,
    messages:  [{ role: "user", content: `Generate my ${period} financial report.` }],
  });

  return NextResponse.json({
    period,
    report:      result.text,
    model:       result.model,
    generatedAt: new Date().toISOString(),
  });
}
