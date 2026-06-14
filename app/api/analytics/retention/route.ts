import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { getRequestId } from "@/lib/api/responses";
import { isAdminEmail } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface UserEvent { user_id: string; created_at: string }

function dayOffset(base: string, fromDay: number, toDay: number): { from: string; to: string } {
  const b = new Date(base).getTime();
  return {
    from: new Date(b + fromDay * 86_400_000).toISOString(),
    to:   new Date(b + toDay   * 86_400_000).toISOString(),
  };
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

  // Get all signup events (user + timestamp)
  const { data: signups } = await db
    .from("product_events")
    .select("user_id, created_at")
    .not("user_id", "is", null)
    .eq("event_name", "signup")
    .order("created_at")
    .limit(2000) as { data: UserEvent[] };

  if (!signups?.length) {
    return NextResponse.json({ ok: true, data: { day1: null, day7: null, day30: null, cohortSize: 0 } });
  }

  // Get all login events
  const { data: logins } = await db
    .from("product_events")
    .select("user_id, created_at")
    .not("user_id", "is", null)
    .eq("event_name", "login")
    .order("created_at")
    .limit(5000) as { data: UserEvent[] };

  const loginMap = new Map<string, Date[]>();
  for (const e of logins ?? []) {
    if (!loginMap.has(e.user_id)) loginMap.set(e.user_id, []);
    loginMap.get(e.user_id)!.push(new Date(e.created_at));
  }

  function retentionRate(windowDays: { fromDay: number; toDay: number }, minAgeDays: number): number | null {
    const eligible = signups.filter(s => {
      const age = (Date.now() - new Date(s.created_at).getTime()) / 86_400_000;
      return age >= minAgeDays;
    });
    if (eligible.length === 0) return null;
    const retained = eligible.filter(s => {
      const { from, to } = dayOffset(s.created_at, windowDays.fromDay, windowDays.toDay);
      const userLogins = loginMap.get(s.user_id) ?? [];
      return userLogins.some(d => d >= new Date(from) && d <= new Date(to));
    });
    return Math.round((retained.length / eligible.length) * 100);
  }

  const day1Rate  = retentionRate({ fromDay: 0,  toDay: 2  }, 2);
  const day7Rate  = retentionRate({ fromDay: 5,  toDay: 9  }, 9);
  const day30Rate = retentionRate({ fromDay: 25, toDay: 35 }, 35);

  return NextResponse.json({
    ok: true,
    data: {
      day1:       day1Rate,
      day7:       day7Rate,
      day30:      day30Rate,
      cohortSize: signups.length,
    },
  });
}
