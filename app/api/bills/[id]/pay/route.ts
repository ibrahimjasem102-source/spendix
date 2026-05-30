import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rate-limit";
import { readJson } from "@/lib/api/request";
import { BillPayData } from "@/types";
import { createNotification } from "@/lib/notifications/service";

function computeNextDueDate(currentDue: string, recurrence: string): string {
  const d = new Date(currentDue);
  switch (recurrence) {
    case "monthly":   d.setMonth(d.getMonth() + 1);      break;
    case "quarterly": d.setMonth(d.getMonth() + 3);      break;
    case "yearly":    d.setFullYear(d.getFullYear() + 1); break;
  }
  return d.toISOString().slice(0, 10);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(request, { key: "bills-pay", limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });

  const body = await readJson<BillPayData>(request);
  if (!body.amount || Number(body.amount) <= 0) {
    return NextResponse.json({ errorKey: "bills.amount_positive" }, { status: 400 });
  }

  // Get the bill
  const { data: bill, error: billErr } = await supabase
    .from("bills")
    .select("id,name,category_id,account_id,is_recurring,recurrence,due_date,color")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (billErr || !bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });

  // Create expense transaction
  const txPayload: Record<string, unknown> = {
    user_id:          user.id,
    title:            bill.name,
    amount:           Number(body.amount),
    type:             "expense",
    source:           "manual",
    category_id:      body.account_id !== undefined ? (bill.category_id ?? null) : (bill.category_id ?? null),
    account_id:       body.account_id ?? bill.account_id ?? null,
    transaction_date: body.payment_date ?? new Date().toISOString().slice(0, 10),
    notes:            body.notes?.trim() ?? null,
    related_source_id: id,
  };

  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .insert(txPayload)
    .select("id")
    .single();

  if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });

  // Mark bill as paid
  await supabase
    .from("bills")
    .update({
      status:         "paid",
      paid_at:        body.payment_date ?? new Date().toISOString().slice(0, 10),
      transaction_id: tx.id,
      updated_at:     new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  // If recurring, create next bill automatically
  let nextBillId: string | null = null;
  if (bill.is_recurring && bill.recurrence) {
    const nextDue = computeNextDueDate(bill.due_date, bill.recurrence);
    const { data: nextBill } = await supabase
      .from("bills")
      .insert({
        user_id:       user.id,
        name:          bill.name,
        amount:        null,
        currency:      "USD",
        due_date:      nextDue,
        category_id:   bill.category_id ?? null,
        account_id:    bill.account_id ?? null,
        is_recurring:  true,
        recurrence:    bill.recurrence,
        color:         bill.color ?? null,
        status:        "unpaid",
        remind_days_before: 3,
      })
      .select("id")
      .single();
    nextBillId = nextBill?.id ?? null;
  }

  // Notification: bill paid
  void createNotification(supabase, {
    user_id:           user.id,
    title:             `تم دفع فاتورة: ${bill.name}`,
    message:           `تم تسجيل دفع €${Number(body.amount).toFixed(2)} لفاتورة ${bill.name}.${bill.is_recurring ? ` الفاتورة التالية ستُنشأ تلقائياً.` : ""}`,
    type:              "success",
    source:            "transaction",
    priority:          "normal",
    related_source_id: id,
    action_url:        "/bills",
  });

  return NextResponse.json({ success: true, transaction_id: tx.id, next_bill_id: nextBillId });
}
