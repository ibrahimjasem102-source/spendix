import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { getRequestId } from "@/lib/api/responses";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function startOf(period: "day" | "week" | "month", offsetUnits = 0): string {
  const d = new Date();
  if (period === "day") {
    d.setDate(d.getDate() - offsetUnits);
    d.setHours(0, 0, 0, 0);
  } else if (period === "week") {
    d.setDate(d.getDate() - d.getDay() - offsetUnits * 7);
    d.setHours(0, 0, 0, 0);
  } else {
    d.setMonth(d.getMonth() - offsetUnits, 1);
    d.setHours(0, 0, 0, 0);
  }
  return d.toISOString();
}

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const { user, response } = await requireUser(requestId);
  if (response || !user) return response!;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  const now    = new Date().toISOString();
  const dayAgo = startOf("day", 1);
  const monAgo = startOf("month", 1);
  const mon2Ago= startOf("month", 2);

  const [
    { count: dau },
    { count: mau },
    { count: mauPrev },
    { count: signupsThisMonth },
    { count: signupsPrevMonth },
    { data: eventCounts },
  ] = await Promise.all([
    supabase.from("product_events").select("*", { count: "exact", head: true })
      .gte("created_at", dayAgo).lte("created_at", now).eq("name", "login"),
    supabase.from("product_events").select("*", { count: "exact", head: true })
      .gte("created_at", startOf("month")).lte("created_at", now).eq("name", "login"),
    supabase.from("product_events").select("*", { count: "exact", head: true })
      .gte("created_at", mon2Ago).lte("created_at", monAgo).eq("name", "login"),
    supabase.from("product_events").select("*", { count: "exact", head: true })
      .gte("created_at", startOf("month")).lte("created_at", now).eq("name", "signup"),
    supabase.from("product_events").select("*", { count: "exact", head: true })
      .gte("created_at", mon2Ago).lte("created_at", monAgo).eq("name", "signup"),
    supabase.from("product_events").select("name, count:id")
      .eq("name", "upgrade_completed").gte("created_at", startOf("month")),
  ]);

  const mauGrowth = mauPrev
    ? (((mau ?? 0) - (mauPrev ?? 0)) / (mauPrev ?? 1)) * 100
    : null;

  const signupGrowth = signupsPrevMonth
    ? (((signupsThisMonth ?? 0) - (signupsPrevMonth ?? 0)) / (signupsPrevMonth ?? 1)) * 100
    : null;

  return NextResponse.json({
    ok: true,
    data: {
      dau:              dau  ?? 0,
      mau:              mau  ?? 0,
      mauGrowthPct:     mauGrowth    !== null ? Math.round(mauGrowth    * 10) / 10 : null,
      signupsThisMonth: signupsThisMonth ?? 0,
      signupGrowthPct:  signupGrowth !== null ? Math.round(signupGrowth * 10) / 10 : null,
      upgradesThisMonth: (eventCounts as { name: string }[])?.length ?? 0,
      generatedAt: now,
    },
  });
}
