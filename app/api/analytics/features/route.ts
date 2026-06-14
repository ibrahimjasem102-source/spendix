import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { getRequestId } from "@/lib/api/responses";
import { isAdminEmail } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Map page paths → feature names for grouping
const PAGE_TO_FEATURE: Record<string, string> = {
  "/dashboard":     "Dashboard",
  "/transactions":  "Transactions",
  "/ledger":        "Ledger",
  "/budgets":       "Budgets",
  "/goals":         "Goals",
  "/investments":   "Investments",
  "/debts":         "Debts",
  "/accounts":      "Accounts",
  "/analytics":     "Analytics",
  "/ai-assistant":  "AI Assistant",
  "/ai-insights":   "AI Insights",
  "/work":          "Work Tracker",
  "/invoices":      "Invoices",
  "/projects":      "Projects",
  "/automation":    "Automation",
  "/contacts":      "Contacts",
  "/subscriptions": "Subscriptions",
  "/calendar":      "Calendar",
  "/net-worth":     "Net Worth",
  "/household":     "Household",
  "/recurring":     "Recurring",
  "/tags":          "Tags",
  "/export":        "Export",
  "/plans":         "Plans",
  "/settings":      "Settings",
};

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const { user, response } = await requireUser(requestId);
  if (response || !user) return response!;
  if (!isAdminEmail(user.email ?? "")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const url   = new URL(req.url);
  const days  = Math.min(parseInt(url.searchParams.get("days") ?? "30"), 90);
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;

  const { data: samples } = await db
    .from("performance_samples")
    .select("page, user_id")
    .gte("created_at", since)
    .limit(10000) as { data: { page: string; user_id: string | null }[] };

  // Aggregate by feature
  const featureStats = new Map<string, { sessions: number; uniqueUsers: Set<string> }>();

  for (const sample of samples ?? []) {
    // Normalize path (strip trailing slash, query params)
    const cleanPath = sample.page.split("?")[0].replace(/\/$/, "") || "/";
    const feature   = PAGE_TO_FEATURE[cleanPath] ?? `Other (${cleanPath.slice(0, 20)})`;

    if (!featureStats.has(feature)) {
      featureStats.set(feature, { sessions: 0, uniqueUsers: new Set() });
    }
    const stat = featureStats.get(feature)!;
    stat.sessions += 1;
    if (sample.user_id) stat.uniqueUsers.add(sample.user_id);
  }

  const features = [...featureStats.entries()]
    .map(([name, stat]) => ({
      feature:     name,
      sessions:    stat.sessions,
      uniqueUsers: stat.uniqueUsers.size,
    }))
    .sort((a, b) => b.sessions - a.sessions);

  const totalSessions = features.reduce((s, f) => s + f.sessions, 0);

  return NextResponse.json({
    ok: true,
    data: {
      features,
      totalSessions,
      periodDays: days,
      since,
    },
  });
}
