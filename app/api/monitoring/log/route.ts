import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rate-limit";
import type { LogLevel, LogCategory } from "@/lib/monitoring/logger";

export const dynamic = "force-dynamic";

interface IncomingLog {
  level:     LogLevel;
  category:  LogCategory;
  message:   string;
  data?:     Record<string, unknown>;
  url?:      string;
  duration?: number;
  timestamp: number;
  sessionId: string;
}

// Only persist warn+ level logs to the database
const PERSIST_LEVELS: LogLevel[] = ["warn", "error", "critical"];

export async function POST(req: Request) {
  // Strict rate limit on monitoring endpoint: 30 req/min per IP
  const limited = rateLimit(req, { key: "monitoring", limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  let body: { logs: IncomingLog[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!Array.isArray(body.logs) || body.logs.length === 0) {
    return NextResponse.json({ ok: true, saved: 0 });
  }

  // Cap incoming batch
  const logs = body.logs.slice(0, 20);

  // Try to get user (optional — logs can come from unauthenticated routes)
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch { /* ignore */ }

  // Only persist logs that warrant it
  const toSave = logs.filter(l => PERSIST_LEVELS.includes(l.level));

  if (toSave.length > 0) {
    try {
      const supabase = await createClient();
      await supabase.from("app_logs").insert(
        toSave.map(l => ({
          user_id:    userId,
          level:      l.level,
          category:   l.category,
          message:    l.message.slice(0, 1000),  // cap message length
          data:       l.data ?? null,
          url:        l.url?.slice(0, 500) ?? null,
          duration_ms: l.duration ?? null,
          session_id: l.sessionId,
          client_ts:  new Date(l.timestamp).toISOString(),
        })),
      );
    } catch {
      // DB unavailable — silently continue
    }
  }

  return NextResponse.json({ ok: true, saved: toSave.length });
}
