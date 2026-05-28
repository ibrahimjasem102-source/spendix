import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { BudgetFormData } from "@/types";

type Params = { params: Promise<{ id: string }> };

function numberValue(value: unknown) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function validMonth(value: unknown) {
  const month = Number(value);
  return Number.isInteger(month) && month >= 1 && month <= 12;
}

function validYear(value: unknown) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= 2100;
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });

  const body = await request.json() as Partial<BudgetFormData>;
  const updates: Record<string, unknown> = {};

  if (body.category_id !== undefined) updates.category_id = body.category_id;
  if (body.monthly_limit !== undefined) {
    const limit = numberValue(body.monthly_limit);
    if (limit <= 0) return NextResponse.json({ errorKey: "budgets.form_error" }, { status: 400 });
    updates.monthly_limit = limit;
  }
  if (body.month !== undefined) {
    if (!validMonth(body.month)) return NextResponse.json({ errorKey: "budgets.form_error" }, { status: 400 });
    updates.month = Number(body.month);
  }
  if (body.year !== undefined) {
    if (!validYear(body.year)) return NextResponse.json({ errorKey: "budgets.form_error" }, { status: 400 });
    updates.year = Number(body.year);
  }

  const { data, error } = await supabase
    .from("budgets")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id,user_id,category_id,monthly_limit,month,year,created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ budget: data });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("budgets")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
