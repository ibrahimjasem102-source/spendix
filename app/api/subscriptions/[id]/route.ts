import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rate-limit";
import { readJson } from "@/lib/api/request";
import { SubscriptionFormData } from "@/types";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(request, { key: "subscriptions-put", limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });

  const body = await readJson<Partial<SubscriptionFormData>>(request);

  const { data, error } = await supabase
    .from("subscriptions")
    .update({
      ...(body.name               !== undefined && { name: body.name.trim() }),
      ...(body.amount             !== undefined && { amount: Number(body.amount) }),
      ...(body.currency           !== undefined && { currency: body.currency }),
      ...(body.billing_cycle      !== undefined && { billing_cycle: body.billing_cycle }),
      ...(body.next_billing_date  !== undefined && { next_billing_date: body.next_billing_date }),
      ...(body.category_id        !== undefined && { category_id: body.category_id }),
      ...(body.account_id         !== undefined && { account_id: body.account_id }),
      ...(body.color              !== undefined && { color: body.color }),
      ...(body.icon               !== undefined && { icon: body.icon }),
      ...(body.notes              !== undefined && { notes: body.notes?.trim() ?? null }),
      ...(body.status             !== undefined && { status: body.status }),
      ...(body.remind_days_before !== undefined && { remind_days_before: body.remind_days_before }),
      ...(body.auto_create_transaction !== undefined && { auto_create_transaction: body.auto_create_transaction }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id,user_id,name,amount,currency,billing_cycle,next_billing_date,category_id,account_id,color,icon,notes,status,remind_days_before,auto_create_transaction,last_billed_date,created_at,updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ subscription: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("subscriptions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
