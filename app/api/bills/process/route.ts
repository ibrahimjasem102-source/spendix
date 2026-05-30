import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications/service";

async function alreadySentToday(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  key: string,
): Promise<boolean> {
  const since = new Date(); since.setHours(0, 0, 0, 0);
  const { data } = await supabase
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .gte("created_at", since.toISOString())
    .contains("metadata", { scheduler_key: key })
    .limit(1)
    .maybeSingle();
  return !!data;
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const today = new Date().toISOString().slice(0, 10);

  // ── 1. Mark overdue bills and send alerts ─────────────────
  const { data: overdueCandiates } = await supabase
    .from("bills")
    .select("id,name,amount,due_date")
    .eq("user_id", user.id)
    .eq("status", "unpaid")
    .lt("due_date", today);

  for (const bill of overdueCandiates ?? []) {
    // Update status to overdue
    await supabase
      .from("bills")
      .update({ status: "overdue", updated_at: new Date().toISOString() })
      .eq("id", bill.id)
      .eq("user_id", user.id);

    // Send overdue notification
    const key = `bill_overdue_${bill.id}_${today}`;
    if (await alreadySentToday(supabase, user.id, key)) continue;

    const amount = bill.amount ? `€${Number(bill.amount).toFixed(2)}` : "";
    await createNotification(supabase, {
      user_id:           user.id,
      title:             `فاتورة متأخرة: ${bill.name}`,
      message:           `فاتورة ${bill.name}${amount ? ` (${amount})` : ""} كانت مستحقة في ${bill.due_date} ولم تُدفع بعد.`,
      type:              "warning",
      source:            "system",
      priority:          "high",
      related_source_id: bill.id,
      action_url:        "/bills",
      metadata:          { scheduler_key: key },
    });
  }

  // ── 2. Remind about upcoming unpaid bills ─────────────────
  const { data: upcoming } = await supabase
    .from("bills")
    .select("id,name,amount,due_date,remind_days_before")
    .eq("user_id", user.id)
    .in("status", ["unpaid"])
    .gte("due_date", today);

  for (const bill of upcoming ?? []) {
    const daysLeft = Math.round(
      (new Date(bill.due_date).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86_400_000
    );
    if (daysLeft > (bill.remind_days_before ?? 3)) continue;

    const key = `bill_remind_${bill.id}_${bill.due_date}`;
    if (await alreadySentToday(supabase, user.id, key)) continue;

    const dayLabel = daysLeft === 0 ? "اليوم" : daysLeft === 1 ? "غداً" : `خلال ${daysLeft} أيام`;
    const amount   = bill.amount ? ` (€${Number(bill.amount).toFixed(2)})` : "";
    await createNotification(supabase, {
      user_id:           user.id,
      title:             `تذكير: فاتورة ${bill.name}`,
      message:           `فاتورة ${bill.name}${amount} مستحقة ${dayLabel} (${bill.due_date}). اضغط لتسجيل الدفع.`,
      type:              "reminder",
      source:            "system",
      priority:          daysLeft <= 1 ? "high" : "normal",
      related_source_id: bill.id,
      action_url:        "/bills",
      metadata:          { scheduler_key: key },
    });
  }

  return NextResponse.json({ ok: true });
}
