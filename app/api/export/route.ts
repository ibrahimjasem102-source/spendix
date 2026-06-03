import { requireUser } from "@/lib/api/auth";
import { apiJson, getRequestId } from "@/lib/api/responses";

function csvRow(fields: (string | number | null | undefined)[]): string {
  return fields
    .map((f) => {
      const s = f == null ? "" : String(f);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    })
    .join(",");
}

function makeCSV(header: string[], rows: (string | number | null | undefined)[][]): string {
  return [csvRow(header), ...rows.map(csvRow)].join("\n");
}

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const { supabase, user, response } = await requireUser(requestId);
  if (response || !user) return response;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "transactions";

  // ── Transactions ──────────────────────────────────────────────
  if (type === "transactions") {
    const { data, error } = await supabase
      .from("transactions")
      .select("title,amount,type,source,transaction_date,notes,category:categories(name)")
      .eq("user_id", user.id)
      .order("transaction_date", { ascending: false });

    if (error) return apiJson({ error: "Export failed" }, { status: 500, requestId });

    const csv = makeCSV(
      ["Date", "Title", "Type", "Source", "Amount", "Category", "Notes"],
      (data ?? []).map((tx) => [
        tx.transaction_date, tx.title, tx.type, tx.source ?? "manual",
        tx.amount, (tx.category as { name?: string } | null)?.name ?? "", tx.notes,
      ])
    );
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="spendix-transactions-${new Date().toISOString().slice(0,10)}.csv"`,
      },
    });
  }

  // ── Goals ─────────────────────────────────────────────────────
  if (type === "goals") {
    const { data, error } = await supabase
      .from("goals")
      .select("title,category,tracking_type,target_amount,saved_amount,monthly_contribution,start_date,due_date,status,notes")
      .eq("user_id", user.id);

    if (error) return apiJson({ error: "Export failed" }, { status: 500, requestId });

    const csv = makeCSV(
      ["Title", "Category", "Tracking", "Target", "Saved", "Monthly", "Start Date", "Due Date", "Status", "Notes"],
      (data ?? []).map((g) => [
        g.title, g.category, g.tracking_type,
        g.target_amount, g.saved_amount, g.monthly_contribution,
        g.start_date, g.due_date ?? "", g.status ?? "", g.notes ?? "",
      ])
    );
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="spendix-goals-${new Date().toISOString().slice(0,10)}.csv"`,
      },
    });
  }

  // ── Debts ─────────────────────────────────────────────────────
  if (type === "debts") {
    const { data, error } = await supabase
      .from("debts")
      .select("person_or_entity,debt_type,total_amount,paid_amount,due_date,status,notes,created_at")
      .eq("user_id", user.id);

    if (error) return apiJson({ error: "Export failed" }, { status: 500, requestId });

    const csv = makeCSV(
      ["Person/Entity", "Type", "Total", "Paid", "Remaining", "Due Date", "Status", "Created", "Notes"],
      (data ?? []).map((d) => [
        d.person_or_entity, d.debt_type,
        d.total_amount, d.paid_amount,
        Number(d.total_amount) - Number(d.paid_amount),
        d.due_date ?? "", d.status,
        d.created_at?.slice(0,10) ?? "", d.notes ?? "",
      ])
    );
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="spendix-debts-${new Date().toISOString().slice(0,10)}.csv"`,
      },
    });
  }

  // ── Investments ───────────────────────────────────────────────
  if (type === "investments") {
    const { data, error } = await supabase
      .from("investments")
      .select("asset_name,asset_type,amount_invested,current_value,investment_date,notes")
      .eq("user_id", user.id)
      .order("investment_date", { ascending: false });

    if (error) return apiJson({ error: "Export failed" }, { status: 500, requestId });

    const csv = makeCSV(
      ["Asset Name", "Type", "Invested", "Current Value", "Gain/Loss", "Return %", "Date", "Notes"],
      (data ?? []).map((i) => {
        const invested = Number(i.amount_invested);
        const current  = Number(i.current_value ?? i.amount_invested);
        const gain     = current - invested;
        const pct      = invested > 0 ? ((gain / invested) * 100).toFixed(2) : "0";
        return [i.asset_name, i.asset_type, invested, current, gain.toFixed(2), pct, i.investment_date, i.notes ?? ""];
      })
    );
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="spendix-investments-${new Date().toISOString().slice(0,10)}.csv"`,
      },
    });
  }

  // ── Work ──────────────────────────────────────────────────────
  if (type === "work") {
    const [sessionsRes, paymentsRes] = await Promise.all([
      supabase
        .from("work_sessions")
        .select("title,employer_or_client,hourly_rate,hours_worked,expected_amount,work_date,status,notes")
        .eq("user_id", user.id)
        .order("work_date", { ascending: false }),
      supabase
        .from("work_payments")
        .select("employer_or_client,amount,payment_date,notes")
        .eq("user_id", user.id)
        .order("payment_date", { ascending: false }),
    ]);

    const sessions = makeCSV(
      ["Title", "Client", "Rate/h", "Hours", "Expected", "Date", "Notes"],
      (sessionsRes.data ?? []).map((s) => [
        s.title, s.employer_or_client, s.hourly_rate, s.hours_worked,
        s.expected_amount, s.work_date, s.notes ?? "",
      ])
    );
    const payments = makeCSV(
      ["Client", "Amount", "Date", "Notes"],
      (paymentsRes.data ?? []).map((p) => [p.employer_or_client, p.amount, p.payment_date, p.notes ?? ""])
    );

    const combined = `SESSIONS\n${sessions}\n\nPAYMENTS\n${payments}`;
    return new Response(combined, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="spendix-work-${new Date().toISOString().slice(0,10)}.csv"`,
      },
    });
  }

  // ── Full backup (JSON) ─────────────────────────────────────────
  if (type === "backup") {
    const [txRes, goalsRes, debtsRes, invRes, subsRes, budgetsRes, contactsRes] = await Promise.all([
      supabase.from("transactions").select("*").eq("user_id", user.id),
      supabase.from("goals").select("*").eq("user_id", user.id),
      supabase.from("debts").select("*").eq("user_id", user.id),
      supabase.from("investments").select("*").eq("user_id", user.id),
      supabase.from("subscriptions").select("*").eq("user_id", user.id),
      supabase.from("budgets").select("*").eq("user_id", user.id),
      supabase.from("financial_contacts").select("*").eq("user_id", user.id),
    ]);

    const backup = {
      exported_at: new Date().toISOString(),
      app: "Spendix",
      version: "1.0",
      data: {
        transactions:  txRes.data ?? [],
        goals:         goalsRes.data ?? [],
        debts:         debtsRes.data ?? [],
        investments:   invRes.data ?? [],
        subscriptions: subsRes.data ?? [],
        budgets:       budgetsRes.data ?? [],
        contacts:      contactsRes.data ?? [],
      },
    };

    return new Response(JSON.stringify(backup, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="spendix-backup-${new Date().toISOString().slice(0,10)}.json"`,
      },
    });
  }

  return apiJson({ error: "Unknown export type" }, { status: 400, requestId });
}
