import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { WorkSessionFormData } from "@/types";
import { insertLinkedTransaction, updateTransactionSourceLink } from "@/lib/finance/serverTransactions";

const WORK_SESSION_SELECT =
  "id,user_id,title,employer_or_client,hourly_rate,hours_worked,expected_amount,work_date,notes,recurrence,recurrence_end_date,created_at,updated_at";

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
  const { paid_immediately, ...sessionData } = body;

  const { data: session, error: sessionErr } = await supabase
    .from("work_sessions")
    .insert({
      user_id: user.id,
      title: sessionData.title,
      employer_or_client: sessionData.employer_or_client,
      hourly_rate: sessionData.hourly_rate,
      hours_worked: sessionData.hours_worked,
      work_date: sessionData.work_date,
      notes: sessionData.notes ?? null,
      recurrence: sessionData.recurrence ?? "none",
      recurrence_end_date: sessionData.recurrence_end_date ?? null,
    })
    .select(WORK_SESSION_SELECT)
    .single();

  if (sessionErr) return NextResponse.json({ error: sessionErr.message }, { status: 500 });

  if (paid_immediately) {
    const expectedAmount = Number(session.hourly_rate) * Number(session.hours_worked);
    const { data: tx } = await insertLinkedTransaction(supabase, {
      user_id: user.id,
      title: `Work payment: ${session.employer_or_client}`,
      amount: expectedAmount,
      type: "income",
      source: "work_payment",
      related_source_id: session.id,
      transaction_date: session.work_date,
      notes: session.notes ?? null,
    });

    if (tx) {
      const { data: payment } = await supabase
        .from("work_payments")
        .insert({
          user_id: user.id,
          work_session_id: session.id,
          employer_or_client: session.employer_or_client,
          amount: expectedAmount,
          payment_date: session.work_date,
          notes: session.notes ?? null,
          transaction_id: tx.id,
        })
        .select("id")
        .single();

      if (payment) await updateTransactionSourceLink(supabase, tx.id, payment.id);
    }
  }

  return NextResponse.json({ session }, { status: 201 });
}
