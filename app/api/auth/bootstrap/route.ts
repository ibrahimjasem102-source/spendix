import { requireUser } from "@/lib/api/auth";
import { apiJson, getRequestId } from "@/lib/api/responses";
import { bootstrapAuthenticatedUser } from "@/lib/auth/bootstrap";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const { supabase, user, response } = await requireUser(requestId);
  if (response || !user) return response;

  // Accept optional locale from client so categories are seeded in the right language
  let locale: "ar" | "en" | "de" | undefined;
  try {
    const body = await request.json().catch(() => ({}));
    if (body?.locale === "en" || body?.locale === "de" || body?.locale === "ar") {
      locale = body.locale;
    }
  } catch { /* ignore parse errors */ }

  try {
    const result = await bootstrapAuthenticatedUser(supabase, user, locale);
    return apiJson({ ok: true, ...result }, { requestId });
  } catch (err) {
    console.error("[auth/bootstrap]", { requestId, err });
    return apiJson({ ok: false, error: "Failed to prepare user workspace" }, { status: 500, requestId });
  }
}
