import { requireUser } from "@/lib/api/auth";
import { apiJson, badRequest, getRequestId } from "@/lib/api/responses";
import { rateLimit } from "@/lib/api/rate-limit";
import { readJson } from "@/lib/api/request";
import { orchestrateChat } from "@/lib/ai/aiOrchestrator";
import type { ChatRequest } from "@/lib/ai/aiTypes";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const limited = rateLimit(request, { key: "ai-chat", limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  const { supabase, user, response } = await requireUser(requestId);
  if (response || !user) return response;

  const body = await readJson<ChatRequest>(request);
  const { messages, language = "en" } = body;

  if (!messages?.length) {
    return badRequest("ai_assistant.empty_reply", requestId);
  }

  try {
    const result = await orchestrateChat(messages, language, user.id, supabase);
    return apiJson(result, { requestId });
  } catch (err) {
    console.error("[ai/chat]", { requestId, err });
    return apiJson({ error: "AI service unavailable" }, { status: 503, requestId });
  }
}
