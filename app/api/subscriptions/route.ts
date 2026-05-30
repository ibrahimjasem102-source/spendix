import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rate-limit";
import { readJson } from "@/lib/api/request";
import { SubscriptionFormData } from "@/types";

const SELECT =
  "id,user_id,name,amount,currency,billing_cycle,next_billing_date,category_id,account_id,color,icon,notes,status,remind_days_before,auto_create_transaction,last_billed_date,created_at,updated_at,category:categories(id,name,color,icon),account:accounts(id,name,type)";

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("subscriptions")
    .select(SELECT)
    .eq("user_id", user.id)
    .order("next_billing_date", { ascending: true });

  if (error) {
    // Fallback if category/account join not available
    const { data: plain, error: e2 } = await supabase
      .from("subscriptions")
      .select("id,user_id,name,amount,currency,billing_cycle,next_billing_date,category_id,account_id,color,icon,notes,status,remind_days_before,auto_create_transaction,last_billed_date,created_at,updated_at")
      .eq("user_id", user.id)
      .order("next_billing_date", { ascending: true });
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
    const result = (plain ?? []).map((s) => ({ ...s, days_until_billing: daysUntil(s.next_billing_date) }));
    return NextResponse.json({ subscriptions: result });
  }

  const result = (data ?? []).map((s) => ({ ...s, days_until_billing: daysUntil(s.next_billing_date) }));
  return NextResponse.json({ subscriptions: result });
}

export async function POST(request: Request) {
  const limited = rateLimit(request, { key: "subscriptions-post", limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });

  const body = await readJson<SubscriptionFormData>(request);
  if (!body.name?.trim()) return NextResponse.json({ errorKey: "subscriptions.name_required" }, { status: 400 });
  if (!body.amount || Number(body.amount) <= 0) return NextResponse.json({ errorKey: "subscriptions.amount_positive" }, { status: 400 });

  const { data, error } = await supabase
    .from("subscriptions")
    .insert({
      user_id:                user.id,
      name:                   body.name.trim(),
      amount:                 Number(body.amount),
      currency:               body.currency ?? "USD",
      billing_cycle:          body.billing_cycle ?? "monthly",
      next_billing_date:      body.next_billing_date,
      category_id:            body.category_id ?? null,
      account_id:             body.account_id ?? null,
      color:                  body.color ?? null,
      icon:                   body.icon ?? null,
      notes:                  body.notes?.trim() ?? null,
      status:                 body.status ?? "active",
      remind_days_before:     body.remind_days_before ?? 3,
      auto_create_transaction: body.auto_create_transaction ?? true,
    })
    .select("id,user_id,name,amount,currency,billing_cycle,next_billing_date,category_id,account_id,color,icon,notes,status,remind_days_before,auto_create_transaction,last_billed_date,created_at,updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ subscription: { ...data, days_until_billing: daysUntil(data.next_billing_date) } }, { status: 201 });
}
