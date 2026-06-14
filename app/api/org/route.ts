import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { getRequestId } from "@/lib/api/responses";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const { supabase, user, response } = await requireUser(requestId);
  if (response || !user) return response!;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data, error } = await db
    .from("org_members")
    .select(`
      role,
      org:organizations (
        id, name, slug, settings, created_at
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { referencedTable: "organizations", ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const { supabase, user, response } = await requireUser(requestId);
  if (response || !user) return response!;

  let body: { name: string; slug?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  if (!body.name?.trim()) {
    return NextResponse.json({ ok: false, error: "name required" }, { status: 400 });
  }

  const slug = (body.slug ?? body.name)
    .trim().toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 40);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: org, error: orgErr } = await db
    .from("organizations")
    .insert({ name: body.name.trim(), slug, owner_id: user.id })
    .select("id, name, slug")
    .single();

  if (orgErr) {
    const msg = orgErr.code === "23505" ? "slug_taken" : orgErr.message;
    return NextResponse.json({ ok: false, error: msg }, { status: 409 });
  }

  await db.from("org_members").insert({
    org_id:  org.id,
    user_id: user.id,
    role:    "owner",
  });

  return NextResponse.json({ ok: true, data: org }, { status: 201 });
}
