import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DebtFormData } from "@/types";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: Partial<DebtFormData> = await request.json();

  if (body.contact_id) {
    const { data: contact, error: contactError } = await supabase
      .from("financial_contacts").select("id,name").eq("id", body.contact_id).eq("user_id", user.id).single();
    if (contactError || !contact) return NextResponse.json({ errorKey: "contacts.not_found" }, { status: 400 });
    if (!body.person_or_entity?.trim()) body.person_or_entity = contact.name;
  }

  const { data: debt, error } = await supabase
    .from("debts")
    .update({ ...body, updated_at: new Date().toISOString() })
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
