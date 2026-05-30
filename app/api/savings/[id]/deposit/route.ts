import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readJson } from "@/lib/api/request";
import type { SavingsTxFormData } from "@/types";

function todayStr() { return new Date().toISOString().slice(0, 10); }

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify pot belongs to user
  const { data: pot, error: potErr } = await supabase
    .from("savings_pots")
    .select("id")
    .eq("id", id).eq("user_id", user.id)
    .single();
  if (potErr || !pot) return NextResponse.json({ error: "Pot not found" }, { status: 404 });

  const body = await readJson<SavingsTxFormData>(request);
  const amount = Number(body.amount);
  if (!amount || amount <= 0) return NextResponse.json({ error: "Amount must be > 0" }, { status: 400 });

  const { data: tx, error } = await supabase
    .from("savings_transactions")
    .insert({
      user_id:        user.id,
      savings_pot_id: id,
      type:           "deposit",
      amount,
      note:           body.note ?? null,
      date:           body.date ?? todayStr(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ transaction: tx }, { status: 201 });
}
