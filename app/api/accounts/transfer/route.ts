import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readJson } from "@/lib/api/request";
import { rateLimit } from "@/lib/api/rate-limit";
import { writeLedgerEntry } from "@/lib/ledger/writer";

interface TransferBody {
  from_account_id: string;
  to_account_id:   string;
  amount:          number;
  date:            string;
  notes?:          string | null;
  title_out?:      string | null;
  title_in?:       string | null;
}

export async function POST(request: Request) {
  const limited = rateLimit(request, { key: "transfer", limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });

  const body = await readJson<TransferBody>(request);
  const { from_account_id, to_account_id, amount, date, notes, title_out, title_in } = body ?? {};

  if (!from_account_id || !to_account_id)
    return NextResponse.json({ error: "Both accounts required" }, { status: 400 });
  if (from_account_id === to_account_id)
    return NextResponse.json({ error: "Cannot transfer to same account" }, { status: 400 });
  if (!amount || amount <= 0)
    return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });

  // Verify both accounts belong to user
  const { data: accs } = await supabase
    .from("accounts")
    .select("id, name")
    .eq("user_id", user.id)
    .in("id", [from_account_id, to_account_id]);

  if (!accs || accs.length !== 2)
    return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const fromAcc = accs.find((a) => a.id === from_account_id);
  const toAcc   = accs.find((a) => a.id === to_account_id);

  const txDate = date ?? new Date().toISOString().slice(0, 10);

  const descOut = title_out ?? `→ ${toAcc?.name}`;
  const descIn  = title_in  ?? `← ${fromAcc?.name}`;

  // Outflow leg: expense from the source account
  const { data: txOut, error: errOut } = await supabase
    .from("transactions")
    .insert({
      user_id:          user.id,
      title:            descOut,
      amount,
      type:             "expense",
      source:           "transfer",   // not 'manual' — excluded from income/expense totals
      account_id:       from_account_id,
      transaction_date: txDate,
      notes:            notes ?? null,
      related_source_id: null,
    })
    .select("id")
    .single();

  if (errOut) return NextResponse.json({ error: errOut.message }, { status: 500 });

  // Inflow leg: income to the destination account
  const { data: txIn, error: errIn } = await supabase
    .from("transactions")
    .insert({
      user_id:          user.id,
      title:            descIn,
      amount,
      type:             "income",
      source:           "transfer",
      account_id:       to_account_id,
      transaction_date: txDate,
      notes:            notes ?? null,
      related_source_id: txOut?.id ?? null,  // links the two legs
    })
    .select("id")
    .single();

  if (errIn) {
    // Roll back the outflow leg so accounts stay consistent
    await supabase.from("transactions").delete().eq("id", txOut!.id);
    return NextResponse.json({ error: errIn.message }, { status: 500 });
  }

  // Write two ledger entries — both direction:neutral so they don't affect
  // income/expense totals. The individual account balances are correct because
  // each account_id still sees a debit/credit in the transactions table.
  void writeLedgerEntry(supabase, {
    user_id:       user.id,
    source_module: "transfer",
    source_id:     txOut!.id,
    entry_type:    "transfer",
    direction:     "outflow",
    amount,
    description:   descOut,
    transaction_id: txOut!.id,
    account_id:    from_account_id,
  });
  void writeLedgerEntry(supabase, {
    user_id:       user.id,
    source_module: "transfer",
    source_id:     txIn!.id,
    entry_type:    "transfer",
    direction:     "inflow",
    amount,
    description:   descIn,
    transaction_id: txIn!.id,
    account_id:    to_account_id,
  });

  return NextResponse.json({
    ok:       true,
    from_tx:  txOut?.id,
    to_tx:    txIn?.id,
  }, { status: 201 });
}
