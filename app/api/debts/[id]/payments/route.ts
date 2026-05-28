import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DebtPaymentFormData } from "@/types";
import { notify } from "@/lib/notifications/service";
import { insertLinkedTransaction, transactionTypeForDebtPayment } from "@/lib/finance/serverTransactions";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id: debtId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: DebtPaymentFormData = await request.json();

  const { data: debt, error: debtError } = await supabase
    .from("debts")
    .select("*")
    .eq("id", debtId)
    .eq("user_id", user.id)
    .single();

  if (debtError || !debt) return NextResponse.json({ error: "Debt not found" }, { status: 404 });

  const { data: tx, error: txError } = await insertLinkedTransaction(supabase, {
    user_id: user.id,
    title: `Debt payment: ${debt.person_or_entity}`,
    amount: body.amount,
    type: transactionTypeForDebtPayment(debt.debt_type),
    source: "debt_payment",
    related_source_id: debtId,
    contact_id: debt.contact_id ?? null,
    transaction_date: body.payment_date,
    notes: body.notes ?? null,
  });

  if (txError || !tx) return NextResponse.json({ error: txError?.message ?? "Transaction failed" }, { status: 500 });

  const { error: payError } = await supabase
    .from("debt_payments")
    .insert({
      user_id: user.id,
      debt_id: debtId,
      transaction_id: tx.id,
      amount: body.amount,
      payment_date: body.payment_date,
      notes: body.notes ?? null,
    });

  if (payError) return NextResponse.json({ error: payError.message }, { status: 500 });

  const { data: allPayments } = await supabase
    .from("debt_payments")
    .select("amount")
    .eq("debt_id", debtId)
    .eq("user_id", user.id);

  const newPaid = (allPayments ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0);
  const newStatus =
    newPaid >= Number(debt.total_amount) ? "paid"
    : newPaid > 0 ? "partially_paid"
    : "active";

  const { data: updatedDebt, error: updateErr } = await supabase
    .from("debts")
    .update({ paid_amount: newPaid, status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", debtId)
    .eq("user_id", user.id)
    .select("id,user_id,person_or_entity,debt_type,total_amount,paid_amount,due_date,status,notes,contact_id,created_at,updated_at")
    .single();

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  const amountLabel = Number(body.amount).toFixed(2);
  if (newStatus === "paid") {
    void notify.debtPaid(supabase, user.id, debtId, debt.person_or_entity);
  } else if (debt.debt_type === "receivable") {
    void notify.debtPaymentReceived(supabase, user.id, debtId, amountLabel, debt.person_or_entity);
  } else {
    void notify.debtPaymentMade(supabase, user.id, debtId, amountLabel, debt.person_or_entity);
  }

  return NextResponse.json({ debt: updatedDebt }, { status: 201 });
}

export async function GET(_request: Request, { params }: Params) {
  const { id: debtId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("debt_payments")
    .select("*")
    .eq("debt_id", debtId)
    .eq("user_id", user.id)
    .order("payment_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ payments: data });
}
