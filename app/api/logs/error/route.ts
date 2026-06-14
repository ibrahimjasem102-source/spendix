import { NextResponse } from "next/server";
import { getRequestId } from "@/lib/api/responses";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";

const MAX_STACK_LEN = 4000;
const MAX_MSG_LEN   = 1000;

export async function POST(req: Request) {
  const requestId = getRequestId(req);

  // Rate-limit per IP: 20 errors per minute max
  const limited = rateLimit(req, { key: "frontend_error", limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  let body: {
    message?: string;
    stack?:   string;
    url?:     string;
    userId?:  string;
    metadata?: Record<string, unknown>;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  if (!body.message) return NextResponse.json({ ok: false }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;

  await db.from("frontend_errors").insert({
    user_id:  body.userId ?? null,
    message:  body.message.slice(0, MAX_MSG_LEN),
    stack:    body.stack?.slice(0, MAX_STACK_LEN) ?? null,
    url:      body.url ?? null,
    metadata: { ...body.metadata, requestId },
  });

  return NextResponse.json({ ok: true });
}
