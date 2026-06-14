import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DebtPaymentFormData } from "@/types";
import { notify } from "@/lib/notifications/service";
import { insertLinkedTransaction, transactionTypeForDebtPayment } from "@/lib/finance/serverTransactions";
import { writeLedgerEntry } from "@/lib/ledger/writer";

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

  const paymentAmount = Number(body.amount);
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    return NextResponse.json({ errorKey: "transactions.amount_positive" }, { status: 400 });
  }
  if (!body.payment_date) {
    return NextResponse.json({ errorKey: "debts.payment_date" }, { status: 400 });
  }

  const { data: existingPayments, error: paymentsError } = await supabase
    .from("debt_payments")
    .select("amount")
    .eq("debt_id", debtId)
    .eq("user_id", user.id);

  if (paymentsError) return NextResponse.json({ error: paymentsError.message }, { status: 500 });

  const paidBefore = (existingPayments ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0);
  const remaining = Math.max(Number(debt.total_amount) - paidBefore, 0);
  if (paymentAmount > remaining + 0.000_001) {
    return NextResponse.json({ errorKey: "debts.payment_exceeds_remaining" }, { status: 400 });
  }

  const { data: tx, error: txError } = await insertLinkedTransaction(supabase, {
    user_id: user.id,
    title: `Debt payment: ${debt.person_or_entity}`,
    amount: paymentAmount,
    type: transactionTypeForDebtPayment(debt.debt_type),
    source: "debt_payment",
    related_source_id: debtId,
    contact_id: debt.contact_id ?? null,
    transaction_date: body.payment_date,
    notes: body.notes ?? null,
  });

  if (txError || !tx) return NextResponse.json({ error: txError?.message ?? "Transaction failed" }, { status: 500 });

  const { data: payment, error: payError } = await supabase
    .from("debt_payments")
    .insert({
      user_id: user.id,
      debt_id: debtId,
      transaction_id: tx.id,
      amount: paymentAmount,
      payment_date: body.payment_date,
      notes: body.notes ?? null,
    })
    .select("id")
    .single();

  if (payError || !payment) {
    await supabase.from("transactions").delete().eq("id", tx.id).eq("user_id", user.id);
    return NextResponse.json({ error: payError?.message ?? "Payment failed" }, { status: 500 });
  }

  const newPaid = paidBefore + paymentAmount;
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

  if (updateErr) {
    await supabase.from("debt_payments").delete().eq("id", payment.id).eq("user_id", user.id);
    await supabase.from("transactions").delete().eq("id", tx.id).eq("user_id", user.id);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  const amountLabel = paymentAmount.toFixed(2);
  if (newStatus === "paid") {
    void notify.debtPaid(supabase, user.id, debtId, debt.person_or_entity);
  } else if (debt.debt_type === "receivable") {
    void notify.debtPaymentReceived(supabase, user.id, debtId, amountLabel, debt.person_or_entity);
  } else {
    void notify.debtPaymentMade(supabase, user.id, debtId, amountLabel, debt.person_or_entity);
  }

  // Write unified ledger entry (best-effort)
  // payable debt payment → outflow (paying back)
  // receivable debt payment → inflow (receiving back)
  void writeLedgerEntry(supabase, {
    user_id:       user.id,
    source_module: "debt_payment",
    source_id:     payment.id,
    entry_type:    "debt_payment",
    direction:     debt.debt_type === "payable" ? "outflow" : "inflow",
    amount:        paymentAmount,
    description:   `Debt payment: ${debt.person_or_entity}`,
    transaction_id: tx.id,
    contact_id:    (debt as { contact_id?: string | null }).contact_id ?? null,
  });

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
