import { NextResponse } from "next/server";
import { getRequestId } from "@/lib/api/responses";
import { requireUser } from "@/lib/api/auth";
import { isAdminEmail } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rate-limit";
import { rateMetric, type RUMMetric } from "@/lib/monitoring/rum";

export const dynamic = "force-dynamic";

const VALID_METRICS = new Set(["fcp","lcp","ttfb","dom_load","page_load","cls","fid","inp"]);

export async function POST(req: Request) {
  const requestId = getRequestId(req);

  const limited = rateLimit(req, { key: "perf_ingest", limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  let body: {
    page:            string;
    session_id?:     string;
    device_category?: string;
    connection_type?: string;
    samples:         { metric: string; value_ms: number }[];
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  if (!body.page || !Array.isArray(body.samples)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Try to identify user (optional)
  let userId: string | null = null;
  try {
    const { user } = await requireUser(requestId);
    userId = user?.id ?? null;
  } catch { /* anonymous ok */ }

  const valid = body.samples
    .filter(s => VALID_METRICS.has(s.metric) && typeof s.value_ms === "number" && s.value_ms >= 0 && s.value_ms < 120_000)
    .slice(0, 10);

  if (valid.length === 0) return NextResponse.json({ ok: true, saved: 0 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db  = createAdminClient() as any;
  const rows = valid.map(s => ({
    user_id:         userId,
    session_id:      body.session_id?.slice(0, 64) ?? null,
    page:            body.page.slice(0, 200),
    metric:          s.metric,
    value_ms:        s.value_ms,
    device_category: body.device_category ?? "unknown",
    connection_type: body.connection_type  ?? "unknown",
  }));

  await db.from("performance_samples").insert(rows);
  return NextResponse.json({ ok: true, saved: rows.length });
}

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const { user, response } = await requireUser(requestId);
  if (response || !user) return response!;
  if (!isAdminEmail(user.email ?? "")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const url   = new URL(req.url);
  const page  = url.searchParams.get("page");
  const days  = Math.min(parseInt(url.searchParams.get("days") ?? "7"), 30);
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;

  let query = db.from("performance_samples")
    .select("page, metric, value_ms, device_category")
    .gte("created_at", since)
    .limit(5000);

  if (page) query = query.eq("page", page);

  const { data: samples } = await query as {
    data: { page: string; metric: string; value_ms: number; device_category: string }[]
  };

  // Aggregate: group by page + metric, compute p50/p75/p95
  const agg = new Map<string, number[]>();
  for (const s of samples ?? []) {
    const key = `${s.page}::${s.metric}`;
    if (!agg.has(key)) agg.set(key, []);
    agg.get(key)!.push(s.value_ms);
  }

  const results = [...agg.entries()].map(([key, values]) => {
    const [pg, metric] = key.split("::");
    const sorted = [...values].sort((a, b) => a - b);
    const p = (pct: number) => sorted[Math.floor(sorted.length * pct)] ?? 0;
    return {
      page:   pg,
      metric,
      p50:    Math.round(p(0.5)),
      p75:    Math.round(p(0.75)),
      p95:    Math.round(p(0.95)),
      count:  values.length,
      rating: rateMetric(metric as RUMMetric, p(0.75)),
    };
  });

  return NextResponse.json({ ok: true, data: results, periodDays: days });
}
