import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { getRequestId } from "@/lib/api/responses";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const { supabase, user, response } = await requireUser(requestId);
  if (response || !user) return response!;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("consent_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    data: data ?? {
      analytics_consent: false,
      marketing_consent: false,
      crash_reporting:   true,
      data_sharing:      false,
    },
  });
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const { supabase, user, response } = await requireUser(requestId);
  if (response || !user) return response!;

  let body: {
    analytics_consent?: boolean;
    marketing_consent?: boolean;
    crash_reporting?:   boolean;
    data_sharing?:      boolean;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  const ALLOWED = ["analytics_consent","marketing_consent","crash_reporting","data_sharing"];
  const updates: Record<string, unknown> = { user_id: user.id, updated_at: new Date().toISOString() };
  for (const key of ALLOWED) {
    if (key in body && typeof (body as Record<string, unknown>)[key] === "boolean") {
      updates[key] = (body as Record<string, unknown>)[key];
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("consent_settings")
    .upsert(updates, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}
