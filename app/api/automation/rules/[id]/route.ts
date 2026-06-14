import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { getRequestId } from "@/lib/api/responses";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const requestId = getRequestId(req);
  const { supabase, user, response } = await requireUser(requestId);
  if (response || !user) return response!;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  const ALLOWED = ["name","description","is_active","trigger_config","action_config"];
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of ALLOWED) { if (key in body) updates[key] = body[key]; }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("automation_rules")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, name, is_active")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const requestId = getRequestId(req);
  const { supabase, user, response } = await requireUser(requestId);
  if (response || !user) return response!;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("automation_rules")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
