import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DebtFormData } from "@/types";

type Params = { params: Promise<{ id: string }> };

function statusFor(totalAmount: number, paidAmount: number, dueDate?: string | null) {
  if (paidAmount >= totalAmount) return "paid";
  const today = new Date().toISOString().slice(0, 10);
  if (dueDate && dueDate < today) return "overdue";
  return paidAmount > 0 ? "partially_paid" : "active";
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: Partial<DebtFormData> = await request.json();

  const { data: currentDebt, error: currentError } = await supabase
    .from("debts")
    .select("id,total_amount,due_date")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (currentError || !currentDebt) return NextResponse.json({ error: "Debt not found" }, { status: 404 });

  if (body.contact_id) {
    const { data: contact, error: contactError } = await supabase
      .from("financial_contacts").select("id,name").eq("id", body.contact_id).eq("user_id", user.id).single();
    if (contactError || !contact) return NextResponse.json({ errorKey: "contacts.not_found" }, { status: 400 });
    if (!body.person_or_entity?.trim()) body.person_or_entity = contact.name;
  }

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.person_or_entity !== undefined) {
    const name = body.person_or_entity.trim();
    if (!name) return NextResponse.json({ errorKey: "debts.creditor" }, { status: 400 });
    payload.person_or_entity = name;
  }
  if (body.debt_type !== undefined) payload.debt_type = body.debt_type;
  if (body.total_amount !== undefined) {
    const total = Number(body.total_amount);
    if (!Number.isFinite(total) || total <= 0) {
      return NextResponse.json({ errorKey: "transactions.amount_positive" }, { status: 400 });
    }
    payload.total_amount = total;
  }
  if (body.due_date !== undefined) payload.due_date = body.due_date || null;
  if (body.notes !== undefined) payload.notes = body.notes?.trim() || null;
  if (body.contact_id !== undefined) payload.contact_id = body.contact_id ?? null;

  const { data: payments, error: paymentsError } = await supabase
    .from("debt_payments")
    .select("amount")
    .eq("debt_id", id)
    .eq("user_id", user.id);

  if (paymentsError) return NextResponse.json({ error: paymentsError.message }, { status: 500 });

  const paidAmount = (payments ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0);
  const nextTotal = Number(payload.total_amount ?? currentDebt.total_amount);
  const nextDueDate = (payload.due_date as string | null | undefined) ?? currentDebt.due_date;
  payload.paid_amount = paidAmount;
  payload.status = statusFor(nextTotal, paidAmount, nextDueDate);

  const { data: debt, error } = await supabase
    .from("debts")
    .update(payload)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id,user_id,person_or_entity,debt_type,total_amount,paid_amount,due_date,status,notes,contact_id,created_at,updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ debt });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Collect transaction IDs from payments only
  const { data: payments } = await supabase
    .from("debt_payments")
    .select("transaction_id")
    .eq("debt_id", id)
    .eq("user_id", user.id);

  // Also delete legacy debt-creation transactions (source=debt) if they exist
  const { data: debtTx } = await supabase
    .from("transactions")
    .select("id")
    .eq("source", "debt")
    .eq("related_source_id", id)
    .eq("user_id", user.id);

  // Delete the debt (cascades to debt_payments)
  const { error } = await supabase.from("debts").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Delete all linked transactions
  const txIds = [
    ...(payments ?? []).map((p) => p.transaction_id).filter(Boolean),
    ...(debtTx ?? []).map((t) => t.id),
  ];
  if (txIds.length > 0) {
    await supabase.from("transactions").delete().in("id", txIds).eq("user_id", user.id);
  }

  return new NextResponse(null, { status: 204 });
}
