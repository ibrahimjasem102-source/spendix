import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { InvestmentFormData } from "@/types";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: InvestmentFormData = await request.json();

  // Update investment
  const { data: investment, error } = await supabase
    .from("investments")
    .update({
      asset_name:      body.asset_name,
      asset_type:      body.asset_type,
      amount_invested: body.amount_invested,
      current_value:   body.current_value ?? null,
      investment_date: body.investment_date,
      notes:           body.notes ?? null,
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Sync linked transaction
  if (investment.transaction_id) {
    await supabase
      .from("transactions")
      .update({
        title:            `استثمار: ${body.asset_name}`,
        amount:           body.amount_invested,
        transaction_date: body.investment_date,
        notes:            body.notes ?? null,
      })
      .eq("id", investment.transaction_id)
      .eq("user_id", user.id);
  }

  return NextResponse.json({ investment });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get transaction_id before deleting
  const { data: inv } = await supabase
    .from("investments")
    .select("transaction_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  // Delete investment
  const { error } = await supabase
    .from("investments")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Delete linked transaction
  if (inv?.transaction_id) {
    await supabase
      .from("transactions")
      .delete()
      .eq("id", inv.transaction_id)
      .eq("user_id", user.id);
  }

  return new NextResponse(null, { status: 204 });
}
