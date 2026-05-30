import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readJson } from "@/lib/api/request";
import type { SavingsCategory, SavingsPot, SavingsPotFormData } from "@/types";

const CATEGORIES: SavingsCategory[] = ["emergency","travel","car","home","education","retirement","other"];

function todayStr() { return new Date().toISOString().slice(0, 10); }

interface RawPot {
  id: string; user_id: string; name: string; category: string;
  target_amount: number | null; color: string | null; notes: string | null;
  created_at: string; updated_at: string;
  savings_transactions: { type: string; amount: number }[];
}

function enrichPot(raw: RawPot): SavingsPot {
  const txs     = raw.savings_transactions ?? [];
  const balance = txs.reduce((s, t) =>
    t.type === "deposit" ? s + Number(t.amount) : s - Number(t.amount), 0);
  const safeBal  = Math.max(0, balance);
  const target   = raw.target_amount != null ? Number(raw.target_amount) : null;
  const progress = target && target > 0 ? Math.min(100, Math.round((safeBal / target) * 100)) : 0;
  return {
    id:            raw.id,
    user_id:       raw.user_id,
    name:          raw.name,
    category:      raw.category as SavingsCategory,
    target_amount: target,
    color:         raw.color,
    notes:         raw.notes,
    created_at:    raw.created_at,
    updated_at:    raw.updated_at,
    balance:       safeBal,
    progress,
    tx_count:      txs.length,
  };
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("savings_pots")
    .select("*, savings_transactions(type, amount)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ pots: [] });
  return NextResponse.json({ pots: (data as unknown as RawPot[]).map(enrichPot) });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });

  const body = await readJson<SavingsPotFormData>(request);
  if (!body?.name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const { data: pot, error } = await supabase
    .from("savings_pots")
    .insert({
      user_id:       user.id,
      name:          body.name.trim(),
      category:      CATEGORIES.includes(body.category) ? body.category : "other",
      target_amount: body.target_amount != null ? Math.max(0, Number(body.target_amount)) : null,
      color:         body.color ?? null,
      notes:         body.notes ?? null,
    })
    .select("*, savings_transactions(type, amount)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pot: enrichPot(pot as unknown as RawPot) }, { status: 201 });
}

export { todayStr };
