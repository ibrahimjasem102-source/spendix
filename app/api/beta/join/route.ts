import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { getRequestId } from "@/lib/api/responses";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const { user, response } = await requireUser(requestId);
  if (response || !user) return response!;

  let body: { code: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  const code = body.code?.trim().toUpperCase();
  if (!code) return NextResponse.json({ ok: false, error: "code_required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;

  // Find the invite
  const { data: invite, error: findErr } = await db
    .from("beta_invites")
    .select("id, code, use_count, max_uses, expires_at, used_by")
    .eq("code", code)
    .maybeSingle();

  if (findErr || !invite) {
    return NextResponse.json({ ok: false, error: "invalid_code" }, { status: 404 });
  }

  // Already used by someone else (single-use check)
  if (invite.max_uses === 1 && invite.used_by && invite.used_by !== user.id) {
    return NextResponse.json({ ok: false, error: "code_already_used" }, { status: 409 });
  }

  // Max uses exceeded
  if (invite.use_count >= invite.max_uses) {
    return NextResponse.json({ ok: false, error: "code_exhausted" }, { status: 409 });
  }

  // Expired
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ ok: false, error: "code_expired" }, { status: 410 });
  }

  // Already in beta
  if (invite.used_by === user.id) {
    return NextResponse.json({ ok: true, message: "already_in_beta" });
  }

  // Redeem
  const { error: updateErr } = await db
    .from("beta_invites")
    .update({
      used_by:   user.id,
      used_at:   new Date().toISOString(),
      use_count: (invite.use_count ?? 0) + 1,
    })
    .eq("id", invite.id);

  if (updateErr) return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, message: "welcome_to_beta" });
}
