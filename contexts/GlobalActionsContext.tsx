"use client";

import { createContext, useContext, useState, useCallback } from "react";

export type ModalType =
  | "transaction"      // manual — income/expense toggle inside form
  | "income"           // transaction pre-set to income
  | "expense"          // transaction pre-set to expense
  | "investment"
  | "debt"             // generic debt form
  | "debt_receivable"  // debt pre-set to receivable (money owed to me)
  | "debt_payable"     // debt pre-set to payable (money I owe)
  | "debt_payment"     // requires debt selector step
  | "work_payment"     // work payment flow
  | "work_session"     // work session entry
  | "goal"             // new financial goal
  | null;

interface GlobalActionsContextType {
  activeModal: ModalType;
  openModal: (type: ModalType) => void;
  closeModal: () => void;
  fabOpen: boolean;
  toggleFAB: () => void;
  closeFAB: () => void;
}

const GlobalActionsContext = createContext<GlobalActionsContextType>({
  activeModal: null,
  openModal: () => {},
  closeModal: () => {},
  fabOpen: false,
  toggleFAB: () => {},
  closeFAB: () => {},
});

export function GlobalActionsProvider({ children }: { children: React.ReactNode }) {
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [fabOpen, setFabOpen]         = useState(false);

  const openModal = useCallback((type: ModalType) => {
    setActiveModal(type);
    setFabOpen(false);
  }, []);

  const closeModal = useCallback(() => setActiveModal(null), []);
  const toggleFAB  = useCallback(() => setFabOpen((p) => !p), []);
  const closeFAB   = useCallback(() => setFabOpen(false), []);

  return (
    <GlobalActionsContext.Provider value={{ activeModal, openModal, closeModal, fabOpen, toggleFAB, closeFAB }}>
      {children}
    </GlobalActionsContext.Provider>
  );
}

export function useGlobalActions() {
  return useContext(GlobalActionsContext);
}
