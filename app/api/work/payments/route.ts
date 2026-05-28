import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { WorkPaymentFormData } from "@/types";
import { notify } from "@/lib/notifications/service";
import { insertLinkedTransaction, updateTransactionSourceLink } from "@/lib/finance/serverTransactions";

const WORK_PAYMENT_SELECT =
  "id,user_id,work_session_id,employer_or_client,amount,payment_date,notes,transaction_id,created_at";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("work_payments")
    .select(WORK_PAYMENT_SELECT)
    .eq("user_id", user.id)
    .order("payment_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ payments: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: WorkPaymentFormData = await request.json();

  const { data: tx, error: txErr } = await insertLinkedTransaction(supabase, {
    user_id: user.id,
    title: `Work payment: ${body.employer_or_client}`,
    amount: body.amount,
    type: "income",
    source: "work_payment",
    related_source_id: body.work_session_id ?? null,
    transaction_date: body.payment_date,
    notes: body.notes ?? null,
  });

  if (txErr || !tx) return NextResponse.json({ error: txErr?.message ?? "Transaction failed" }, { status: 500 });

  const { data: payment, error: payErr } = await supabase
    .from("work_payments")
    .insert({
      user_id: user.id,
      work_session_id: body.work_session_id ?? null,
      employer_or_client: body.employer_or_client,
      amount: body.amount,
      payment_date: body.payment_date,
      notes: body.notes ?? null,
      transaction_id: tx.id,
    })
    .select(WORK_PAYMENT_SELECT)
    .single();

  if (payErr) return NextResponse.json({ error: payErr.message }, { status: 500 });

  await updateTransactionSourceLink(supabase, tx.id, payment.id);

  void notify.workPaymentReceived(
    supabase,
    user.id,
    payment.id,
    Number(body.amount).toFixed(2),
    body.employer_or_client,
  );

  return NextResponse.json({ payment }, { status: 201 });
}
