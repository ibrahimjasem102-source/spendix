"use client";

import { useGlobalActions } from "@/contexts/GlobalActionsContext";
import { useGuest } from "@/contexts/GuestContext";
import TransactionForm from "@/components/transactions/TransactionForm";
import InvestmentForm from "@/components/investments/InvestmentForm";
import DebtForm from "@/components/debts/DebtForm";
import DebtPaymentFABModal from "@/components/modals/DebtPaymentFABModal";
import WorkPaymentForm from "@/components/work/WorkPaymentForm";
import WorkSessionForm from "@/components/work/WorkSessionForm";
import GoalFormModal, { type GoalFormData, type FinancialGoal } from "@/components/goals/GoalFormModal";
import {
  useCreateTransaction,
  useCreateInvestment,
  useCreateDebt,
  useCreateWorkSession,
  useCreateWorkPayment,
} from "@/lib/query/hooks";
import { emit } from "@/lib/events";
import type { TransactionFormData, InvestmentFormData, DebtFormData, WorkSessionFormData, WorkPaymentFormData } from "@/types";

const GOALS_STORAGE_KEY = "spendix_financial_goals";

export default function GlobalModals() {
  const { activeModal, closeModal } = useGlobalActions();
  const { isGuest } = useGuest();

  // All hooks must be called unconditionally
  const createTxMut          = useCreateTransaction(isGuest);
  const createInvMut         = useCreateInvestment();
  const createDebtMut        = useCreateDebt();
  const createWorkSessionMut = useCreateWorkSession();
  const createWorkPaymentMut = useCreateWorkPayment();

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
  if (activeModal === "debt") {
    async function handleDebt(data: DebtFormData) {
      await createDebtMut.mutateAsync(data);
    }
    return <DebtForm onSubmit={handleDebt} onClose={closeModal} />;
  }

  /* ── Debt Payment (2-step: select debt then pay) ─────────── */
  if (activeModal === "debt_payment") {
    return <DebtPaymentFABModal onClose={closeModal} />;
  }

  /* ── Work Session ────────────────────────────────────────── */
  if (activeModal === "work_session") {
    async function handleWorkSession(data: WorkSessionFormData) {
      await createWorkSessionMut.mutateAsync(data);
    }
    return <WorkSessionForm onSubmit={handleWorkSession} onClose={closeModal} />;
  }

  /* ── Work Payment ────────────────────────────────────────── */
  if (activeModal === "work_payment") {
    async function handleWorkPayment(data: WorkPaymentFormData) {
      await createWorkPaymentMut.mutateAsync(data);
    }
    return <WorkPaymentForm onSubmit={handleWorkPayment} onClose={closeModal} />;
  }

  /* ── Goal ────────────────────────────────────────────────── */
  if (activeModal === "goal") {
    function handleGoal(data: GoalFormData) {
      try {
        const raw = localStorage.getItem(GOALS_STORAGE_KEY);
        const existing: FinancialGoal[] = raw ? (JSON.parse(raw) as FinancialGoal[]) : [];
        const newGoal: FinancialGoal = {
          id: crypto.randomUUID(),
          ...data,
        };
        localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify([newGoal, ...existing]));
        emit("spendix:goal-added");
      } catch {}
      closeModal();
    }
    return <GoalFormModal onSubmit={handleGoal} onClose={closeModal} />;
  }

  return null;
}
