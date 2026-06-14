import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { getRequestId } from "@/lib/api/responses";
import { isAdminEmail } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface DQCheck {
  name:        string;
  description: string;
  issues:      number;
  samples:     unknown[];
  status:      "pass" | "warn" | "fail";
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
  const checks: DQCheck[] = [];

  // 1. Ledger entries without matching transaction
  {
    const { data } = await db
      .from("ledger_entries")
      .select("id, user_id, amount, created_at")
      .not("transaction_id", "is", null)
      .limit(20);

    // Cross-check which have no matching transaction
    const orphans: unknown[] = [];
    if (data?.length) {
      for (const entry of data) {
        const { count } = await db
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("id", entry.transaction_id ?? "");
        if ((count ?? 0) === 0) orphans.push(entry);
      }
    }
    checks.push({
      name:        "Orphan Ledger Entries",
      description: "Ledger entries referencing non-existent transactions",
      issues:      orphans.length,
      samples:     orphans.slice(0, 5),
      status:      orphans.length === 0 ? "pass" : orphans.length < 10 ? "warn" : "fail",
    });
  }

  // 2. Debts where amount_paid > total_amount
  {
    const { data } = await db
      .from("debts")
      .select("id, user_id, total_amount, amount_paid")
      .not("amount_paid", "is", null)
      .gt("amount_paid", db.raw ? "total_amount" : 0)
      .limit(10);

    const overpaid = (data ?? []).filter((d: { amount_paid: number; total_amount: number }) =>
      d.amount_paid > d.total_amount
    );
    checks.push({
      name:        "Overpaid Debts",
      description: "Debt records where amount_paid exceeds total_amount",
      issues:      overpaid.length,
      samples:     overpaid.slice(0, 5),
      status:      overpaid.length === 0 ? "pass" : "warn",
    });
  }

  // 3. Goals with invalid amounts (target <= 0)
  {
    const { data, count } = await db
      .from("goals")
      .select("id, user_id, name, target_amount", { count: "exact" })
      .lte("target_amount", 0)
      .limit(10);
    checks.push({
      name:        "Invalid Goal Amounts",
      description: "Goals with target_amount ≤ 0",
      issues:      count ?? 0,
      samples:     data ?? [],
      status:      (count ?? 0) === 0 ? "pass" : "warn",
    });
  }

  // 4. Subscriptions (recurring) with amount <= 0
  {
    const { data, count } = await db
      .from("subscriptions")
      .select("id, user_id, name, amount", { count: "exact" })
      .lte("amount", 0)
      .limit(10);
    checks.push({
      name:        "Invalid Subscription Amounts",
      description: "Recurring subscriptions with amount ≤ 0",
      issues:      count ?? 0,
      samples:     data ?? [],
      status:      (count ?? 0) === 0 ? "pass" : "warn",
    });
  }

  // 5. Duplicate active billing subscriptions
  {
    const { data } = await db
      .from("subscriptions") // billing subscriptions table used by Stripe
      .select("user_id")
      .eq("status", "active")
      .limit(500);

    const seen = new Map<string, number>();
    for (const row of data ?? []) {
      const uid = row.user_id as string;
      seen.set(uid, (seen.get(uid) ?? 0) + 1);
    }
    const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([uid, n]) => ({ user_id: uid, count: n }));
    checks.push({
      name:        "Duplicate Active Subscriptions",
      description: "Users with multiple active billing subscriptions",
      issues:      dupes.length,
      samples:     dupes.slice(0, 5),
      status:      dupes.length === 0 ? "pass" : "fail",
    });
  }

  const totalIssues  = checks.reduce((s, c) => s + c.issues, 0);
  const overallStatus = checks.some(c => c.status === "fail") ? "fail"
    : checks.some(c => c.status === "warn") ? "warn" : "pass";

  // Persist the report
  await db.from("data_quality_reports").insert({
    check_type:   "full_sweep",
    issues_found: totalIssues,
    details:      checks.map(c => ({ name: c.name, issues: c.issues, status: c.status })),
  });

  return NextResponse.json({
    ok: true,
    data: { overallStatus, totalIssues, checks },
  });
}
