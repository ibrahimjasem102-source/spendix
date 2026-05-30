import { requireUser } from "@/lib/api/auth";
import { apiJson, getRequestId } from "@/lib/api/responses";
import { rateLimit } from "@/lib/api/rate-limit";
import { normalizeSearchQuery } from "@/lib/api/request";

export interface SearchResult {
  id:          string;
  type:        "transaction" | "debt" | "investment" | "work_session" | "work_payment" | "goal" | "contact" | "savings";
  title:       string;
  subtitle:    string;
  amount?:     number;
  amountType?: "income" | "expense" | "neutral";
  url:         string;
  date?:       string;
  noteSnippet?: string;    // set when match was in notes field
}

function snippet(text: string | null | undefined, maxLen = 70): string {
  if (!text) return "";
  return text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
}

function matchedOnNotes(field: string, q: string): boolean {
  return !field.toLowerCase().includes(q.toLowerCase());
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

  // Run all queries in parallel for speed
  const [txsRes, debtsRes, invsRes, sessionsRes, paymentsRes, goalsRes, contactsRes, savingsRes] =
    await Promise.all([
      // ── Transactions ─────────────────────────────────────────────
      supabase
        .from("transactions")
        .select("id, title, notes, amount, type, transaction_date, source, category:categories(name)")
        .eq("user_id", uid)
        .or(`title.ilike.${pattern},notes.ilike.${pattern}`)
        .order("transaction_date", { ascending: false })
        .limit(6),

      // ── Debts ─────────────────────────────────────────────────────
      supabase
        .from("debts")
        .select("id, person_or_entity, notes, total_amount, paid_amount, status, debt_type, due_date")
        .eq("user_id", uid)
        .or(`person_or_entity.ilike.${pattern},notes.ilike.${pattern}`)
        .limit(4),

      // ── Investments ───────────────────────────────────────────────
      supabase
        .from("investments")
        .select("id, asset_name, notes, asset_type, amount_invested, current_value, investment_date")
        .eq("user_id", uid)
        .or(`asset_name.ilike.${pattern},notes.ilike.${pattern}`)
        .limit(4),

      // ── Work sessions ─────────────────────────────────────────────
      supabase
        .from("work_sessions")
        .select("id, title, employer_or_client, expected_amount, work_date")
        .eq("user_id", uid)
        .or(`title.ilike.${pattern},employer_or_client.ilike.${pattern}`)
        .limit(3),

      // ── Work payments ─────────────────────────────────────────────
      supabase
        .from("work_payments")
        .select("id, employer_or_client, amount, payment_date")
        .eq("user_id", uid)
        .ilike("employer_or_client", pattern)
        .limit(3),

      // ── Goals ─────────────────────────────────────────────────────
      supabase
        .from("goals")
        .select("id, title, notes, target_amount, saved_amount, category, due_date, tracking_type")
        .eq("user_id", uid)
        .or(`title.ilike.${pattern},notes.ilike.${pattern}`)
        .limit(4),

      // ── Contacts (People) ─────────────────────────────────────────
      supabase
        .from("financial_contacts")
        .select("id, name, type, notes, email, phone")
        .eq("user_id", uid)
        .or(`name.ilike.${pattern},notes.ilike.${pattern}`)
        .limit(4),

      // ── Savings Pots ──────────────────────────────────────────────
      supabase
        .from("savings_pots")
        .select("id, name, notes, category, target_amount")
        .eq("user_id", uid)
        .or(`name.ilike.${pattern},notes.ilike.${pattern}`)
        .limit(3),
    ]);

  // ── Map transactions ──────────────────────────────────────────
  for (const tx of txsRes.data ?? []) {
    const catName = (tx.category as unknown as { name: string } | null)?.name;
    const src     = (tx.source as string | null) ?? "manual";
    const onNotes = matchedOnNotes(tx.title, q);
    results.push({
      id:          tx.id,
      type:        "transaction",
      title:       tx.title,
      subtitle:    `${catName ?? (src !== "manual" ? src.replace("_", " ") : "")} · ${tx.transaction_date}`.replace(/^· /, ""),
      amount:      Number(tx.amount),
      amountType:  tx.type as "income" | "expense",
      url:         `/transactions`,
      date:        tx.transaction_date,
      noteSnippet: onNotes ? snippet(tx.notes) : undefined,
    });
  }

  // ── Map debts ─────────────────────────────────────────────────
  for (const d of debtsRes.data ?? []) {
    const remaining = Number(d.total_amount) - Number(d.paid_amount);
    const isPayable = d.debt_type === "payable";
    const onNotes   = matchedOnNotes(d.person_or_entity, q);
    results.push({
      id:          d.id,
      type:        "debt",
      title:       d.person_or_entity,
      subtitle:    `${isPayable ? "payable" : "receivable"} · ${d.status}${d.due_date ? ` · ${d.due_date}` : ""}`,
      amount:      remaining,
      amountType:  isPayable ? "expense" : "income",
      url:         `/debts`,
      noteSnippet: onNotes ? snippet(d.notes) : undefined,
    });
  }

  // ── Map investments ───────────────────────────────────────────
  for (const inv of invsRes.data ?? []) {
    const cv      = Number(inv.current_value ?? inv.amount_invested);
    const pl      = cv - Number(inv.amount_invested);
    const onNotes = matchedOnNotes(inv.asset_name, q);
    results.push({
      id:          inv.id,
      type:        "investment",
      title:       inv.asset_name,
      subtitle:    `${inv.asset_type} · ${inv.investment_date}`,
      amount:      cv,
      amountType:  pl >= 0 ? "income" : "expense",
      url:         `/investments`,
      date:        inv.investment_date,
      noteSnippet: onNotes ? snippet((inv as unknown as { notes?: string }).notes) : undefined,
    });
  }

  // ── Map work sessions ─────────────────────────────────────────
  for (const s of sessionsRes.data ?? []) {
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

  // ── Map work payments ─────────────────────────────────────────
  for (const p of paymentsRes.data ?? []) {
    results.push({
      id:         p.id,
      type:       "work_payment",
      title:      p.employer_or_client,
      subtitle:   p.payment_date,
      amount:     Number(p.amount),
      amountType: "income",
      url:        `/work`,
      date:       p.payment_date,
    });
  }

  // ── Map goals ─────────────────────────────────────────────────
  for (const g of goalsRes.data ?? []) {
    const target    = Number(g.target_amount) || 0;
    const saved     = Number(g.saved_amount)  || 0;
    const progress  = target > 0 ? Math.round((saved / target) * 100) : 0;
    const onNotes   = matchedOnNotes(g.title, q);
    results.push({
      id:          g.id,
      type:        "goal",
      title:       g.title,
      subtitle:    `${g.category} · ${progress}%${g.due_date ? ` · ${g.due_date}` : ""}`,
      amount:      target,
      amountType:  "neutral",
      url:         `/goals`,
      date:        g.due_date ?? undefined,
      noteSnippet: onNotes ? snippet(g.notes) : undefined,
    });
  }

  // ── Map contacts ──────────────────────────────────────────────
  for (const c of contactsRes.data ?? []) {
    const onNotes = matchedOnNotes(c.name, q);
    results.push({
      id:          c.id,
      type:        "contact",
      title:       c.name,
      subtitle:    `${c.type}${c.phone ? ` · ${c.phone}` : ""}${c.email ? ` · ${c.email}` : ""}`,
      url:         `/debts`,
      amountType:  "neutral",
      noteSnippet: onNotes ? snippet(c.notes) : undefined,
    });
  }

  // ── Map savings pots ──────────────────────────────────────────
  for (const p of savingsRes.data ?? []) {
    const onNotes = matchedOnNotes(p.name, q);
    results.push({
      id:          p.id,
      type:        "savings",
      title:       p.name,
      subtitle:    `${p.category}${p.target_amount ? ` · target: ${p.target_amount}` : ""}`,
      url:         `/savings`,
      amountType:  "neutral",
      amount:      p.target_amount ? Number(p.target_amount) : undefined,
      noteSnippet: onNotes ? snippet(p.notes) : undefined,
    });
  }

  results.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  return apiJson({ results: results.slice(0, 20) }, { requestId });
}
