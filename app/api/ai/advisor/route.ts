import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callLLM } from "@/lib/ai/aiClient";
import { buildRichFinancialContext } from "@/lib/ai/financialContextBuilder";
import { buildRichContextString, buildAdvisorSystemPrompt } from "@/lib/ai/aiPromptTemplates";
import { rateLimit } from "@/lib/api/rate-limit";
import type { AdvisorRequest, AdvisorType } from "@/lib/ai/aiTypes";

export const dynamic = "force-dynamic";

const VALID_TYPES: AdvisorType[] = ["budget", "debt", "goals", "subscriptions", "investments", "health"];

export async function POST(req: Request) {
  // Rate limit: 10 advisor requests per minute per IP
  const limitRes = rateLimit(req, { key: "advisor", limit: 10, windowMs: 60_000 });
  if (limitRes) return limitRes;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });

  let body: AdvisorRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { advisorType, language = "en", question } = body;

  if (!VALID_TYPES.includes(advisorType)) {
    return NextResponse.json({ error: "Invalid advisor type" }, { status: 400 });
  }

  const summary       = await buildRichFinancialContext(user.id, supabase);
  const contextString = buildRichContextString(summary);
  const systemPrompt  = buildAdvisorSystemPrompt(advisorType, language, contextString);

  // If user has a specific question, append it; otherwise use the advisor task
  const userMessage = question
    ? question
    : `Please provide a complete ${advisorType} analysis based on my financial data.`;

  const result = await callLLM({
    maxTokens: 800,
    system:    systemPrompt,
    messages:  [{ role: "user", content: userMessage }],
  });

  return NextResponse.json({
    advisorType,
    analysis: result.text,
    model:    result.model,
  });
}
