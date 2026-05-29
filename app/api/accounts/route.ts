import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rate-limit";
import { readJson } from "@/lib/api/request";
import { AccountFormData } from "@/types";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });

  const { data: accounts, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Compute balance from transactions
  const { data: txAggs } = await supabase
    .from("transactions")
    .select("account_id, type, amount")
    .eq("user_id", user.id)
    .not("account_id", "is", null);

  const balanceMap = new Map<string, { inflow: number; outflow: number; count: number }>();
  for (const tx of txAggs ?? []) {
    const key = tx.account_id as string;
    const entry = balanceMap.get(key) ?? { inflow: 0, outflow: 0, count: 0 };
    if (tx.type === "income") entry.inflow += Number(tx.amount);
    else entry.outflow += Number(tx.amount);
    entry.count++;
    balanceMap.set(key, entry);
  }

  const result = (accounts ?? []).map((acc) => {
    const agg = balanceMap.get(acc.id) ?? { inflow: 0, outflow: 0, count: 0 };
    return {
      ...acc,
      balance: Number(acc.initial_balance) + agg.inflow - agg.outflow,
      transaction_count: agg.count,
    };
  });

  return NextResponse.json({ accounts: result });
}

export async function POST(request: Request) {
  const limited = rateLimit(request, { key: "accounts-post", limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });

  const body = await readJson<AccountFormData>(request);

  if (!body.name?.trim()) {
    return NextResponse.json({ errorKey: "accounts.name_required" }, { status: 400 });
  }

  // If setting as default, unset others first
  if (body.is_default) {
    await supabase
      .from("accounts")
      .update({ is_default: false })
      .eq("user_id", user.id);
  }

  const { data, error } = await supabase
    .from("accounts")
    .insert({
      user_id: user.id,
      name: body.name.trim(),
      type: body.type ?? "bank",
      currency: body.currency ?? "USD",
      initial_balance: Number(body.initial_balance) || 0,
      color: body.color ?? null,
      is_default: body.is_default ?? false,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ account: data }, { status: 201 });
}
