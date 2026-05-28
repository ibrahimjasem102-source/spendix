import { requireUser } from "@/lib/api/auth";
import { apiJson, getRequestId } from "@/lib/api/responses";
import { bootstrapAuthenticatedUser } from "@/lib/auth/bootstrap";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const { supabase, user, response } = await requireUser(requestId);
  if (response || !user) return response;

  try {
    const result = await bootstrapAuthenticatedUser(supabase, user);
    return apiJson({ ok: true, ...result }, { requestId });
  } catch (err) {
    console.error("[auth/bootstrap]", { requestId, err });
    return apiJson({ ok: false, error: "Failed to prepare user workspace" }, { status: 500, requestId });
  }
}
