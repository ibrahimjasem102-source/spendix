import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DebtPaymentFormData } from "@/types";
import { insertLinkedTransaction, transactionTypeForDebtPayment } from "@/lib/finance/serverTransactions";

type DebtRow = {
  id: string;
  user_id: string;
  person_or_entity: string;
  debt_type: "payable" | "receivable";
  total_amount: number | string;
  paid_amount: number | string;
  due_date: string | null;
  status: string;
  contact_id: string | null;
  created_at: string;
};

type GroupPaymentBody = DebtPaymentFormData & {
  debt_ids?: string[];
};

function remainingOf(debt: DebtRow) {
  return Math.max(Number(debt.total_amount) - Number(debt.paid_amount), 0);
}

function sortForAllocation(a: DebtRow, b: DebtRow) {
  if (a.status === "overdue" && b.status !== "overdue") return -1;
  if (b.status === "overdue" && a.status !== "overdue") return 1;
  const aDue = a.due_date ?? "9999-12-31";
  const bDue = b.due_date ?? "9999-12-31";
  if (aDue !== bDue) return aDue.localeCompare(bDue);
  return a.created_at.localeCompare(b.created_at);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: GroupPaymentBody = await request.json();
  const debtIds = Array.from(new Set(body.debt_ids ?? [])).filter(Boolean);
  const amount = Number(body.amount);

  if (debtIds.length === 0) {
    return NextResponse.json({ error: "No debts selected" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Payment amount must be greater than zero" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("debts")
    .select("id,user_id,person_or_entity,debt_type,total_amount,paid_amount,due_date,status,contact_id,created_at")
    .in("id", debtIds)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const debts = ((data ?? []) as DebtRow[])
    .filter((debt) => debt.status !== "paid" && remainingOf(debt) > 0)
    .sort(sortForAllocation);

  if (debts.length === 0) {
    return NextResponse.json({ error: "No unpaid debts found" }, { status: 404 });
  }

  const debtType = debts[0].debt_type;
  const contactId = debts[0].contact_id ?? null;
  const personOrEntity = debts[0].person_or_entity;

  if (debts.some((debt) => debt.debt_type !== debtType)) {
    return NextResponse.json({ error: "Cannot combine payable and receivable debts in one payment" }, { status: 400 });
  }

  const totalRemaining = debts.reduce((sum, debt) => sum + remainingOf(debt), 0);
  if (amount > totalRemaining) {
    return NextResponse.json({ error: `Maximum payment amount is ${totalRemaining.toFixed(2)}` }, { status: 400 });
  }

  const { data: tx, error: txError } = await insertLinkedTransaction(supabase, {
    user_id: user.id,
    title: `Debt payment: ${personOrEntity}`,
    amount,
    type: transactionTypeForDebtPayment(debtType),
    source: "debt_payment",
    related_source_id: debts[0].id,
    contact_id: contactId,
    transaction_date: body.payment_date,
    notes: body.notes ?? null,
  });

  if (txError || !tx) return NextResponse.json({ error: txError?.message ?? "Transaction failed" }, { status: 500 });

  let amountLeft = amount;
  const allocations: { debt: DebtRow; amount: number; newPaid: number; newStatus: string }[] = [];

  for (const debt of debts) {
    if (amountLeft <= 0) break;
    const allocated = Math.min(remainingOf(debt), amountLeft);
    const newPaid = Number(debt.paid_amount) + allocated;
    const newStatus = newPaid >= Number(debt.total_amount) ? "paid" : "partially_paid";
    allocations.push({ debt, amount: allocated, newPaid, newStatus });
    amountLeft = Number((amountLeft - allocated).toFixed(2));
  }

  const { data: payments, error: payError } = await supabase
    .from("debt_payments")
    .insert(allocations.map((item) => ({
      user_id: user.id,
      debt_id: item.debt.id,
      transaction_id: tx.id,
      amount: item.amount,
      payment_date: body.payment_date,
      notes: body.notes ?? null,
    })))
    .select();

  if (payError) return NextResponse.json({ error: payError.message }, { status: 500 });

  for (const item of allocations) {
    const { error: updateError } = await supabase
      .from("debts")
      .update({
        paid_amount: item.newPaid,
        status: item.newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.debt.id)
      .eq("user_id", user.id);

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    transaction_id: tx.id,
    payments,
    allocations: allocations.map((item) => ({
      debt_id: item.debt.id,
      amount: item.amount,
      newPaid: item.newPaid,
      newStatus: item.newStatus,
    })),
  }, { status: 201 });
}
