import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { getRequestId } from "@/lib/api/responses";
import { rateLimit } from "@/lib/api/rate-limit";
import { logSecurityEvent, getClientIp } from "@/lib/security/audit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const { supabase, user, response } = await requireUser(requestId);
  if (response || !user) return response!;

  const limited = rateLimit(req, { key: "gdpr_export", limit: 2, windowMs: 3_600_000 });
  if (limited) return limited;

  const uid = user.id;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db  = supabase as any;

  const [
    { data: profile },
    { data: profileSettings },
    { data: transactions },
    { data: accounts },
    { data: budgets },
    { data: goals },
    { data: debts },
    { data: investments },
    { data: recurringSubscriptions },
    { data: contacts },
    { data: tags },
    { data: ledgerEntries },
    { data: aiInsights },
    { data: notifications },
    { data: workSessions },
    { data: consent },
    { data: gdprRequests },
  ] = await Promise.all([
    supabase.auth.getUser().then((r: { data: { user: unknown } }) => ({ data: r.data.user })),
    db.from("profile_settings").select("*").eq("user_id", uid).maybeSingle(),
    db.from("transactions").select("*").eq("user_id", uid).limit(10000),
    db.from("accounts").select("*").eq("user_id", uid),
    db.from("budgets").select("*").eq("user_id", uid),
    db.from("goals").select("*").eq("user_id", uid),
    db.from("debts").select("*").eq("user_id", uid),
    db.from("investments").select("*").eq("user_id", uid),
    db.from("subscriptions").select("*").eq("user_id", uid),
    db.from("financial_contacts").select("*").eq("user_id", uid),
    db.from("tags").select("*").eq("user_id", uid),
    db.from("ledger_entries").select("*").eq("user_id", uid).limit(10000),
    db.from("ai_insights").select("*").eq("user_id", uid),
    db.from("notifications").select("*").eq("user_id", uid),
    db.from("work_sessions").select("*").eq("user_id", uid),
    db.from("consent_settings").select("*").eq("user_id", uid).maybeSingle(),
    db.from("gdpr_requests").select("*").eq("user_id", uid),
  ]);

  const exportData = {
    exportedAt: new Date().toISOString(),
    userId:     uid,
    account: {
      id:    (profile as { id?: string })?.id,
      email: user.email,
    },
    profile:               profileSettings,
    consent:               consent,
    transactions:          transactions          ?? [],
    accounts:              accounts              ?? [],
    budgets:               budgets               ?? [],
    goals:                 goals                 ?? [],
    debts:                 debts                 ?? [],
    investments:           investments           ?? [],
    recurringSubscriptions: recurringSubscriptions ?? [],
    contacts:              contacts              ?? [],
    tags:                  tags                  ?? [],
    ledgerEntries:         ledgerEntries         ?? [],
    aiInsights:            aiInsights            ?? [],
    notifications:         notifications         ?? [],
    workSessions:          workSessions          ?? [],
    gdprRequestHistory:    gdprRequests          ?? [],
  };

  await logSecurityEvent({
    userId:    uid,
    eventType: "gdpr_export",
    severity:  "low",
    ipAddress: getClientIp(req),
    metadata:  { exportSize: JSON.stringify(exportData).length },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("gdpr_requests").insert({
    user_id:      uid,
    request_type: "export",
    status:       "completed",
    completed_at: new Date().toISOString(),
    expires_at:   new Date(Date.now() + 7 * 86_400_000).toISOString(),
  });

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      "content-type":        "application/json",
      "content-disposition": `attachment; filename="spendix-data-export-${new Date().toISOString().split("T")[0]}.json"`,
    },
  });
}
