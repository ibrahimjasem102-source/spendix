"use client";

import { useGlobalActions } from "@/contexts/GlobalActionsContext";
import TransactionForm from "@/components/transactions/TransactionForm";
import InvestmentForm from "@/components/investments/InvestmentForm";
import DebtForm from "@/components/debts/DebtForm";
import DebtPaymentFABModal from "@/components/modals/DebtPaymentFABModal";
import WorkForm from "@/components/work/WorkForm";
import GoalFormModal, { type GoalFormData } from "@/components/goals/GoalFormModal";
import SubscriptionQuickForm from "@/components/subscriptions/SubscriptionQuickForm";
import {
  useCreateTransaction,
  useCreateInvestment,
  useCreateDebt,
  useCreateSubscription,
  useCreateWorkSession,
  useCreateWorkPayment,
  useWorkSessions,
  useWorkPayments,
  useCreateGoal,
} from "@/lib/query/hooks";
import type { TransactionFormData, InvestmentFormData, DebtFormData, SubscriptionFormData, WorkSessionFormData, WorkPaymentFormData } from "@/types";

export default function GlobalModals() {
  const { activeModal, closeModal } = useGlobalActions();

  // All hooks must be called unconditionally
  const createTxMut          = useCreateTransaction();
  const createInvMut         = useCreateInvestment();
  const createDebtMut        = useCreateDebt();
  const createSubMut         = useCreateSubscription();
  const createWorkSessionMut = useCreateWorkSession();
  const createWorkPaymentMut = useCreateWorkPayment();
  const createGoalMut        = useCreateGoal();

  // Work sessions — loaded so WorkForm can show the session picker in payment tab
  const { data: rawWorkSessions = [] } = useWorkSessions(activeModal === "work_session" || activeModal === "work_payment");
  const { data: workPayments    = [] } = useWorkPayments(activeModal === "work_session" || activeModal === "work_payment");

  // Compute status so paid sessions are excluded from the payment picker
  const today = new Date().toISOString().slice(0, 10);
  const workSessions = rawWorkSessions.map((s) => {
    const paid = workPayments
      .filter((p) => p.work_session_id === s.id)
      .reduce((a, p) => a + Number(p.amount), 0);
    const expected = Number(s.expected_amount);
    const status: "pending" | "paid" | "overdue" =
      expected > 0 && paid >= expected ? "paid"
      : s.due_date && s.due_date < today ? "overdue"
      : "pending";
    return { ...s, status, paid_amount: paid };
  });

  if (!activeModal) return null;

  /* ── Transaction (manual / income / expense) ─────────────── */
  if (activeModal === "transaction" || activeModal === "income" || activeModal === "expense") {
    const preType =
      activeModal === "income"  ? "income"  :
      activeModal === "expense" ? "expense" :
      undefined;

    async function handleTx(data: TransactionFormData) {
      await createTxMut.mutateAsync(data);
    }

    return <TransactionForm initialType={preType} onSubmit={handleTx} onClose={closeModal} />;
  }

  /* ── Investment ──────────────────────────────────────────── */
  if (activeModal === "investment") {
    async function handleInv(data: InvestmentFormData) {
      await createInvMut.mutateAsync(data);
    }
    return <InvestmentForm onSubmit={handleInv} onClose={closeModal} />;
  }

  /* ── Debt ────────────────────────────────────────────────── */
  if (activeModal === "debt" || activeModal === "debt_receivable" || activeModal === "debt_payable") {
    const preDebtType =
      activeModal === "debt_receivable" ? "receivable" :
      activeModal === "debt_payable"    ? "payable"    :
      undefined;
    async function handleDebt(data: DebtFormData) {
      await createDebtMut.mutateAsync(data);
    }
    return <DebtForm initialDebtType={preDebtType} onSubmit={handleDebt} onClose={closeModal} />;
  }

  /* ── Debt Payment (2-step: select debt then pay) ─────────── */
  if (activeModal === "debt_payment") {
    return <DebtPaymentFABModal onClose={closeModal} />;
  }

  if (activeModal === "subscription") {
    async function handleSubscription(data: SubscriptionFormData) {
      await createSubMut.mutateAsync(data);
    }
    return <SubscriptionQuickForm onSubmit={handleSubscription} onClose={closeModal} />;
  }

  /* ── Work (Session + Payment combined) ──────────────────── */
  if (activeModal === "work_session" || activeModal === "work_payment") {
    async function handleWorkSession(data: WorkSessionFormData) {
      await createWorkSessionMut.mutateAsync(data);
    }
    async function handleWorkPayment(data: WorkPaymentFormData) {
      await createWorkPaymentMut.mutateAsync(data);
    }
    return (
      <WorkForm
        initialTab={activeModal === "work_payment" ? "payment" : "session"}
        sessions={workSessions}
        onSubmitSession={handleWorkSession}
        onSubmitPayment={handleWorkPayment}
        onClose={closeModal}
      />
    );
  }

  /* ── Goal ────────────────────────────────────────────────── */
  if (activeModal === "goal") {
    async function handleGoal(data: GoalFormData) {
      await createGoalMut.mutateAsync({
        title: data.title,
        target_amount: data.targetAmount,
        saved_amount: data.savedAmount,
        monthly_contribution: data.monthlyContribution,
        due_date: data.dueDate || null,
        category: data.category as import("@/types").GoalCategory,
        tracking_type: "manual",
        start_date: new Date().toISOString().slice(0, 10),
        color: null,
      });
      closeModal();
    }
    return <GoalFormModal onSubmit={handleGoal} onClose={closeModal} />;
  }

  return null;
}
