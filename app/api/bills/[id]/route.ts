import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rate-limit";
import { readJson } from "@/lib/api/request";
import { BillFormData } from "@/types";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(request, { key: "bills-put", limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });

  const body = await readJson<Partial<BillFormData>>(request);

  const { data, error } = await supabase
    .from("bills")
    .update({
      ...(body.name               !== undefined && { name: body.name.trim() }),
      ...(body.amount             !== undefined && { amount: body.amount ? Number(body.amount) : null }),
      ...(body.currency           !== undefined && { currency: body.currency }),
      ...(body.due_date           !== undefined && { due_date: body.due_date }),
      ...(body.category_id        !== undefined && { category_id: body.category_id }),
      ...(body.account_id         !== undefined && { account_id: body.account_id }),
      ...(body.is_recurring       !== undefined && { is_recurring: body.is_recurring }),
      ...(body.recurrence         !== undefined && { recurrence: body.recurrence }),
      ...(body.color              !== undefined && { color: body.color }),
      ...(body.icon               !== undefined && { icon: body.icon }),
      ...(body.notes              !== undefined && { notes: body.notes?.trim() ?? null }),
      ...(body.remind_days_before !== undefined && { remind_days_before: body.remind_days_before }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id,user_id,name,amount,currency,due_date,category_id,account_id,is_recurring,recurrence,color,icon,notes,status,remind_days_before,paid_at,transaction_id,created_at,updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bill: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });

  const { error } = await supabase.from("bills").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
