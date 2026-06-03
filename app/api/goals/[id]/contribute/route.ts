import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readJson } from "@/lib/api/request";

function isOptionalCompletedAtError(message = "") {
  return message.includes("completed_at") ||
    message.includes("Could not find") ||
    message.includes("schema cache");
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await readJson<{ amount: number }>(request);
  const amount = Math.max(0, Number(body?.amount) || 0);
  if (amount <= 0) return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });

  const { data: goal, error: fetchErr } = await supabase
    .from("goals")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchErr || !goal) return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  if (goal.tracking_type !== "manual") {
    return NextResponse.json({ error: "Contribute is only for manual goals" }, { status: 400 });
  }

  const newSaved = Math.min(Number(goal.target_amount), Number(goal.saved_amount) + amount);
  const completed = newSaved >= Number(goal.target_amount);
  const completedAt = goal.completed_at ?? (completed ? new Date().toISOString() : null);
  const updatePayload: Record<string, unknown> = {
    saved_amount: newSaved,
    updated_at: new Date().toISOString(),
  };
  if (completedAt) updatePayload.completed_at = completedAt;

  let { data: updatedRows, error: updateErr } = await supabase
    .from("goals")
    .update(updatePayload)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");

  if (updateErr && isOptionalCompletedAtError(updateErr.message)) {
    const retry = await supabase
      .from("goals")
      .update({ saved_amount: newSaved, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id");
    updateErr = retry.error;
    updatedRows = retry.data;
  }

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // Race condition guard: if goal was deleted between fetch and update
  if (!updatedRows || updatedRows.length === 0) return NextResponse.json({ error: "Goal not found" }, { status: 404 });

  if (completed && !goal.completed_at) {
    void supabase.from("notifications").insert({
      user_id: user.id,
      title: `Goal "${goal.title}" completed!`,
      message: "Congratulations. You completed your financial goal.",
      type: "goal",
      source: "goal",
      priority: "high",
      action_url: "/goals",
    }).then(() => {});
  }

  return NextResponse.json({ success: true, new_saved: newSaved, completed, completed_at: completedAt });
}
