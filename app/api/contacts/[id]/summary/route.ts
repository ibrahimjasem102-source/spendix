import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateContactFinancialSummary } from "@/lib/finance/relationshipEngine";

type Params = { params: Promise<{ id: string }> };
type DebtRow = {
  id: string;
  user_id: string;
  person_or_entity: string;
  debt_type: "payable" | "receivable";
  total_amount: number;
  paid_amount: number;
  due_date: string | null;
  status: "active" | "partially_paid" | "paid" | "overdue";
  notes: string | null;
  contact_id: string | null;
  created_at: string;
  updated_at: string;
};

type DebtPaymentRow = {
  id: string;
  debt_id: string;
  amount: number;
  payment_date: string;
  notes: string | null;
  transaction_id: string | null;
  created_at: string | null;
};

export async function GET(_req: Request, { params }: Params) {
  const { id: contactId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch the contact
  const { data: contact, error: cErr } = await supabase
    .from("financial_contacts")
    .select("id,user_id,name,type,phone,email,notes,created_at,updated_at")
    .eq("id", contactId).eq("user_id", user.id)
    .single();

  if (cErr || !contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  // Fetch all debts linked to this contact
  const { data: debts } = await supabase
    .from("debts")
    .select("id,user_id,person_or_entity,debt_type,total_amount,paid_amount,due_date,status,notes,contact_id,created_at,updated_at")
    .eq("contact_id", contactId).eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const debtList = (debts ?? []) as DebtRow[];

  // Fetch all payments for this contact through its debts.
  const debtIds = debtList.map((d) => d.id);
  let lastPaymentDate: string | null = null;
  let paymentList: DebtPaymentRow[] = [];

  if (debtIds.length > 0) {
    const { data: payments } = await supabase
      .from("debt_payments")
      .select("id,debt_id,amount,payment_date,notes,transaction_id,created_at")
      .in("debt_id", debtIds)
      .eq("user_id", user.id)
      .order("payment_date", { ascending: false });

    paymentList = (payments ?? []) as DebtPaymentRow[];
    lastPaymentDate = paymentList[0]?.payment_date ?? null;
  }

  const financialTruth = calculateContactFinancialSummary(debtList, paymentList);
  const debtTruthById = new Map(financialTruth.debtTruth.map((truth) => [truth.id, truth]));
  const debtsWithComputedPaid = debtList.map((debt) => {
    const truth = debtTruthById.get(debt.id);
    return {
      ...debt,
      paid_amount: truth?.paid ?? Number(debt.paid_amount),
      remaining_amount: truth?.remaining ?? Math.max(Number(debt.total_amount) - Number(debt.paid_amount), 0),
      health: truth?.health,
      progress: truth?.progress,
      overdueDays: truth?.overdueDays,
      paymentsCount: truth?.paymentsCount,
    };
  });

  return NextResponse.json({
    contact,
    debts: debtsWithComputedPaid,
    ...financialTruth,
    lastPaymentDate: financialTruth.lastPaymentDate ?? lastPaymentDate,
  });
}
