import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { WorkSessionFormData } from "@/types";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: Partial<WorkSessionFormData> = await request.json();
  const { paid_immediately, ...updateData } = body;

  const { data: session, error } = await supabase
    .from("work_sessions")
    .update({ ...updateData, updated_at: new Date().toISOString() })
    .eq("id", id).eq("user_id", user.id)
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ session });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Collect transaction IDs from linked payments before cascade delete
  const { data: payments } = await supabase
    .from("work_payments")
    .select("transaction_id")
    .eq("work_session_id", id)
    .eq("user_id", user.id);

  const { error } = await supabase
    .from("work_sessions")
    .delete()
    .eq("id", id).eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Delete linked transactions
  const txIds = (payments ?? []).map((p) => p.transaction_id).filter(Boolean) as string[];
  if (txIds.length > 0) {
    await supabase.from("transactions").delete().in("id", txIds).eq("user_id", user.id);
  }

  return new NextResponse(null, { status: 204 });
}
