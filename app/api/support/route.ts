import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";

const VALID_TYPES = ["feedback", "bug", "feature", "support"] as const;

export async function POST(req: Request) {
  const limited = rateLimit(req, { key: "support", limit: 5, windowMs: 60_000 });
  if (limited) return limited;

  let body: {
    type: string;
    title: string;
    body: string;
    priority?: string;
    appVersion?: string;
  };

  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 }); }

  if (!VALID_TYPES.includes(body.type as typeof VALID_TYPES[number])) {
    return NextResponse.json({ ok: false, error: "invalid_type" }, { status: 400 });
  }
  if (!body.title?.trim() || !body.body?.trim()) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }

  let userId: string | null = null;
  let userEmail: string | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId    = user?.id ?? null;
    userEmail = user?.email ?? null;
  } catch { /* anonymous support tickets allowed */ }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("support_tickets").insert({
      user_id:     userId,
      type:        body.type,
      title:       body.title.slice(0, 200),
      body:        body.body.slice(0, 5000),
      priority:    VALID_TYPES.includes(body.priority as typeof VALID_TYPES[number]) ? (body.priority as string) : "normal",
      user_email:  userEmail,
      app_version: body.appVersion?.slice(0, 20) ?? null,
    }).select("id").single();

    if (error) throw error;

    return NextResponse.json({ ok: true, ticketId: data?.id });
  } catch (err) {
    console.error("[support] insert error:", (err as Error).message);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
