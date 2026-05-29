import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rate-limit";
import { readJson } from "@/lib/api/request";
import { AccountFormData } from "@/types";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(request, { key: "accounts-put", limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });

  const body = await readJson<Partial<AccountFormData>>(request);

  if (body.is_default) {
    await supabase
      .from("accounts")
      .update({ is_default: false })
      .eq("user_id", user.id)
      .neq("id", id);
  }

  const { data, error } = await supabase
    .from("accounts")
    .update({
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.type !== undefined && { type: body.type }),
      ...(body.currency !== undefined && { currency: body.currency }),
      ...(body.initial_balance !== undefined && { initial_balance: Number(body.initial_balance) }),
      ...(body.color !== undefined && { color: body.color }),
      ...(body.is_default !== undefined && { is_default: body.is_default }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ account: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("accounts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
