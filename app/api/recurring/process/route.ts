import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function computeNextDate(current: string, frequency: string, interval: number): string {
  const d = new Date(current);
  switch (frequency) {
    case "daily":   d.setDate(d.getDate()         + interval); break;
    case "weekly":  d.setDate(d.getDate()         + interval * 7); break;
    case "monthly": d.setMonth(d.getMonth()       + interval); break;
    case "yearly":  d.setFullYear(d.getFullYear() + interval); break;
  }
  return d.toISOString().slice(0, 10);
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const today = new Date().toISOString().slice(0, 10);

  const { data: due } = await supabase
    .from("recurring_transactions")
    .select("*")
    .eq("user_id", user.id)
    .eq("active", true)
    .eq("auto_create", true)
    .lte("next_run_date", today);

  let created = 0;

  for (const rec of due ?? []) {
    // Check if end_date passed
    if (rec.end_date && rec.next_run_date > rec.end_date) {
      await supabase
        .from("recurring_transactions")
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq("id", rec.id).eq("user_id", user.id);
      continue;
    }

    // Create the transaction
    await supabase.from("transactions").insert({
      user_id:          user.id,
      title:            rec.title,
      amount:           rec.amount,
      type:             rec.type,
      source:           "manual",
      category_id:      rec.category_id ?? null,
      account_id:       rec.account_id ?? null,
      notes:            rec.notes ?? null,
      transaction_date: rec.next_run_date,
      related_source_id: rec.id,
    });

    // Advance next_run_date
    const nextDate = computeNextDate(rec.next_run_date, rec.frequency, rec.interval_count);
    const isExpired = rec.end_date && nextDate > rec.end_date;

    await supabase
      .from("recurring_transactions")
      .update({
        last_run_date: rec.next_run_date,
        next_run_date: nextDate,
        active:        !isExpired,
        updated_at:    new Date().toISOString(),
      })
      .eq("id", rec.id).eq("user_id", user.id);

    created++;
  }

  return NextResponse.json({ ok: true, created });
}
