export type RelationshipHealth = "healthy" | "attention_needed" | "high_risk" | "overdue" | "settled";
export type RelationshipDirection = "contact_owes_you" | "you_owe_contact" | "settled";
export type TimelineEventType = "debt_created" | "payment" | "settled" | "overdue";

export interface RelationshipDebtInput {
  id: string;
  person_or_entity: string;
  debt_type: "payable" | "receivable";
  total_amount: number | string;
  paid_amount?: number | string | null;
  due_date?: string | null;
  status: "active" | "partially_paid" | "paid" | "overdue";
  notes?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface RelationshipPaymentInput {
  id: string;
  debt_id: string;
  amount: number | string;
  payment_date: string;
  notes?: string | null;
  transaction_id?: string | null;
  created_at?: string | null;
}

export interface RelationshipInsight {
  key: string;
  params?: Record<string, string | number>;
  tone: "positive" | "warning" | "risk" | "neutral";
}

export interface RelationshipTimelineEvent {
  id: string;
  type: TimelineEventType;
  date: string;
  amount: number;
  debtId: string;
  debtType: "payable" | "receivable";
  titleKey: string;
  descriptionKey: string;
  params?: Record<string, string | number>;
}

export interface DebtTruth {
  id: string;
  total: number;
  paid: number;
  remaining: number;
  progress: number;
  health: RelationshipHealth;
  overdueDays: number;
  paymentsCount: number;
}

export interface ContactFinancialSummary {
  totalPayable: number;
  totalReceivable: number;
  totalPaid: number;
  totalPayablePaid: number;
  totalReceivablePaid: number;
  totalRemaining: number;
  totalPayableRemaining: number;
  totalReceivableRemaining: number;
  netBalance: number;
  direction: RelationshipDirection;
  health: RelationshipHealth;
  healthKey: string;
  truthKey: string;
  truthParams: Record<string, string | number>;
  activeDebts: number;
  paidDebts: number;
  overdueDebts: number;
  totalDebts: number;
  recoveryRate: number;
  repaymentRate: number;
  paymentVelocity: number;
  averagePaymentDays: number;
  largestDebt: number;
  lastPaymentDate: string | null;
  mostRecentDebtDate: string | null;
  debtTruth: DebtTruth[];
  timeline: RelationshipTimelineEvent[];
  insights: RelationshipInsight[];
}

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function daysBetween(start?: string | null, end?: string | null) {
  if (!start || !end) return 0;
  const a = new Date(`${start.slice(0, 10)}T00:00:00`).getTime();
  const b = new Date(`${end.slice(0, 10)}T00:00:00`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(Math.round((b - a) / 86_400_000), 0);
}

function overdueDays(dueDate?: string | null, remaining = 0) {
  if (!dueDate || remaining <= 0) return 0;
  return daysBetween(dueDate, dateOnly(new Date()));
}

function paymentsForDebt(payments: RelationshipPaymentInput[], debtId: string) {
  return payments.filter((payment) => payment.debt_id === debtId);
}

export function calculateRealRemainingDebt(debt: RelationshipDebtInput, payments: RelationshipPaymentInput[] = []) {
  const total = numberValue(debt.total_amount);
  const paidFromPayments = payments.reduce((sum, payment) => sum + numberValue(payment.amount), 0);
  const recordedPaid = numberValue(debt.paid_amount);
  const paid = Math.min(Math.max(paidFromPayments, recordedPaid), total);
  const remaining = Math.max(total - paid, 0);

  return {
    total,
    paid,
    remaining,
    progress: total > 0 ? Math.round((paid / total) * 100) : 0,
  };
}

export function calculateDebtHealth(debt: RelationshipDebtInput, payments: RelationshipPaymentInput[] = []): RelationshipHealth {
  const truth = calculateRealRemainingDebt(debt, payments);
  const overdue = overdueDays(debt.due_date, truth.remaining);

  if (truth.remaining <= 0 || debt.status === "paid") return "settled";
  if (debt.status === "overdue" || overdue > 0) return "overdue";
  if (truth.remaining >= 1000 || (truth.total > 0 && truth.remaining / truth.total >= 0.75 && payments.length === 0)) return "high_risk";
  if (truth.paid > 0 || debt.status === "partially_paid") return "attention_needed";
  return "healthy";
}

export function calculateNetRelationshipBalance(debts: RelationshipDebtInput[], payments: RelationshipPaymentInput[] = []) {
  return debts.reduce((net, debt) => {
    const remaining = calculateRealRemainingDebt(debt, paymentsForDebt(payments, debt.id)).remaining;
    return debt.debt_type === "receivable" ? net + remaining : net - remaining;
  }, 0);
}

export function generateRelationshipInsight(summary: Pick<ContactFinancialSummary, "health" | "overdueDebts" | "recoveryRate" | "paymentVelocity" | "netBalance" | "totalDebts" | "activeDebts">): RelationshipInsight {
  if (summary.health === "settled") return { key: "relationship.insights.all_settled", tone: "positive" };
  if (summary.overdueDebts > 0) return { key: "relationship.insights.overdue_balances", params: { count: summary.overdueDebts }, tone: "risk" };
  if (summary.recoveryRate >= 70) return { key: "relationship.insights.recovered_percent", params: { percent: Math.round(summary.recoveryRate) }, tone: "positive" };
  if (summary.paymentVelocity > 0) return { key: "relationship.insights.payments_this_month", params: { amount: summary.paymentVelocity.toFixed(0) }, tone: "positive" };
  if (summary.activeDebts > 1) return { key: "relationship.insights.multiple_active", params: { count: summary.activeDebts }, tone: "warning" };
  return { key: "relationship.insights.monitor", tone: "neutral" };
}

export function calculateContactFinancialSummary(
  debts: RelationshipDebtInput[],
  payments: RelationshipPaymentInput[] = []
): ContactFinancialSummary {
  let totalPayable = 0;
  let totalReceivable = 0;
  let totalPaid = 0;
  let totalPayablePaid = 0;
  let totalReceivablePaid = 0;
  let totalPayableRemaining = 0;
  let totalReceivableRemaining = 0;
  let overdueDebts = 0;
  let paidDebts = 0;
  let activeDebts = 0;
  let largestDebt = 0;
  let paymentDaysTotal = 0;
  let paymentDaysCount = 0;

  const now = new Date();
  const monthStart = dateOnly(new Date(now.getFullYear(), now.getMonth(), 1));
  const paymentVelocity = payments
    .filter((payment) => payment.payment_date >= monthStart)
    .reduce((sum, payment) => sum + numberValue(payment.amount), 0);

  const debtTruth = debts.map((debt) => {
    const relatedPayments = paymentsForDebt(payments, debt.id);
    const real = calculateRealRemainingDebt(debt, relatedPayments);
    const health = calculateDebtHealth(debt, relatedPayments);
    const overdue = overdueDays(debt.due_date, real.remaining);

    largestDebt = Math.max(largestDebt, real.total);
    totalPaid += real.paid;

    if (health === "settled") paidDebts += 1;
    else activeDebts += 1;
    if (health === "overdue") overdueDebts += 1;

    relatedPayments.forEach((payment) => {
      paymentDaysTotal += daysBetween(debt.created_at, payment.payment_date);
      paymentDaysCount += 1;
    });

    if (debt.debt_type === "payable") {
      totalPayable += real.total;
      totalPayablePaid += real.paid;
      totalPayableRemaining += real.remaining;
    } else {
      totalReceivable += real.total;
      totalReceivablePaid += real.paid;
      totalReceivableRemaining += real.remaining;
    }

    return {
      id: debt.id,
      total: real.total,
      paid: real.paid,
      remaining: real.remaining,
      progress: real.progress,
      health,
      overdueDays: overdue,
      paymentsCount: relatedPayments.length,
    };
  });

  const totalRemaining = totalPayableRemaining + totalReceivableRemaining;
  const netBalance = totalReceivableRemaining - totalPayableRemaining;
  const direction: RelationshipDirection =
    netBalance > 0 ? "contact_owes_you" :
    netBalance < 0 ? "you_owe_contact" :
    "settled";

  const health = determineRelationshipHealth(debtTruth, totalRemaining);
  const totalDebts = debts.length;
  const recoveryRate = totalReceivable > 0 ? (totalReceivablePaid / totalReceivable) * 100 : 0;
  const repaymentRate = totalPayable > 0 ? (totalPayablePaid / totalPayable) * 100 : 0;
  const lastPaymentDate = payments.map((payment) => payment.payment_date).sort().at(-1) ?? null;
  const mostRecentDebtDate = debts.map((debt) => debt.created_at?.slice(0, 10)).filter(Boolean).sort().at(-1) ?? null;
  const averagePaymentDays = paymentDaysCount > 0 ? Math.round(paymentDaysTotal / paymentDaysCount) : 0;

  const truthParams = {
    amount: Math.abs(netBalance).toFixed(2),
    count: activeDebts,
    overdue: overdueDebts,
    totalDebts,
  };

  const summaryBase = {
    totalPayable,
    totalReceivable,
    totalPaid,
    totalPayablePaid,
    totalReceivablePaid,
    totalRemaining,
    totalPayableRemaining,
    totalReceivableRemaining,
    netBalance,
    direction,
    health,
    healthKey: `relationship.health.${health}`,
    truthKey: `relationship.truth.${direction}`,
    truthParams,
    activeDebts,
    paidDebts,
    overdueDebts,
    totalDebts,
    recoveryRate,
    repaymentRate,
    paymentVelocity,
    averagePaymentDays,
    largestDebt,
    lastPaymentDate,
    mostRecentDebtDate,
    debtTruth,
    timeline: buildTimeline(debts, payments, debtTruth),
  };

  return {
    ...summaryBase,
    insights: [
      generateRelationshipInsight(summaryBase),
      ...buildSecondaryInsights(summaryBase),
    ].slice(0, 4),
  };
}

function determineRelationshipHealth(debtTruth: DebtTruth[], totalRemaining: number): RelationshipHealth {
  if (debtTruth.length === 0 || totalRemaining <= 0) return "settled";
  if (debtTruth.some((debt) => debt.health === "overdue")) return "overdue";
  if (debtTruth.some((debt) => debt.health === "high_risk")) return "high_risk";
  if (debtTruth.some((debt) => debt.health === "attention_needed")) return "attention_needed";
  return "healthy";
}

function buildTimeline(
  debts: RelationshipDebtInput[],
  payments: RelationshipPaymentInput[],
  debtTruth: DebtTruth[]
): RelationshipTimelineEvent[] {
  const events: RelationshipTimelineEvent[] = [];
  const truthByDebt = new Map(debtTruth.map((truth) => [truth.id, truth]));
  const debtById = new Map(debts.map((debt) => [debt.id, debt]));

  debts.forEach((debt) => {
    events.push({
      id: `debt-${debt.id}`,
      type: "debt_created",
      date: debt.created_at.slice(0, 10),
      amount: numberValue(debt.total_amount),
      debtId: debt.id,
      debtType: debt.debt_type,
      titleKey: "relationship.timeline.debt_created",
      descriptionKey: debt.debt_type === "receivable" ? "relationship.timeline.receivable_created" : "relationship.timeline.payable_created",
    });

    const truth = truthByDebt.get(debt.id);
    if (truth?.health === "overdue") {
      events.push({
        id: `overdue-${debt.id}`,
        type: "overdue",
        date: debt.due_date ?? dateOnly(new Date()),
        amount: truth.remaining,
        debtId: debt.id,
        debtType: debt.debt_type,
        titleKey: "relationship.timeline.overdue",
        descriptionKey: "relationship.timeline.overdue_description",
        params: { days: truth.overdueDays },
      });
    }
    if (truth?.remaining === 0) {
      events.push({
        id: `settled-${debt.id}`,
        type: "settled",
        date: debt.updated_at?.slice(0, 10) ?? debt.created_at.slice(0, 10),
        amount: truth.total,
        debtId: debt.id,
        debtType: debt.debt_type,
        titleKey: "relationship.timeline.settled",
        descriptionKey: "relationship.timeline.settled_description",
      });
    }
  });

  payments.forEach((payment) => {
    const debt = debtById.get(payment.debt_id);
    if (!debt) return;
    events.push({
      id: `payment-${payment.id}`,
      type: "payment",
      date: payment.payment_date,
      amount: numberValue(payment.amount),
      debtId: payment.debt_id,
      debtType: debt.debt_type,
      titleKey: "relationship.timeline.payment",
      descriptionKey: "relationship.timeline.payment_description",
    });
  });

  return events.sort((a, b) => b.date.localeCompare(a.date));
}

function buildSecondaryInsights(summary: Omit<ContactFinancialSummary, "insights">): RelationshipInsight[] {
  const insights: RelationshipInsight[] = [];
  if (summary.overdueDebts === 0 && summary.totalDebts > 0) {
    insights.push({ key: "relationship.insights.no_overdue", tone: "positive" });
  }
  if (summary.repaymentRate >= 70) {
    insights.push({ key: "relationship.insights.repayment_progress", params: { percent: Math.round(summary.repaymentRate) }, tone: "positive" });
  }
  if (summary.largestDebt > 0) {
    insights.push({ key: "relationship.insights.largest_debt", params: { amount: summary.largestDebt.toFixed(0) }, tone: "neutral" });
  }
  if (summary.averagePaymentDays > 0) {
    insights.push({ key: "relationship.insights.avg_payment_time", params: { days: summary.averagePaymentDays }, tone: "neutral" });
  }
  return insights;
}
