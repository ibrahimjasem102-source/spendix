import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rate-limit";
import { readJson } from "@/lib/api/request";

export interface RecurringTransaction {
  id: string;
  user_id: string;
  title: string;
  amount: number;
  type: "income" | "expense";
  category_id: string | null;
  account_id: string | null;
  notes: string | null;
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval_count: number;
  start_date: string;
  end_date: string | null;
  next_run_date: string;
  last_run_date: string | null;
  active: boolean;
  auto_create: boolean;
  created_at: string;
  updated_at: string;
  // joined
  category?: { id: string; name: string; color: string; icon?: string | null } | null;
}

export type RecurringFormData = Omit<RecurringTransaction,
  "id" | "user_id" | "created_at" | "updated_at" | "last_run_date" | "category"
>;

const SELECT = "id,user_id,title,amount,type,category_id,account_id,notes,frequency,interval_count,start_date,end_date,next_run_date,last_run_date,active,auto_create,created_at,updated_at,category:categories(id,name,color,icon)";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("recurring_transactions")
    .select(SELECT)
    .eq("user_id", user.id)
    .order("next_run_date", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ recurring: data ?? [] });
}

export async function POST(request: Request) {
  const limited = rateLimit(request, { key: "recurring-post", limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });

  const body = await readJson<RecurringFormData>(request);
  if (!body.title?.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 });
  if (!body.amount || Number(body.amount) <= 0) return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });

  const { data, error } = await supabase
    .from("recurring_transactions")
    .insert({
      user_id:        user.id,
      title:          body.title.trim(),
      amount:         Number(body.amount),
      type:           body.type ?? "expense",
      category_id:    body.category_id ?? null,
      account_id:     body.account_id ?? null,
      notes:          body.notes?.trim() ?? null,
      frequency:      body.frequency ?? "monthly",
      interval_count: body.interval_count ?? 1,
      start_date:     body.start_date ?? new Date().toISOString().slice(0, 10),
      end_date:       body.end_date ?? null,
      next_run_date:  body.next_run_date ?? body.start_date ?? new Date().toISOString().slice(0, 10),
      active:         body.active ?? true,
      auto_create:    body.auto_create ?? true,
    })
    .select(SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ recurring: data }, { status: 201 });
}
