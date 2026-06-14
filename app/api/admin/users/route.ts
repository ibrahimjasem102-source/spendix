import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { getRequestId } from "@/lib/api/responses";
import { isAdminEmail } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const { user, response } = await requireUser(requestId);
  if (response || !user) return response!;

  if (!isAdminEmail(user.email ?? "")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const q   = url.searchParams.get("q")?.trim();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;

  // Search auth users by email (Supabase admin API)
  const adminClient = createAdminClient();
  const { data: { users: authUsers }, error: authErr } = await adminClient.auth.admin.listUsers({
    page: 1, perPage: 20,
  });

  if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: 500 });

  let filtered = authUsers;
  if (q) {
    const ql = q.toLowerCase();
    filtered = authUsers.filter(u => u.email?.toLowerCase().includes(ql));
  }

  const userIds = filtered.map(u => u.id);
  if (userIds.length === 0) return NextResponse.json({ ok: true, data: [] });

  const [{ data: profiles }, { data: subs }, { data: permissions }] = await Promise.all([
    db.from("profile_settings").select("user_id, display_name, avatar_url, currency").in("user_id", userIds),
    db.from("subscriptions").select("user_id, plan, status, current_period_end").in("user_id", userIds),
    db.from("user_permissions").select("user_id, role").in("user_id", userIds),
  ]);

  const profileMap    = Object.fromEntries((profiles    ?? []).map((p: { user_id: string }) => [p.user_id, p]));
  const subMap        = Object.fromEntries((subs        ?? []).map((s: { user_id: string }) => [s.user_id, s]));
  const permissionMap = Object.fromEntries((permissions ?? []).map((r: { user_id: string }) => [r.user_id, r]));

  const data = filtered.map(u => ({
    id:            u.id,
    email:         u.email,
    created_at:    u.created_at,
    last_sign_in:  u.last_sign_in_at,
    profile:       profileMap[u.id]    ?? null,
    subscription:  subMap[u.id]        ?? null,
    permission:    permissionMap[u.id] ?? { role: "user" },
  }));

  return NextResponse.json({ ok: true, data });
}

export async function PATCH(req: Request) {
  const requestId = getRequestId(req);
  const { user, response } = await requireUser(requestId);
  if (response || !user) return response!;

  if (!isAdminEmail(user.email ?? "")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  let body: { userId: string; role?: string; banUntil?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  const VALID_ROLES = ["user","family_member","manager","admin","support_agent"];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;

  if (body.role && VALID_ROLES.includes(body.role)) {
    await db.from("user_permissions").upsert(
      { user_id: body.userId, role: body.role, granted_by: user.id, granted_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
    await db.from("security_events").insert({
      user_id:    user.id,
      event_type: "admin_action",
      severity:   "medium",
      metadata:   { action: "role_change", target_user: body.userId, new_role: body.role },
    });
  }

  return NextResponse.json({ ok: true });
}
