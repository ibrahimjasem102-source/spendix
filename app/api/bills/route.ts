import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rate-limit";
import { readJson } from "@/lib/api/request";
import { BillFormData } from "@/types";

const SELECT =
  "id,user_id,name,amount,currency,due_date,category_id,account_id,is_recurring,recurrence,color,icon,notes,status,remind_days_before,paid_at,transaction_id,created_at,updated_at,category:categories(id,name,color,icon),account:accounts(id,name,type)";
const SELECT_PLAIN =
  "id,user_id,name,amount,currency,due_date,category_id,account_id,is_recurring,recurrence,color,icon,notes,status,remind_days_before,paid_at,transaction_id,created_at,updated_at";

function enrichBill(bill: Record<string, unknown>) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due   = new Date(bill.due_date as string); due.setHours(0, 0, 0, 0);
  const days  = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  const effectiveStatus =
    bill.status === "paid" ? "paid"
    : days < 0 ? "overdue"
    : (bill.status as string);
  return { ...bill, days_until_due: days, effective_status: effectiveStatus };
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });

  let { data, error } = await supabase
    .from("bills")
    .select(SELECT)
    .eq("user_id", user.id)
    .order("due_date", { ascending: true });

  if (error) {
    const res = await supabase.from("bills").select(SELECT_PLAIN).eq("user_id", user.id).order("due_date", { ascending: true });
    data = res.data; error = res.error;
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ bills: (data ?? []).map(enrichBill) });
}

export async function POST(request: Request) {
  const limited = rateLimit(request, { key: "bills-post", limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });

  const body = await readJson<BillFormData>(request);
  if (!body.name?.trim()) return NextResponse.json({ errorKey: "bills.name_required" }, { status: 400 });
  if (!body.due_date) return NextResponse.json({ errorKey: "bills.due_date_required" }, { status: 400 });

  const { data, error } = await supabase
    .from("bills")
    .insert({
      user_id:            user.id,
      name:               body.name.trim(),
      amount:             body.amount ? Number(body.amount) : null,
      currency:           body.currency ?? "USD",
      due_date:           body.due_date,
      category_id:        body.category_id ?? null,
      account_id:         body.account_id ?? null,
      is_recurring:       body.is_recurring ?? false,
      recurrence:         body.recurrence ?? null,
      color:              body.color ?? null,
      icon:               body.icon ?? null,
      notes:              body.notes?.trim() ?? null,
      status:             "unpaid",
      remind_days_before: body.remind_days_before ?? 3,
    })
    .select(SELECT_PLAIN)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bill: enrichBill(data as Record<string, unknown>) }, { status: 201 });
}
