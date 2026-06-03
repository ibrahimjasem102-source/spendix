import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { WorkSessionFormData } from "@/types";

const WORK_SESSION_SELECT =
  "id,user_id,title,employer_or_client,hourly_rate,hours_worked,expected_amount,work_date,due_date,notes,recurrence,recurrence_end_date,created_at,updated_at";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("work_sessions")
    .select(WORK_SESSION_SELECT)
    .eq("user_id", user.id)
    .order("work_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sessions: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: WorkSessionFormData = await request.json();

  const { data: session, error: sessionErr } = await supabase
    .from("work_sessions")
    .insert({
      user_id: user.id,
      title: body.title,
      employer_or_client: body.employer_or_client,
      hourly_rate: body.hourly_rate,
      hours_worked: body.hours_worked,
      work_date: body.work_date,
      due_date: body.due_date ?? null,
      notes: body.notes ?? null,
      recurrence: body.recurrence ?? "none",
      recurrence_end_date: body.recurrence_end_date ?? null,
    })
    .select(WORK_SESSION_SELECT)
    .single();

  if (sessionErr) return NextResponse.json({ error: sessionErr.message }, { status: 500 });

  return NextResponse.json({ session }, { status: 201 });
}
