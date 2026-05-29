"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Banknote, Loader2 } from "lucide-react";
import { WorkPayment, WorkPaymentFormData, WorkSession } from "@/types";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { spring, tapTransition } from "@/lib/motion";

interface Props {
  initial?: WorkPayment;
  sessions?: WorkSession[];
  defaultSessionId?: string;
  onSubmit: (data: WorkPaymentFormData) => Promise<void>;
  onClose: () => void;
}

const today = new Date().toISOString().split("T")[0];
const RING = "#34d399"; // emerald-400

export default function WorkPaymentForm({ initial, sessions = [], defaultSessionId, onSubmit, onClose }: Props) {
  const { t } = useTranslation();
  const { symbol, format } = useCurrency();
  const defaultSession = sessions.find((s) => s.id === defaultSessionId);

  const [form, setForm] = useState<WorkPaymentFormData>({
    employer_or_client: initial?.employer_or_client ?? defaultSession?.employer_or_client ?? "",
    amount:             initial?.amount             ?? defaultSession?.expected_amount    ?? 0,
    payment_date:       initial?.payment_date       ?? today,
    notes:              initial?.notes              ?? null,
    work_session_id:    initial?.work_session_id    ?? defaultSessionId ?? null,
  });
  const [rawAmount, setRawAmount] = useState(
    initial?.amount ?? defaultSession?.expected_amount
      ? String(initial?.amount ?? defaultSession?.expected_amount ?? "")
      : ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  function set<K extends keyof WorkPaymentFormData>(k: K, v: WorkPaymentFormData[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function handleSessionChange(sessionId: string) {
    const session = sessions.find((s) => s.id === sessionId);
    if (session) {
      const amt = session.expected_amount ?? 0;
      setRawAmount(amt ? String(amt) : "");
      setForm((p) => ({
        ...p,
        work_session_id: sessionId,
        employer_or_client: session.employer_or_client,
        amount: amt,
      }));
    } else {
      set("work_session_id", sessionId || null);
    }
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (form.amount <= 0) { setError(t("transactions.amount_positive")); return; }
    setLoading(true); setError("");
    try { await onSubmit(form); onClose(); }
    catch (err) { setError(err instanceof Error ? err.message : t("common.unknown_error")); setLoading(false); }
  }

  const unpaidSessions = sessions.filter((s) => s.status !== "paid");

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: "rgba(19,26,34,0.68)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>

      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }} transition={spring}
        className="w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[1.75rem] overflow-hidden flex flex-col"
        style={{ backgroundColor: "hsl(var(--bg-card))", border: "1px solid hsl(var(--border))", maxHeight: "92dvh" }}>

        {/* Header */}
        <div className="shrink-0 relative px-5 pt-5 pb-4" style={{ background: `${RING}12` }}>
          <div className="w-10 h-1 rounded-full bg-white/10 mx-auto mb-4 sm:hidden" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-400/10">
                <Banknote className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold t1">{t("work.add_payment")}</h2>
                <p className="text-xs t3">{t("work.employer")}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-xl t3 hover:t1 hover:bg-white/5 transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto min-h-0 flex flex-col">
          <div className="px-5 py-4 space-y-5 flex-1">

            {/* Session selector */}
            {unpaidSessions.length > 0 && (
              <div>
                <label className="block text-xs font-medium t3 uppercase tracking-wide mb-2">
                  {t("work.sessions")}
                  <span className="ms-1 normal-case font-normal opacity-60">({t("transactions.notes_optional")})</span>
                </label>
                <select value={form.work_session_id ?? ""}
                  onChange={(e) => handleSessionChange(e.target.value)}
                  className="field" style={{ backgroundColor: "hsl(var(--bg-input))" }}>
                  <option value="">— {t("work.sessions")} —</option>
                  {unpaidSessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} · {s.employer_or_client} ({format(s.expected_amount)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Employer */}
            <div>
              <label className="block text-xs font-medium t3 uppercase tracking-wide mb-2">
                {t("work.employer")}
              </label>
              <input required value={form.employer_or_client}
                onChange={(e) => set("employer_or_client", e.target.value)}
                className="field" placeholder={t("work.employer_placeholder") || t("work.employer")} />
            </div>

            {/* Amount — large */}
            <div>
              <label className="block text-xs font-medium t3 uppercase tracking-wide mb-2">
                {t("transactions.amount")}
              </label>
              <div className="relative">
                <span className="absolute start-4 top-1/2 -translate-y-1/2 text-xl font-bold t3">{symbol}</span>
                <input
                  type="number" inputMode="decimal" min="0.01" step="0.01"
                  value={rawAmount}
                  onChange={(e) => { setRawAmount(e.target.value); set("amount", parseFloat(e.target.value) || 0); }}
                  placeholder="0.00"
                  className="w-full ps-10 pe-4 py-4 text-3xl font-bold number-display rounded-2xl bg-[hsl(var(--bg-input))] border focus:outline-none transition-all"
                  style={{
                    color: rawAmount ? RING : undefined,
                    borderColor: rawAmount ? `${RING}40` : "hsl(var(--border))",
                  }} />
              </div>
            </div>

            {/* Date + notes */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium t3 uppercase tracking-wide mb-2">
                  {t("transactions.date")}
                </label>
                <input type="date" required value={form.payment_date}
                  onChange={(e) => set("payment_date", e.target.value)} className="field" />
              </div>
              <div>
                <label className="block text-xs font-medium t3 uppercase tracking-wide mb-2">
                  {t("transactions.notes")}
                  <span className="ms-1 normal-case font-normal opacity-60">({t("transactions.notes_optional")})</span>
                </label>
                <input value={form.notes ?? ""}
                  onChange={(e) => set("notes", e.target.value || null)}
                  className="field" placeholder={t("transactions.notes_placeholder")} />
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="text-xs text-rose-400 bg-rose-400/10 border border-rose-400/20 px-3 py-2 rounded-xl">
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Submit */}
          <div className="shrink-0 px-5 pt-2" style={{ paddingBottom: "max(20px, calc(env(safe-area-inset-bottom, 0px) + 8px))" }}>
            <motion.button type="submit" disabled={loading || form.amount <= 0}
              whileTap={{ scale: 0.97 }} transition={tapTransition}
              className="w-full py-3.5 rounded-2xl text-sm font-bold text-[#0B0F14] transition-all disabled:opacity-40"
              style={{ background: `linear-gradient(135deg, ${RING}, ${RING}bb)` }}>
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.span key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />{t("common.saving")}
                  </motion.span>
                ) : (
                  <motion.span key="i" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center justify-center gap-2">
                    <Banknote className="w-4 h-4" />
                    {t("work.add_payment")}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
