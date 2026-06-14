import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { getRequestId } from "@/lib/api/responses";
import { isAdminEmail } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const { user, response } = await requireUser(requestId);
  if (response || !user) return response!;
  if (!isAdminEmail(user.email ?? "")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;

  const [
    { count: totalUsers },
    { count: plusUsers },
    { count: proUsers },
    { count: eliteUsers },
    { data: upgradeEvents },
    { data: recentUpgrades },
  ] = await Promise.all([
    db.from("profile_settings").select("*", { count: "exact", head: true }),

    db.from("subscriptions").select("*", { count: "exact", head: true })
      .eq("status", "active").eq("plan", "plus"),

    db.from("subscriptions").select("*", { count: "exact", head: true })
      .eq("status", "active").eq("plan", "pro"),

    db.from("subscriptions").select("*", { count: "exact", head: true })
      .eq("status", "active").eq("plan", "elite"),

    db.from("product_events").select("event_name, created_at")
      .eq("event_name", "subscription_upgrade_completed")
      .gte("created_at", new Date(Date.now() - 30 * 86_400_000).toISOString())
      .limit(1000),

    db.from("subscriptions")
      .select("plan, status, created_at")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const total   = totalUsers   ?? 0;
  const paid    = (plusUsers ?? 0) + (proUsers ?? 0) + (eliteUsers ?? 0);
  const free    = Math.max(0, total - paid);

  const upgrades30d = (upgradeEvents as unknown[])?.length ?? 0;

  const funnel = [
    { label: "Free",  count: free,             pct: total ? Math.round((free              / total) * 100) : 0 },
    { label: "Plus",  count: plusUsers  ?? 0,  pct: total ? Math.round(((plusUsers  ?? 0) / total) * 100) : 0 },
    { label: "Pro",   count: proUsers   ?? 0,  pct: total ? Math.round(((proUsers   ?? 0) / total) * 100) : 0 },
    { label: "Elite", count: eliteUsers ?? 0,  pct: total ? Math.round(((eliteUsers ?? 0) / total) * 100) : 0 },
  ];

  return NextResponse.json({
    ok: true,
    data: {
      funnel,
      totalUsers:          total,
      paidUsers:           paid,
      paidConversionPct:   total ? Math.round((paid / total) * 100) : 0,
      upgradesLast30Days:  upgrades30d,
      recentSubscriptions: recentUpgrades ?? [],
    },
  });
}
