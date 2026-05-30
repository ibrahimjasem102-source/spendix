import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readJson } from "@/lib/api/request";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await readJson<{ amount: number }>(request);
  const amount = Math.max(0, Number(body?.amount) || 0);
  if (amount <= 0) return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });

  // Only valid for manual goals — for others, progress is computed from real data
  const { data: goal, error: fetchErr } = await supabase
    .from("goals")
    .select("saved_amount,target_amount,tracking_type,title")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchErr || !goal) return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  if (goal.tracking_type !== "manual") {
    return NextResponse.json({ error: "Contribute is only for manual goals" }, { status: 400 });
  }

  const newSaved = Math.min(Number(goal.target_amount), Number(goal.saved_amount) + amount);
  const completed = newSaved >= Number(goal.target_amount);

  const { error: updateErr } = await supabase
    .from("goals")
    .update({ saved_amount: newSaved, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // Fire a notification if just completed
  if (completed) {
    void supabase.from("notifications").insert({
      user_id:    user.id,
      title:      `🎉 هدف "${goal.title}" مكتمل!`,
      message:    `تهانينا! لقد حققت هدفك المالي بالكامل.`,
      type:       "goal",
      source:     "goal",
      priority:   "high",
      action_url: "/goals",
    }).then(() => {});
  }

  return NextResponse.json({ success: true, new_saved: newSaved, completed });
}
