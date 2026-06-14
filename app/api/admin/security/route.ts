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

  const since24h  = new Date(Date.now() - 86_400_000).toISOString();
  const since7d   = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [
    { data: recentEvents },
    { count: failedLogins24h },
    { count: highSeverity24h },
    { count: rateLimitHits7d },
    { data: topIps },
  ] = await Promise.all([
    db.from("security_events")
      .select("id, event_type, severity, ip_address, user_id, path, metadata, created_at")
      .gte("created_at", since24h)
      .order("created_at", { ascending: false })
      .limit(50),

    db.from("security_events")
      .select("*", { count: "exact", head: true })
      .eq("event_type", "login_failed")
      .gte("created_at", since24h),

    db.from("security_events")
      .select("*", { count: "exact", head: true })
      .in("severity", ["high","critical"])
      .gte("created_at", since24h),

    db.from("security_events")
      .select("*", { count: "exact", head: true })
      .eq("event_type", "rate_limit_exceeded")
      .gte("created_at", since7d),

    db.from("security_events")
      .select("ip_address, count:id")
      .gte("created_at", since24h)
      .not("ip_address", "is", null)
      .limit(10),
  ]);

  return NextResponse.json({
    ok: true,
    data: {
      summary: {
        failedLogins24h:  failedLogins24h  ?? 0,
        highSeverity24h:  highSeverity24h  ?? 0,
        rateLimitHits7d:  rateLimitHits7d  ?? 0,
      },
      recentEvents: recentEvents ?? [],
      topIps:       topIps ?? [],
    },
  });
}
