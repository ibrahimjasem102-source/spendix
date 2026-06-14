import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { getRequestId } from "@/lib/api/responses";

export const dynamic = "force-dynamic";

type OrgRole = "owner" | "admin" | "member" | "viewer";
const VALID_ROLES: OrgRole[] = ["owner", "admin", "member", "viewer"];

async function assertOrgAccess(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  orgId: string,
  userId: string,
  minRole: OrgRole[] = ["owner", "admin"],
) {
  const { data } = await db
    .from("org_members").select("role").eq("org_id", orgId).eq("user_id", userId).single();
  if (!data || !minRole.includes(data.role)) return null;
  return data.role as OrgRole;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: orgId } = await params;
  const requestId = getRequestId(req);
  const { supabase, user, response } = await requireUser(requestId);
  if (response || !user) return response!;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const role = await assertOrgAccess(db, orgId, user.id, ["owner","admin","member","viewer"]);
  if (!role) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const { data, error } = await db
    .from("org_members")
    .select("user_id, role, created_at")
    .eq("org_id", orgId)
    .order("created_at");

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: orgId } = await params;
  const requestId = getRequestId(req);
  const { supabase, user, response } = await requireUser(requestId);
  if (response || !user) return response!;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const callerRole = await assertOrgAccess(db, orgId, user.id);
  if (!callerRole) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  let body: { user_id: string; role?: OrgRole };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  if (!body.user_id) return NextResponse.json({ ok: false, error: "user_id required" }, { status: 400 });
  const role: OrgRole = VALID_ROLES.includes(body.role!) ? body.role! : "member";
  if (role === "owner") return NextResponse.json({ ok: false, error: "cannot assign owner" }, { status: 400 });

  const { data, error } = await db
    .from("org_members")
    .upsert({ org_id: orgId, user_id: body.user_id, role }, { onConflict: "org_id,user_id" })
    .select("user_id, role")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data }, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: orgId } = await params;
  const requestId = getRequestId(req);
  const { supabase, user, response } = await requireUser(requestId);
  if (response || !user) return response!;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const callerRole = await assertOrgAccess(db, orgId, user.id);
  if (!callerRole) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const url        = new URL(req.url);
  const targetUser = url.searchParams.get("user_id");
  if (!targetUser) return NextResponse.json({ ok: false, error: "user_id required" }, { status: 400 });

  // Cannot remove the org owner
  const { data: targetMember } = await db
    .from("org_members").select("role").eq("org_id", orgId).eq("user_id", targetUser).single();
  if (targetMember?.role === "owner") {
    return NextResponse.json({ ok: false, error: "cannot_remove_owner" }, { status: 400 });
  }

  const { error } = await db
    .from("org_members").delete().eq("org_id", orgId).eq("user_id", targetUser);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
