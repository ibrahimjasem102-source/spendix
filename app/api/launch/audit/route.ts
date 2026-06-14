import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { getRequestId } from "@/lib/api/responses";
import { isAdminEmail } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface AuditCriterion {
  name:       string;
  target:     string;
  actual:     string;
  pass:       boolean;
  severity:   "critical" | "high" | "medium";
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

  const since7d  = new Date(Date.now() - 7  * 86_400_000).toISOString();
  const since30d = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const [
    { count: frontendErrors7d },
    { count: logins7d },
    { count: failedLogins7d },
    { count: totalUsers },
    { data:  ratings },
    { data:  topBugs },
    { data:  topFeatures },
    { data:  openBugs },
  ] = await Promise.all([
    db.from("frontend_errors").select("*",     { count: "exact", head: true }).gte("created_at", since7d),
    db.from("security_events").select("*",     { count: "exact", head: true }).eq("event_type", "login_success").gte("created_at", since7d),
    db.from("security_events").select("*",     { count: "exact", head: true }).eq("event_type", "login_failed").gte("created_at", since7d),
    db.from("profile_settings").select("*",    { count: "exact", head: true }),
    db.from("app_ratings").select("rating").gte("created_at", since30d).limit(500),
    db.from("support_tickets").select("id, title, priority, created_at")
      .eq("type", "bug").in("status", ["open","in_progress"])
      .order("created_at", { ascending: false }).limit(20),
    db.from("support_tickets").select("id, title, created_at")
      .eq("type", "feature").in("status", ["open","in_progress"])
      .order("created_at", { ascending: false }).limit(20),
    db.from("support_tickets").select("*", { count: "exact", head: true })
      .eq("type", "bug").in("status", ["open","in_progress"]),
  ]);

  // ── Criterion 1: Crash rate < 1% ──────────────────────────────
  const crashRate = logins7d ? (frontendErrors7d ?? 0) / (logins7d * 10) : 0;
  const crashPct  = Math.round(crashRate * 100 * 10) / 10;

  // ── Criterion 2: Auth failure rate < 5% ───────────────────────
  const totalAuth = (logins7d ?? 0) + (failedLogins7d ?? 0);
  const authFailPct = totalAuth
    ? Math.round(((failedLogins7d ?? 0) / totalAuth) * 100 * 10) / 10
    : 0;

  // ── Criterion 3: Open critical bugs = 0 ──────────────────────
  const criticalBugs = (openBugs ?? 0);

  // ── Criterion 4: Positive feedback (avg rating > 3.5) ─────────
  const ratingValues = (ratings as { rating: number }[])?.map(r => r.rating) ?? [];
  const avgRating    = ratingValues.length
    ? Math.round((ratingValues.reduce((s, r) => s + r, 0) / ratingValues.length) * 10) / 10
    : null;

  // ── Criterion 5: Beta users reached 50+ ───────────────────────
  const { count: betaUserCount } = await db
    .from("beta_invites")
    .select("*", { count: "exact", head: true })
    .not("used_by", "is", null);

  const criteria: AuditCriterion[] = [
    {
      name:     "Crash Rate",
      target:   "< 1%",
      actual:   `${crashPct}%`,
      pass:     crashPct < 1,
      severity: "critical",
    },
    {
      name:     "Auth Failure Rate",
      target:   "< 5%",
      actual:   totalAuth ? `${authFailPct}%` : "no data",
      pass:     totalAuth > 0 && authFailPct < 5,
      severity: "critical",
    },
    {
      name:     "Open Bug Tickets",
      target:   "< 10 open bugs",
      actual:   `${criticalBugs} open`,
      pass:     criticalBugs < 10,
      severity: "high",
    },
    {
      name:     "User Satisfaction",
      target:   "Avg rating > 3.5 / 5",
      actual:   avgRating !== null ? `${avgRating} / 5 (${ratingValues.length} ratings)` : "no ratings yet",
      pass:     avgRating !== null && avgRating > 3.5,
      severity: "high",
    },
    {
      name:     "Beta Cohort Size",
      target:   "≥ 50 beta users",
      actual:   `${betaUserCount ?? 0} users`,
      pass:     (betaUserCount ?? 0) >= 50,
      severity: "medium",
    },
    {
      name:     "Total Users",
      target:   "> 0 users",
      actual:   `${totalUsers ?? 0} registered`,
      pass:     (totalUsers ?? 0) > 0,
      severity: "medium",
    },
  ];

  const criticalFails = criteria.filter(c => !c.pass && c.severity === "critical").length;
  const highFails     = criteria.filter(c => !c.pass && c.severity === "high").length;
  const allPass       = criteria.every(c => c.pass);

  const overallStatus = allPass ? "GO"
    : criticalFails > 0 ? "NO_GO"
    : highFails > 0     ? "CONDITIONAL_GO"
    : "CONDITIONAL_GO";

  const recommendation =
    overallStatus === "GO"
      ? "✅ جميع معايير الإطلاق ناجحة. المنتج جاهز للتوسع."
      : overallStatus === "NO_GO"
      ? "🚫 يوجد معايير حرجة فاشلة. لا يُنصح بالإطلاق العام الآن."
      : "⚠️ المعايير الأساسية ناجحة لكن بعض النقاط تحتاج متابعة. يمكن إطلاق نسخة محدودة.";

  return NextResponse.json({
    ok: true,
    data: {
      overallStatus,
      recommendation,
      criteria,
      topIssues:   (topBugs    as { title: string }[])?.map(b => b.title) ?? [],
      topRequests: (topFeatures as { title: string }[])?.map(f => f.title) ?? [],
      summary: {
        totalUsers:    totalUsers    ?? 0,
        betaUsers:     betaUserCount ?? 0,
        openBugs:      criticalBugs,
        avgRating,
        ratingCount:   ratingValues.length,
      },
      generatedAt: new Date().toISOString(),
    },
  });
}
