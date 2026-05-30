import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications/service";

function computeNextDate(currentDate: string, cycle: string): string {
  const d = new Date(currentDate);
  switch (cycle) {
    case "weekly":    d.setDate(d.getDate() + 7);        break;
    case "monthly":   d.setMonth(d.getMonth() + 1);      break;
    case "quarterly": d.setMonth(d.getMonth() + 3);      break;
    case "yearly":    d.setFullYear(d.getFullYear() + 1); break;
  }
  return d.toISOString().slice(0, 10);
}

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
  let charged = 0;
  let reminded = 0;

  // ── 1. Process due subscriptions (auto-create transactions) ──
  const { data: dueSubscriptions } = await supabase
    .from("subscriptions")
    .select("id,name,amount,currency,billing_cycle,next_billing_date,category_id,account_id,auto_create_transaction,last_billed_date")
    .eq("user_id", user.id)
    .eq("status", "active")
    .lte("next_billing_date", today);

  for (const sub of dueSubscriptions ?? []) {
    // Skip if already billed on this billing date (idempotency)
    if (sub.last_billed_date && sub.last_billed_date >= sub.next_billing_date) continue;

    // Auto-create transaction
    if (sub.auto_create_transaction) {
      const txPayload: Record<string, unknown> = {
        user_id:          user.id,
        title:            sub.name,
        amount:           Number(sub.amount),
        type:             "expense",
        source:           "subscription",
        related_source_id: sub.id,
        category_id:      sub.category_id ?? null,
        account_id:       sub.account_id ?? null,
        transaction_date: sub.next_billing_date,
        notes:            null,
      };

      // Try with subscription source; fall back to manual if check constraint blocks it
      const { error: txErr } = await supabase.from("transactions").insert(txPayload);
      if (txErr && (txErr.message.includes("check constraint") || txErr.message.includes("source"))) {
        await supabase.from("transactions").insert({ ...txPayload, source: "manual" });
      }
      charged++;
    }

    // Advance billing date and record last_billed_date
    const nextDate = computeNextDate(sub.next_billing_date, sub.billing_cycle);
    await supabase
      .from("subscriptions")
      .update({ next_billing_date: nextDate, last_billed_date: sub.next_billing_date, updated_at: new Date().toISOString() })
      .eq("id", sub.id)
      .eq("user_id", user.id);

    // Charge notification
    const key = `sub_charged_${sub.id}_${sub.next_billing_date}`;
    if (!(await alreadySentToday(supabase, user.id, key))) {
      await createNotification(supabase, {
        user_id:           user.id,
        title:             `تم خصم اشتراك: ${sub.name}`,
        message:           `تم خصم ${Number(sub.amount).toFixed(2)} ${sub.currency} لاشتراك ${sub.name}. الخصم التالي: ${nextDate}.`,
        type:              "info",
        source:            "transaction",
        priority:          "normal",
        related_source_id: sub.id,
        action_url:        "/subscriptions",
        metadata:          { scheduler_key: key },
      });
    }
  }

  // ── 2. Remind about upcoming subscriptions ───────────────────
  const { data: allActive } = await supabase
    .from("subscriptions")
    .select("id,name,amount,currency,next_billing_date,remind_days_before")
    .eq("user_id", user.id)
    .eq("status", "active")
    .gt("next_billing_date", today);

  for (const sub of allActive ?? []) {
    const daysLeft = Math.round(
      (new Date(sub.next_billing_date).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86_400_000
    );
    if (daysLeft > (sub.remind_days_before ?? 3)) continue;

    const key = `sub_remind_${sub.id}_${sub.next_billing_date}`;
    if (await alreadySentToday(supabase, user.id, key)) continue;

    const dayLabel = daysLeft === 0 ? "اليوم" : daysLeft === 1 ? "غداً" : `خلال ${daysLeft} أيام`;
    await createNotification(supabase, {
      user_id:           user.id,
      title:             `تذكير: اشتراك ${sub.name}`,
      message:           `سيتم خصم ${Number(sub.amount).toFixed(2)} ${sub.currency} لاشتراك ${sub.name} ${dayLabel} (${sub.next_billing_date}).`,
      type:              "reminder",
      source:            "system",
      priority:          daysLeft <= 1 ? "high" : "normal",
      related_source_id: sub.id,
      action_url:        "/subscriptions",
      metadata:          { scheduler_key: key },
    });
    reminded++;
  }

  return NextResponse.json({ ok: true, charged, reminded });
}
