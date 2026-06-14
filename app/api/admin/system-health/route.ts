import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { getRequestId } from "@/lib/api/responses";
import { isAdminEmail } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function measureDbLatency(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  table: string,
): Promise<number> {
  const start = Date.now();
  await db.from(table).select("id", { count: "exact", head: true }).limit(0);
  return Date.now() - start;
}

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const { user, response } = await requireUser(requestId);
  if (response || !user) return response!;

  if (!isAdminEmail(user.email ?? "")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;

  const start = Date.now();

  const [
    transactionsLatency,
    ledgerLatency,
    { count: totalUsers },
    { count: totalTransactions },
    { count: totalGoals },
    { data: recentErrors },
    { count: pendingGdpr },
  ] = await Promise.all([
    measureDbLatency(db, "transactions"),
    measureDbLatency(db, "ledger_entries"),
    db.from("profile_settings").select("*", { count: "exact", head: true }),
    db.from("transactions").select("*",      { count: "exact", head: true }),
    db.from("goals").select("*",             { count: "exact", head: true }),
    db.from("frontend_errors").select("message, created_at")
      .gte("created_at", new Date(Date.now() - 3_600_000).toISOString())
      .order("created_at", { ascending: false }).limit(10),
    db.from("gdpr_requests").select("*", { count: "exact", head: true })
      .in("status", ["pending","processing"]),
  ]);

  const totalLatency = Date.now() - start;

  return NextResponse.json({
    ok: true,
    data: {
      status: totalLatency < 5000 ? "healthy" : "degraded",
      latency: {
        totalHealthCheckMs: totalLatency,
        transactionsTableMs: transactionsLatency,
        ledgerTableMs:       ledgerLatency,
      },
      counts: {
        users:        totalUsers        ?? 0,
        transactions: totalTransactions ?? 0,
        goals:        totalGoals        ?? 0,
        pendingGdpr:  pendingGdpr       ?? 0,
      },
      recentFrontendErrors: recentErrors ?? [],
      checkedAt: new Date().toISOString(),
    },
  });
}
