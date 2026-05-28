import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { WorkPaymentFormData } from "@/types";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: Partial<WorkPaymentFormData> = await request.json();

  const { data: payment, error } = await supabase
    .from("work_payments")
    .update(body)
    .eq("id", id).eq("user_id", user.id)
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Sync linked transaction
  if (payment.transaction_id) {
    const txUpdates: Record<string, unknown> = {};
    if (body.amount !== undefined)         txUpdates.amount = body.amount;
    if (body.payment_date !== undefined)   txUpdates.transaction_date = body.payment_date;
    if (body.employer_or_client !== undefined) txUpdates.title = `دفعة عمل: ${body.employer_or_client}`;
    if (body.notes !== undefined)          txUpdates.notes = body.notes;

    if (Object.keys(txUpdates).length > 0) {
      await supabase.from("transactions").update(txUpdates)
        .eq("id", payment.transaction_id).eq("user_id", user.id);
    }
  }

  return NextResponse.json({ payment });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get linked transaction_id before deleting
  const { data: payment } = await supabase
    .from("work_payments")
    .select("transaction_id")
    .eq("id", id).eq("user_id", user.id)
    .single();

  const { error } = await supabase
    .from("work_payments")
    .delete()
    .eq("id", id).eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Delete linked transaction
  if (payment?.transaction_id) {
    await supabase.from("transactions").delete()
      .eq("id", payment.transaction_id).eq("user_id", user.id);
  }

  return new NextResponse(null, { status: 204 });
}
