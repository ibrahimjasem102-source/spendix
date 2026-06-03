import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { boundedInt } from "@/lib/api/request";
import type { CalendarEvent, CalendarEventType } from "@/types";

const EVENT_COLORS: Record<CalendarEventType, string> = {
  income:       "#10B981",
  expense:      "#F43F5E",
  subscription: "#8B5CF6",
  debt_due:     "#F43F5E",
  investment:   "#3B82F6",
  work_session: "#06B6D4",
  work_payment: "#10B981",
};

function pad(n: number) { return String(n).padStart(2, "0"); }

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const now     = new Date();
  const year    = boundedInt(searchParams.get("year"),  2000, 2100, now.getFullYear());
  const month   = boundedInt(searchParams.get("month"), 1,    12,   now.getMonth() + 1);

  const monthStart = `${year}-${pad(month)}-01`;
  const lastDay    = new Date(year, month, 0).getDate();
  const monthEnd   = `${year}-${pad(month)}-${pad(lastDay)}`;

  const events: CalendarEvent[] = [];

  // ── 1. Transactions: income in month ──────────────────────
  try {
    const { data: txs } = await supabase
      .from("transactions")
      .select("id,title,amount,type,transaction_date,category:categories(name,color,icon)")
      .eq("user_id", user.id)
      .in("type", ["income", "expense"])
      .gte("transaction_date", monthStart)
      .lte("transaction_date", monthEnd)
      .order("transaction_date")
      .limit(200);

    for (const tx of txs ?? []) {
      const cat = (tx.category as unknown) as { name: string; color: string; icon?: string } | null;
      events.push({
        id:         tx.id,
        date:       tx.transaction_date,
        type:       tx.type === "income" ? "income" : "expense",
        title:      tx.title,
        amount:     Number(tx.amount),
        icon:       cat?.icon ?? null,
        color:      tx.type === "income" ? EVENT_COLORS.income : EVENT_COLORS.expense,
        source:     "transaction",
        source_id:  tx.id,
        action_url: "/transactions",
      });
    }
  } catch { /* table might not exist in some DB versions */ }

  // ── 2. Subscriptions: next_billing_date in month ─────────
  try {
    const { data: subs } = await supabase
      .from("subscriptions")
      .select("id,name,amount,next_billing_date,icon,color,status")
      .eq("user_id", user.id)
      .in("status", ["active"])
      .gte("next_billing_date", monthStart)
      .lte("next_billing_date", monthEnd)
      .limit(100);

    for (const s of subs ?? []) {
      events.push({
        id:         `sub-${s.id}`,
        date:       s.next_billing_date,
        type:       "subscription",
        title:      s.name,
        amount:     Number(s.amount),
        icon:       s.icon ?? null,
        color:      s.color ?? EVENT_COLORS.subscription,
        source:     "subscription",
        source_id:  s.id,
        action_url: "/subscriptions",
      });
    }
  } catch { /* subscriptions table may not exist yet */ }

  // ── 4. Debts: due_date in month ──────────────────────────
  try {
    const { data: debts } = await supabase
      .from("debts")
      .select("id,person_or_entity,total_amount,paid_amount,due_date,debt_type")
      .eq("user_id", user.id)
      .in("status", ["active", "partially_paid", "overdue"])
      .gte("due_date", monthStart)
      .lte("due_date", monthEnd)
      .not("due_date", "is", null)
      .limit(50);

    for (const d of debts ?? []) {
      const remaining = Number(d.total_amount) - Number(d.paid_amount);
      events.push({
        id:         `debt-${d.id}`,
        date:       d.due_date!,
        type:       "debt_due",
        title:      d.person_or_entity,
        amount:     remaining,
        icon:       d.debt_type === "payable" ? "💳" : "📥",
        color:      EVENT_COLORS.debt_due,
        source:     "debt",
        source_id:  d.id,
        action_url: "/debts",
      });
    }
  } catch { /* */ }

  // ── 5. Investments: investment_date in month ─────────────
  try {
    const { data: invs } = await supabase
      .from("investments")
      .select("id,asset_name,amount_invested,investment_date,asset_type")
      .eq("user_id", user.id)
      .gte("investment_date", monthStart)
      .lte("investment_date", monthEnd)
      .limit(50);

    for (const inv of invs ?? []) {
      const icons: Record<string, string> = {
        stock: "📈", crypto: "₿", etf: "📊", real_estate: "🏠", other: "💼",
      };
      events.push({
        id:         `inv-${inv.id}`,
        date:       inv.investment_date,
        type:       "investment",
        title:      inv.asset_name,
        amount:     Number(inv.amount_invested),
        icon:       icons[inv.asset_type] ?? "💼",
        color:      EVENT_COLORS.investment,
        source:     "investment",
        source_id:  inv.id,
        action_url: "/investments",
      });
    }
  } catch { /* */ }

  // ── 6. Work sessions: work_date in month ─────────────────
  try {
    const { data: sessions } = await supabase
      .from("work_sessions")
      .select("id,title,employer_or_client,expected_amount,work_date")
      .eq("user_id", user.id)
      .gte("work_date", monthStart)
      .lte("work_date", monthEnd)
      .limit(100);

    for (const ws of sessions ?? []) {
      events.push({
        id:         `ws-${ws.id}`,
        date:       ws.work_date,
        type:       "work_session",
        title:      `${ws.title} — ${ws.employer_or_client}`,
        amount:     Number(ws.expected_amount),
        icon:       "💼",
        color:      EVENT_COLORS.work_session,
        source:     "work",
        source_id:  ws.id,
        action_url: "/work",
      });
    }
  } catch { /* */ }

  // ── 7. Work payments: payment_date in month ───────────────
  try {
    const { data: payments } = await supabase
      .from("work_payments")
      .select("id,employer_or_client,amount,payment_date")
      .eq("user_id", user.id)
      .gte("payment_date", monthStart)
      .lte("payment_date", monthEnd)
      .limit(50);

    for (const wp of payments ?? []) {
      events.push({
        id:         `wp-${wp.id}`,
        date:       wp.payment_date,
        type:       "work_payment",
        title:      wp.employer_or_client,
        amount:     Number(wp.amount),
        icon:       "💰",
        color:      EVENT_COLORS.work_payment,
        source:     "work",
        source_id:  wp.id,
        action_url: "/work",
      });
    }
  } catch { /* */ }

  // Sort by date then by type priority
  const PRIORITY: Record<CalendarEventType, number> = {
    debt_due: 0, subscription: 1,
    income: 2, work_payment: 3, work_session: 4, investment: 5,
    expense: 6,
  };
  events.sort((a, b) => a.date.localeCompare(b.date) || (PRIORITY[a.type] - PRIORITY[b.type]));

  return NextResponse.json({ events });
}
