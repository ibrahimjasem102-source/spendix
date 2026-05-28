import { requireUser } from "@/lib/api/auth";
import { apiJson, getRequestId } from "@/lib/api/responses";
import { rateLimit } from "@/lib/api/rate-limit";
import { readJson } from "@/lib/api/request";
import { orchestrateInsightGeneration } from "@/lib/ai/aiOrchestrator";
import type { GenerateInsightsRequest } from "@/lib/ai/aiTypes";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const limited = rateLimit(request, { key: "ai-insights-generate", limit: 8, windowMs: 60_000 });
  if (limited) return limited;

  const { supabase, user, response } = await requireUser(requestId);
  if (response || !user) return response;

  const body = await readJson<GenerateInsightsRequest>(request);
  const language = body.language ?? "en";
  const forceRefresh = body.forceRefresh ?? false;

  try {
    const result = await orchestrateInsightGeneration(language, user.id, supabase, forceRefresh);
    return apiJson(result, { requestId });
  } catch (err) {
    console.error("[ai/insights/generate]", { requestId, err });
    return apiJson({ error: "Failed to generate insights" }, { status: 503, requestId });
  }
}
