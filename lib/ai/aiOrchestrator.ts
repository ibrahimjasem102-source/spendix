import "server-only";
import { callLLM } from "./aiClient";
import { buildFinancialContext } from "./financialContextBuilder";
import { generateStructuredInsights } from "./insightEngine";
import { buildChatSystemPrompt, buildFinancialContextString } from "./aiPromptTemplates";
import type {
  ChatMessage,
  ChatResponse,
  AIInsightRecord,
  GenerateInsightsResponse,
} from "./aiTypes";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function orchestrateChat(
  messages: ChatMessage[],
  language: string,
  userId: string,
  supabase: Supabase
): Promise<ChatResponse> {
  const summary = await buildFinancialContext(userId, supabase);
  const contextString = buildFinancialContextString(summary);
  const systemPrompt = buildChatSystemPrompt(language, contextString);

  const result = await callLLM({
    maxTokens: 1024,
    system: systemPrompt,
    messages,
  });

  return { reply: result.text, model: result.model };
}

export async function orchestrateInsightGeneration(
  language: string,
  userId: string,
  supabase: Supabase,
  forceRefresh = false
): Promise<GenerateInsightsResponse> {
  // Return cached insights if fresh enough (< 6 hours old)
  if (!forceRefresh) {
    try {
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      const { data: cached } = await supabase
        .from("ai_insights")
        .select("*")
        .eq("user_id", userId)
        .neq("status", "dismissed")
        .gte("created_at", sixHoursAgo)
        .order("created_at", { ascending: false })
        .limit(6);

      if (cached && cached.length >= 3) {
        return { insights: cached as AIInsightRecord[], generated: false, cached: true };
      }
    } catch {
      // Table may not exist yet — fall through to generate
    }
  }

  const summary = await buildFinancialContext(userId, supabase);
  const rawInsights = await generateStructuredInsights(summary, language);

  const records: AIInsightRecord[] = [];
  const now = new Date().toISOString();

  for (const ins of rawInsights) {
    const record = { user_id: userId, status: "new" as const, ...ins };

    try {
      const { data } = await supabase
        .from("ai_insights")
        .insert(record)
        .select()
        .single();

      records.push(data ? (data as AIInsightRecord) : { id: crypto.randomUUID(), created_at: now, updated_at: now, ...record });
    } catch {
      records.push({ id: crypto.randomUUID(), created_at: now, updated_at: now, ...record });
    }
  }

  return { insights: records, generated: true, cached: false };
}
