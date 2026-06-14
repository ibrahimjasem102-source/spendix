"use client";

import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ArrowDownRight, ArrowUpRight,
  Target, TrendingUp, Landmark,
  User, Briefcase, PiggyBank,
} from "lucide-react";
import { useGlobalActions, type ModalType } from "@/contexts/GlobalActionsContext";
import { useTranslation } from "@/lib/i18n";
import { backdropVariants, ease, sheetTransition } from "@/lib/motion";
import SheetDragHandle from "@/components/ui/SheetDragHandle";

interface Action {
  icon:   React.ElementType;
  label:  string;
  color:  string;
  action: () => void;
}

interface Section {
  title:   string;
  actions: Action[];
}

export default function FinancialActionHub() {
  const { fabOpen, closeFAB, openModal } = useGlobalActions();
  const { t }                            = useTranslation();
  const router                           = useRouter();

  const go    = (path: string) => { closeFAB(); router.push(path); };
  const modal = (type: ModalType) => { closeFAB(); openModal(type); };

  const sections: Section[] = [
    {
      title: t("hub.section_transactions"),
      actions: [
        { icon: ArrowDownRight, label: t("transactions.expense"),  color: "#F43F5E", action: () => go("/transactions/new?type=expense") },
        { icon: ArrowUpRight,   label: t("transactions.income"),   color: "#10B981", action: () => go("/transactions/new?type=income")  },
      ],
    },
    {
      title: t("hub.section_assets"),
      actions: [
        { icon: TrendingUp, label: t("hub.action_investment"), color: "#8B5CF6", action: () => modal("investment")    },
        { icon: Target,     label: t("hub.action_goal"),       color: "#F59E0B", action: () => go("/goals/new")       },
        { icon: PiggyBank,  label: t("hub.action_budget"),     color: "#34D399", action: () => go("/budgets")         },
      ],
    },
    {
      title: t("hub.section_liabilities"),
      actions: [
        { icon: Landmark, label: t("hub.action_debt"), color: "#F43F5E", action: () => go("/debts/new") },
      ],
    },
    {
      title: t("hub.section_manage"),
      actions: [
        { icon: Briefcase, label: t("hub.action_work"),    color: "#F59E0B", action: () => modal("work_session") },
        { icon: User,      label: t("hub.action_contact"), color: "#06B6D4", action: () => go("/contacts")       },
      ],
    },
  ];

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {fabOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="hub-backdrop"
            variants={backdropVariants}
            initial="hidden" animate="visible" exit="exit"
            transition={ease}
            className="fixed inset-0 z-[100]"
            style={{
              backgroundColor: "rgba(11,15,20,0.82)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
            }}
            onClick={closeFAB}
          />

          {/* Sheet */}
          <motion.div
            key="hub-sheet"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={sheetTransition}
            className="fixed inset-x-0 bottom-0 z-[110] rounded-t-[1.75rem]"
            style={{
              backgroundColor: "hsl(var(--bg-card))",
              border: "1px solid hsl(var(--border))",
              paddingBottom: "max(24px, env(safe-area-inset-bottom, 0px))",
              maxHeight: "85dvh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-0 shrink-0">
              <SheetDragHandle onClose={closeFAB} />
            </div>

            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-3 shrink-0"
              style={{ borderBottom: "1px solid hsl(var(--border-2))" }}
            >
              <div>
                <p className="text-sm font-bold t1">{t("hub.title")}</p>
                <p className="text-[11px] t3 mt-0.5">{t("hub.subtitle")}</p>
              </div>
              <button
                onClick={closeFAB}
                className="w-8 h-8 rounded-xl flex items-center justify-center t3 hover:t1 transition-colors"
                style={{ backgroundColor: "hsl(var(--bg-input))" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable actions */}
            <div className="overflow-y-auto flex-1 px-4 py-4 space-y-5 overscroll-contain">
              {sections.map((section, si) => (
                <motion.div
                  key={section.title}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: si * 0.04, duration: 0.2, ease: "easeOut" }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] t3 mb-2.5 px-0.5">
                    {section.title}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {section.actions.map((a) => {
                      const Icon = a.icon;
                      return (
                        <motion.button
                          key={a.label}
                          type="button"
                          onClick={a.action}
                          whileTap={{ scale: 0.93 }}
                          transition={{ type: "tween", duration: 0.1 }}
                          className="flex flex-col items-center gap-2 py-3.5 px-2 rounded-xl transition-colors active:opacity-70"
                          style={{
                            backgroundColor: "hsl(var(--bg-card-2))",
                            border: "1px solid hsl(var(--border))",
                          }}
                        >
                          <div
                            className="w-10 h-10 rounded-[13px] flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${a.color}1A` }}
                          >
                            <Icon className="w-[18px] h-[18px]" style={{ color: a.color }} />
                          </div>
                          <span className="text-[11px] font-semibold t1 text-center leading-tight">
                            {a.label}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
