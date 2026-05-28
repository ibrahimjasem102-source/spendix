import { requireUser } from "@/lib/api/auth";
import { apiJson, getRequestId } from "@/lib/api/responses";
import { rateLimit } from "@/lib/api/rate-limit";
import { normalizeSearchQuery } from "@/lib/api/request";

export interface SearchResult {
  id: string;
  type: "transaction" | "debt" | "investment" | "work_session" | "work_payment";
  title: string;
  subtitle: string;
  amount?: number;
  amountType?: "income" | "expense" | "neutral";
  url: string;
  date?: string;
}

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const limited = rateLimit(request, { key: "search", limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const q = normalizeSearchQuery(searchParams.get("q"));
  if (q.length < 2) return apiJson({ results: [] }, { requestId });

  const { supabase, user, response } = await requireUser(requestId);
  if (response || !user) return response;

  const pattern = `%${q}%`;
  const uid = user.id;
  const results: SearchResult[] = [];

  // ── Transactions (all sources) ────────────────────────────────
  const { data: txs } = await supabase
    .from("transactions")
    .select("id, title, notes, amount, type, transaction_date, source, category:categories(name)")
    .eq("user_id", uid)
    .or(`title.ilike.${pattern},notes.ilike.${pattern}`)
    .order("transaction_date", { ascending: false })
    .limit(6);

  for (const tx of txs ?? []) {
    const catName = (tx.category as unknown as { name: string } | null)?.name;
    const src = (tx.source as string | null) ?? "manual";
    results.push({
      id:          tx.id,
      type:        "transaction",
      title:       tx.title,
      subtitle:    `${catName ?? (src !== "manual" ? src.replace("_", " ") : "")} · ${tx.transaction_date}`.replace(/^· /, ""),
      amount:      Number(tx.amount),
      amountType:  tx.type as "income" | "expense",
      url:         `/transactions`,
      date:        tx.transaction_date,
    });
  }

  // ── Debts ─────────────────────────────────────────────────────
  const { data: debts } = await supabase
    .from("debts")
    .select("id, person_or_entity, total_amount, paid_amount, status, debt_type, due_date")
    .eq("user_id", uid)
    .or(`person_or_entity.ilike.${pattern},notes.ilike.${pattern}`)
    .limit(4);

  for (const d of debts ?? []) {
    const remaining = Number(d.total_amount) - Number(d.paid_amount);
    const isPayable = d.debt_type === "payable";
    results.push({
      id:         d.id,
      type:       "debt",
      title:      d.person_or_entity,
      subtitle:   `${isPayable ? "أنا مدين" : "مستحق لي"} · ${d.status}${d.due_date ? ` · ${d.due_date}` : ""}`,
      amount:     remaining,
      amountType: isPayable ? "expense" : "income",
      url:        `/debts`,
    });
  }

  // ── Investments ───────────────────────────────────────────────
  const { data: invs } = await supabase
    .from("investments")
    .select("id, asset_name, asset_type, amount_invested, current_value, investment_date")
    .eq("user_id", uid)
    .ilike("asset_name", pattern)
    .limit(4);

  for (const inv of invs ?? []) {
    const cv = Number(inv.current_value ?? inv.amount_invested);
    const pl = cv - Number(inv.amount_invested);
    results.push({
      id:         inv.id,
      type:       "investment",
      title:      inv.asset_name,
      subtitle:   `${inv.asset_type} · ${inv.investment_date}`,
      amount:     cv,
      amountType: pl >= 0 ? "income" : "expense",
      url:        `/investments`,
      date:       inv.investment_date,
    });
  }

  // ── Work sessions ─────────────────────────────────────────────
  const { data: sessions } = await supabase
    .from("work_sessions")
    .select("id, title, employer_or_client, expected_amount, work_date")
    .eq("user_id", uid)
    .or(`title.ilike.${pattern},employer_or_client.ilike.${pattern}`)
    .limit(3);

  for (const s of sessions ?? []) {
    results.push({
      id:         s.id,
      type:       "work_session",
      title:      s.title,
      subtitle:   `${s.employer_or_client} · ${s.work_date}`,
      amount:     Number(s.expected_amount),
      amountType: "income",
      url:        `/work`,
      date:       s.work_date,
    });
  }

  // ── Work payments ─────────────────────────────────────────────
  const { data: payments } = await supabase
    .from("work_payments")
    .select("id, employer_or_client, amount, payment_date")
    .eq("user_id", uid)
    .ilike("employer_or_client", pattern)
    .limit(3);

  for (const p of payments ?? []) {
    results.push({
      id:         p.id,
      type:       "work_payment",
      title:      `دفعة: ${p.employer_or_client}`,
      subtitle:   p.payment_date,
      amount:     Number(p.amount),
      amountType: "income",
      url:        `/work`,
      date:       p.payment_date,
    });
  }

  results.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  return apiJson({ results: results.slice(0, 15) }, { requestId });
}
