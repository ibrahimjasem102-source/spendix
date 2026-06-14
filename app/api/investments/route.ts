import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { InvestmentFormData } from "@/types";
import { notify } from "@/lib/notifications/service";
import { insertLinkedTransaction, updateTransactionSourceLink } from "@/lib/finance/serverTransactions";
import { writeLedgerEntry } from "@/lib/ledger/writer";

const INVESTMENT_SELECT =
  "id,user_id,asset_name,asset_type,amount_invested,current_value,investment_date,notes,transaction_id,created_at,updated_at";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("investments")
    .select(INVESTMENT_SELECT)
    .eq("user_id", user.id)
    .order("investment_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ investments: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: InvestmentFormData = await request.json();

  const { data: tx, error: txError } = await insertLinkedTransaction(supabase, {
    user_id: user.id,
    title: `Investment: ${body.asset_name}`,
    amount: body.amount_invested,
    type: "expense",
    source: "investment",
    transaction_date: body.investment_date,
    notes: body.notes ?? null,
  });

  if (txError || !tx) return NextResponse.json({ error: txError?.message ?? "Transaction failed" }, { status: 500 });

  const { data: investment, error } = await supabase
    .from("investments")
    .insert({
      user_id: user.id,
      asset_name: body.asset_name,
      asset_type: body.asset_type,
      amount_invested: body.amount_invested,
      current_value: body.current_value ?? null,
      investment_date: body.investment_date,
      notes: body.notes ?? null,
      transaction_id: tx.id,
    })
    .select(INVESTMENT_SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Best-effort: link the transaction to the investment (non-blocking)
  await updateTransactionSourceLink(supabase, tx.id, investment.id).catch((err) => {
    console.warn("[investments/post] updateTransactionSourceLink failed:", err);
  });

  void notify.investmentAdded(
    supabase,
    user.id,
    investment.id,
    body.asset_name,
    Number(body.amount_invested).toFixed(2),
  );

  // Write unified ledger entry (best-effort)
  void writeLedgerEntry(supabase, {
    user_id:       user.id,
    source_module: "investment",
    source_id:     investment.id,
    entry_type:    "investment",
    direction:     "outflow",
    amount:        Number(body.amount_invested),
    description:   `Investment: ${body.asset_name}`,
    transaction_id: tx.id,
  });

  return NextResponse.json({ investment }, { status: 201 });
}
