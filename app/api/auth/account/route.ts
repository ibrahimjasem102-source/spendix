import { requireUser } from "@/lib/api/auth";
import { apiJson, getRequestId } from "@/lib/api/responses";
import { createAdminClient } from "@/lib/supabase/admin";

const USER_TABLES = [
  "transactions", "goals", "budgets", "categories", "accounts",
  "financial_contacts", "investments", "debts", "debt_payments",
  "work_sessions", "work_payments", "tags", "subscriptions",
  "recurring_transactions",
  "notifications", "ai_insights", "profile_settings",
] as const;

export async function DELETE(request: Request) {
  const requestId = getRequestId(request);
  const { supabase, user, response } = await requireUser(requestId);
  if (response || !user) return response;

  // Delete all user data before removing the auth record
  for (const table of USER_TABLES) {
    const { error } = await supabase.from(table).delete().eq("user_id", user.id);
    if (error) console.warn(`[auth/account] delete ${table}:`, error.message);
  }

  // Remove household memberships
  await supabase.from("household_members").delete().eq("user_id", user.id);

  // Remove profile
  await supabase.from("profiles").delete().eq("id", user.id);

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("[auth/account] delete user:", error);
    return apiJson({ error: "Failed to delete account" }, { status: 500, requestId });
  }

  return apiJson({ ok: true }, { requestId });
}
