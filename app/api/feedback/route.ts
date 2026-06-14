import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { getRequestId } from "@/lib/api/responses";
import { rateLimit } from "@/lib/api/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const { user, response } = await requireUser(requestId);
  if (response || !user) return response!;

  const limited = rateLimit(req, { key: "feedback", limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  let body: {
    type:     "bug" | "feature" | "rating";
    title?:   string;
    body?:    string;
    rating?:  number;
    comment?: string;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;

  if (body.type === "rating") {
    const r = Number(body.rating);
    if (!r || r < 1 || r > 5) {
      return NextResponse.json({ ok: false, error: "rating must be 1-5" }, { status: 400 });
    }
    await db.from("app_ratings").insert({
      user_id: user.id,
      rating:  r,
      comment: body.comment?.slice(0, 500) ?? null,
    });
    return NextResponse.json({ ok: true });
  }

  if (!["bug","feature"].includes(body.type)) {
    return NextResponse.json({ ok: false, error: "invalid type" }, { status: 400 });
  }
  if (!body.title?.trim()) {
    return NextResponse.json({ ok: false, error: "title required" }, { status: 400 });
  }

  await db.from("support_tickets").insert({
    user_id:  user.id,
    type:     body.type,
    title:    body.title.trim().slice(0, 200),
    body:     body.body?.trim().slice(0, 2000) ?? null,
    priority: body.type === "bug" ? "medium" : "low",
    status:   "open",
  });

  return NextResponse.json({ ok: true });
}
