import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const contactId = (await params).id;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });

  // ── Fetch contact ────────────────────────────────────────────
  const { data: contact, error: contactErr } = await supabase
    .from("financial_contacts")
    .select("*")
    .eq("id", contactId)
    .eq("user_id", user.id)
    .single();

  if (contactErr || !contact)
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  // ── Fetch all debts linked to this contact ───────────────────
  const { data: rawDebts } = await supabase
    .from("debts")
    .select("*")
    .eq("user_id", user.id)
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false });

  const debts = rawDebts ?? [];

  // ── Fetch transactions linked to this contact ────────────────
  const { data: rawTx } = await supabase
    .from("transactions")
    .select("id,title,amount,type,source,transaction_date,created_at,category:categories(name,color,icon)")
    .eq("user_id", user.id)
    .eq("contact_id", contactId)
    .order("transaction_date", { ascending: false })
    .limit(50);

  const transactions = rawTx ?? [];

  // ── Fetch work sessions linked to this contact ───────────────
  const { data: rawWork } = await supabase
    .from("work_sessions")
    .select("id,title,employer_or_client,expected_amount,work_date,status,notes")
    .eq("user_id", user.id)
    .or(`contact_id.eq.${contactId},employer_or_client.ilike.${contact.name.replace(/'/g, "''")}`)
    .order("work_date", { ascending: false })
    .limit(20);

  const workSessions = rawWork ?? [];

  // ── Compute aggregates ───────────────────────────────────────
  let totalPayable = 0, totalReceivable = 0;
  let totalPayablePaid = 0, totalReceivablePaid = 0;
  let activeDebts = 0, paidDebts = 0, overdueDebts = 0;
  let largestDebt = 0;
  let lastPaymentDate: string | null = null;

  for (const d of debts) {
    const total   = Number(d.total_amount) || 0;
    const paid    = Number(d.paid_amount)  || 0;

    if (d.debt_type === "payable") {
      totalPayable     += total;
      totalPayablePaid += paid;
    } else {
      totalReceivable     += total;
      totalReceivablePaid += paid;
    }

    if (total > largestDebt) largestDebt = total;

    if (d.status === "paid") paidDebts++;
    else if (d.status === "overdue") overdueDebts++;
    else activeDebts++;
  }

  const totalPaid      = totalPayablePaid + totalReceivablePaid;
  const totalAllAmount = totalPayable + totalReceivable;
  const totalRemaining = Math.max(0, totalAllAmount - totalPaid);

  // Positive = they owe me (receivable > payable), Negative = I owe them
  const netBalance =
    (totalReceivable - totalReceivablePaid) -
    (totalPayable    - totalPayablePaid);

  // ── Health score ─────────────────────────────────────────────
  const recoveryRate   = totalAllAmount > 0 ? (totalPaid / totalAllAmount) * 100 : 100;
  const repaymentRate  = totalAllAmount > 0 ? (totalPaid / totalAllAmount) * 100 : 100;
  const paymentVelocity = debts.length > 0 ? totalPaid / debts.length : 0;

  const health: "healthy" | "attention_needed" | "high_risk" | "overdue" | "settled" =
    debts.length === 0 || (activeDebts === 0 && overdueDebts === 0)
      ? "settled"
      : overdueDebts > 0
        ? "overdue"
        : recoveryRate >= 80
          ? "healthy"
          : recoveryRate >= 50
            ? "attention_needed"
            : "high_risk";

  // ── Truth key ────────────────────────────────────────────────
  let truthKey = "contacts.no_balance";
  if (netBalance > 0)       truthKey = "contacts.they_owe";
  else if (netBalance < 0)  truthKey = "contacts.i_owe";

  // ── Insights ─────────────────────────────────────────────────
  const insights: { key: string; params?: Record<string, string | number>; tone: "positive" | "warning" | "risk" | "neutral" }[] = [];

  if (overdueDebts > 0)
    insights.push({ key: "contacts.insight_overdue",  params: { count: overdueDebts },         tone: "risk"     });
  if (recoveryRate >= 90 && debts.length > 0)
    insights.push({ key: "contacts.insight_healthy",  params: { rate: Math.round(recoveryRate) }, tone: "positive" });
  if (activeDebts > 3)
    insights.push({ key: "contacts.insight_many",     params: { count: activeDebts },            tone: "warning"  });
  if (netBalance !== 0)
    insights.push({ key: netBalance > 0 ? "contacts.insight_receivable" : "contacts.insight_payable",
                    params: { amount: Math.abs(netBalance) },  tone: netBalance > 0 ? "positive" : "warning" });

  // ── Timeline (debt creation + payments) ─────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const timeline: {
    id: string; type: "debt_created" | "payment" | "settled" | "overdue";
    date: string; amount: number; debtId: string;
    debtType: string; titleKey: string; descriptionKey: string;
    params?: Record<string, string | number>;
  }[] = [];

  for (const d of debts) {
    const total = Number(d.total_amount) || 0;
    const paid  = Number(d.paid_amount)  || 0;

    timeline.push({
      id:             `created-${d.id}`,
      type:           "debt_created",
      date:           d.created_at?.slice(0, 10) ?? today,
      amount:         total,
      debtId:         d.id,
      debtType:       d.debt_type,
      titleKey:       "relationship.timeline.debt_created",
      descriptionKey: d.debt_type === "payable" ? "relationship.timeline.debt_payable_desc" : "relationship.timeline.debt_receivable_desc",
      params:         { amount: total },
    });

    if (paid > 0) {
      timeline.push({
        id:             `payment-${d.id}`,
        type:           d.status === "paid" ? "settled" : "payment",
        date:           d.updated_at?.slice(0, 10) ?? today,
        amount:         paid,
        debtId:         d.id,
        debtType:       d.debt_type,
        titleKey:       d.status === "paid" ? "relationship.timeline.debt_settled" : "relationship.timeline.payment_made",
        descriptionKey: "relationship.timeline.payment_desc",
        params:         { amount: paid },
      });
      if (!lastPaymentDate || d.updated_at > lastPaymentDate) {
        lastPaymentDate = d.updated_at?.slice(0, 10) ?? null;
      }
    }

    if (d.status === "overdue") {
      timeline.push({
        id:             `overdue-${d.id}`,
        type:           "overdue",
        date:           d.due_date ?? today,
        amount:         total - paid,
        debtId:         d.id,
        debtType:       d.debt_type,
        titleKey:       "relationship.timeline.debt_overdue",
        descriptionKey: "relationship.timeline.overdue_desc",
        params:         { amount: total - paid },
      });
    }
  }

  timeline.sort((a, b) => b.date.localeCompare(a.date));

  // ── Transaction totals from linked transactions ──────────────
  const txIncome  = transactions
    .filter((tx) => tx.type === "income")
    .reduce((s, tx) => s + Number(tx.amount), 0);
  const txExpense = transactions
    .filter((tx) => tx.type === "expense")
    .reduce((s, tx) => s + Number(tx.amount), 0);

  return NextResponse.json({
    contact,
    debts,
    transactions,
    workSessions,
    txIncome,
    txExpense,
    totalPayable,
    totalReceivable,
    totalPaid,
    totalPayablePaid,
    totalReceivablePaid,
    totalRemaining,
    totalPayableRemaining:    Math.max(0, totalPayable    - totalPayablePaid),
    totalReceivableRemaining: Math.max(0, totalReceivable - totalReceivablePaid),
    netBalance,
    direction: netBalance > 0 ? "contact_owes_you" : netBalance < 0 ? "you_owe_contact" : "settled",
    health,
    truthKey,
    truthParams: { amount: Math.abs(netBalance) },
    activeDebts,
    paidDebts,
    overdueDebts,
    totalDebts: debts.length,
    recoveryRate,
    repaymentRate,
    paymentVelocity,
    averagePaymentDays: 0,
    largestDebt,
    mostRecentDebtDate: debts[0]?.created_at?.slice(0, 10) ?? null,
    lastPaymentDate,
    insights,
    timeline: timeline.slice(0, 10),
  });
}
