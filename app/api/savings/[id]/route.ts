import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readJson } from "@/lib/api/request";
import type { SavingsCategory, SavingsPotFormData } from "@/types";

const CATEGORIES: SavingsCategory[] = ["emergency","travel","car","home","education","retirement","other"];

interface RawPot {
  id: string; user_id: string; name: string; category: string;
  target_amount: number | null; color: string | null; notes: string | null;
  created_at: string; updated_at: string;
  savings_transactions: { type: string; amount: number }[];
}

function enrichPot(raw: RawPot) {
  const txs    = raw.savings_transactions ?? [];
  const bal    = txs.reduce((s, t) => t.type === "deposit" ? s + Number(t.amount) : s - Number(t.amount), 0);
  const safeBal = Math.max(0, bal);
  const target  = raw.target_amount != null ? Number(raw.target_amount) : null;
  return {
    id: raw.id, user_id: raw.user_id, name: raw.name,
    category: raw.category, target_amount: target,
    color: raw.color, notes: raw.notes,
    created_at: raw.created_at, updated_at: raw.updated_at,
    balance: safeBal,
    progress: target && target > 0 ? Math.min(100, Math.round((safeBal / target) * 100)) : 0,
    tx_count: txs.length,
  };
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await readJson<Partial<SavingsPotFormData>>(request);

  const patch: Record<string, unknown> = {};
  if (body.name        !== undefined) patch.name          = body.name?.trim();
  if (body.category    !== undefined) patch.category      = CATEGORIES.includes(body.category as SavingsCategory) ? body.category : "other";
  if (body.target_amount !== undefined) patch.target_amount = body.target_amount != null ? Math.max(0, Number(body.target_amount)) : null;
  if (body.color       !== undefined) patch.color         = body.color;
  if (body.notes       !== undefined) patch.notes         = body.notes;

  const { data: pot, error } = await supabase
    .from("savings_pots")
    .update(patch)
    .eq("id", id).eq("user_id", user.id)
    .select("*, savings_transactions(type, amount)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pot: enrichPot(pot as unknown as RawPot) });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase.from("savings_pots").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
