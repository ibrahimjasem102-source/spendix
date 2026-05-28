import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DebtFormData } from "@/types";
import { notify } from "@/lib/notifications/service";
import { calculateRealRemainingDebt, calculateDebtHealth } from "@/lib/finance/relationshipEngine";

function isMissingContactsSchema(message: string) {
  return (
    (message.includes("financial_contacts") || message.includes("debts.contact_id") || message.includes("transactions.contact_id")) &&
    (message.includes("schema cache") || message.includes("Could not find") || message.includes("does not exist"))
  );
}

const DEBT_SELECT_WITH_CONTACT =
  "id,user_id,person_or_entity,debt_type,total_amount,paid_amount,due_date,status,notes,contact_id,created_at,updated_at,contact:financial_contacts(id,name,type,phone)";
const DEBT_SELECT_LEGACY =
  "id,user_id,person_or_entity,debt_type,total_amount,paid_amount,due_date,status,notes,created_at,updated_at";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let contactsAvailable = true;

  const [debtResult, paymentsResult] = await Promise.all([
    supabase.from("debts").select(DEBT_SELECT_WITH_CONTACT).eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("debt_payments").select("id,debt_id,amount,payment_date,notes,transaction_id,created_at").eq("user_id", user.id),
  ]);

  let rawDebts = debtResult.data;
  let debtError = debtResult.error;

  if (debtError && isMissingContactsSchema(debtError.message)) {
    const legacy = await supabase
      .from("debts").select(DEBT_SELECT_LEGACY).eq("user_id", user.id).order("created_at", { ascending: false });
    rawDebts = legacy.data as typeof rawDebts;
    debtError = legacy.error;
    contactsAvailable = false;
  }

  if (debtError) return NextResponse.json({ error: debtError.message }, { status: 500 });

  const allPayments = paymentsResult.data ?? [];

  const debts = (rawDebts ?? []).map((debt) => {
    const debtPayments = allPayments.filter((p) => p.debt_id === debt.id);
    const truth = calculateRealRemainingDebt(debt, debtPayments);
    const health = calculateDebtHealth(debt, debtPayments);
    const overdueDays =
      debt.due_date && truth.remaining > 0 && new Date(debt.due_date) < new Date()
        ? Math.floor((Date.now() - new Date(debt.due_date).getTime()) / 86_400_000)
        : 0;
    return {
      ...debt,
      paid_amount:      truth.paid,
      remaining_amount: truth.remaining,
      progress:         truth.progress,
      health,
      overdueDays,
      paymentsCount:    debtPayments.length,
    };
  });

  const summary = {
    totalPayable:    debts.filter((d) => d.debt_type === "payable").reduce((s, d) => s + d.remaining_amount, 0),
    totalReceivable: debts.filter((d) => d.debt_type === "receivable").reduce((s, d) => s + d.remaining_amount, 0),
    overdueCount:    debts.filter((d) => d.health === "overdue").length,
    totalDebts:      debts.length,
    activeDebts:     debts.filter((d) => d.status !== "paid").length,
  };

  return NextResponse.json({ debts, summary, contactsAvailable });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: DebtFormData = await request.json();
  let contactId = body.contact_id ?? null;

  if (contactId) {
    const { data: contact, error: contactError } = await supabase
      .from("financial_contacts").select("id,name").eq("id", contactId).eq("user_id", user.id).single();

    if (contactError && isMissingContactsSchema(contactError.message)) {
      return NextResponse.json({ errorKey: "contacts.setup_required", error: "Financial contacts table missing." }, { status: 409 });
    }
    if (contactError || !contact) return NextResponse.json({ errorKey: "contacts.not_found" }, { status: 400 });
    if (!body.person_or_entity?.trim()) body.person_or_entity = contact.name;
  }

  // Create the debt record only — NO transaction created here.
  // Transactions are created exclusively when payments are made,
  // preventing double-counting of debt amounts in the balance.
  const insertPayload: Record<string, unknown> = {
    user_id:          user.id,
    person_or_entity: body.person_or_entity,
    debt_type:        body.debt_type,
    total_amount:     body.total_amount,
    paid_amount:      0,
    due_date:         body.due_date ?? null,
    notes:            body.notes ?? null,
    status:           "active",
  };
  if (contactId) insertPayload.contact_id = contactId;

  const { data: debt, error: debtErr } = await supabase
    .from("debts").insert(insertPayload).select(DEBT_SELECT_LEGACY).single();

  if (debtErr) return NextResponse.json({ error: debtErr.message }, { status: 500 });

  void notify.debtCreated(supabase, user.id, (debt as { id: string }).id, body.person_or_entity, body.debt_type === "payable");

  return NextResponse.json({ debt }, { status: 201 });
}
