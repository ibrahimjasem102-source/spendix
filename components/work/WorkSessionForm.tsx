"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Briefcase, Check, Loader2, RefreshCw } from "lucide-react";
import { WorkSession, WorkSessionFormData, WorkRecurrence } from "@/types";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { spring, tapTransition } from "@/lib/motion";

interface Props {
  initial?: WorkSession;
  onSubmit: (data: WorkSessionFormData) => Promise<void>;
  onClose: () => void;
}

const today = new Date().toISOString().split("T")[0];
const RECURRENCES: WorkRecurrence[] = ["none", "daily", "weekly", "monthly"];

const RING = "#22d3ee"; // cyan-400

export default function WorkSessionForm({ initial, onSubmit, onClose }: Props) {
  const { t } = useTranslation();
  const { symbol } = useCurrency();
  const isEdit = !!initial;

  const [form, setForm] = useState<WorkSessionFormData>({
    title:               initial?.title               ?? "",
    employer_or_client:  initial?.employer_or_client  ?? "",
    hourly_rate:         initial?.hourly_rate         ?? 0,
    hours_worked:        initial?.hours_worked        ?? 0,
    work_date:           initial?.work_date           ?? today,
    notes:               initial?.notes               ?? null,
    recurrence:          initial?.recurrence          ?? "none",
    recurrence_end_date: initial?.recurrence_end_date ?? null,
    paid_immediately:    false,
  });
  const [rawRate,  setRawRate]  = useState(initial?.hourly_rate  ? String(initial.hourly_rate)  : "");
  const [rawHours, setRawHours] = useState(initial?.hours_worked ? String(initial.hours_worked) : "");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  function set<K extends keyof WorkSessionFormData>(k: K, v: WorkSessionFormData[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  const expected = form.hourly_rate * form.hours_worked;

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (form.hours_worked <= 0) { setError(t("work.hours_positive") || "Hours must be greater than zero"); return; }
    if (!form.title.trim())     { setError(t("work.session_title") + " " + t("transactions.title_required")); return; }
    setLoading(true); setError("");
    try { await onSubmit(form); onClose(); }
    catch (err) { setError(err instanceof Error ? err.message : t("common.unknown_error")); setLoading(false); }
  }

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
              <div className="p-2.5 rounded-2xl bg-cyan-400/10">
                <Briefcase className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold t1">
                  {isEdit ? t("work.sessions") : t("work.add_session")}
                </h2>
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

            {/* Title */}
            <div>
              <label className="block text-xs font-medium t3 uppercase tracking-wide mb-2">
                {t("work.session_title")}
              </label>
              <input required value={form.title}
                onChange={(e) => set("title", e.target.value)}
                className="field" placeholder={t("work.session_title_placeholder") || "e.g. Web design, Programming..."} />
            </div>

            {/* Employer */}
            <div>
              <label className="block text-xs font-medium t3 uppercase tracking-wide mb-2">
                {t("work.employer")}
              </label>
              <input required value={form.employer_or_client}
                onChange={(e) => set("employer_or_client", e.target.value)}
                className="field" placeholder={t("work.employer_placeholder") || "e.g. Company X, Ahmed..."} />
            </div>

            {/* Rate × Hours — side by side large inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium t3 uppercase tracking-wide mb-2">
                  {t("work.hourly_rate")}
                </label>
                <div className="relative">
                  <span className="absolute start-3 top-1/2 -translate-y-1/2 text-base font-bold t3">{symbol}</span>
                  <input type="number" inputMode="decimal" min="0" step="0.01"
                    value={rawRate}
                    onChange={(e) => { setRawRate(e.target.value); set("hourly_rate", parseFloat(e.target.value) || 0); }}
                    placeholder="0.00"
                    className="w-full ps-7 pe-3 py-3 text-xl font-bold number-display rounded-2xl bg-[hsl(var(--bg-input))] border focus:outline-none transition-all"
                    style={{
                      color: rawRate ? RING : undefined,
                      borderColor: rawRate ? `${RING}40` : "hsl(var(--border))",
                    }} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium t3 uppercase tracking-wide mb-2">
                  {t("work.hours_worked")}
                </label>
                <input type="number" inputMode="decimal" min="0.1" step="0.1"
                  value={rawHours}
                  onChange={(e) => { setRawHours(e.target.value); set("hours_worked", parseFloat(e.target.value) || 0); }}
                  placeholder="0"
                  className="w-full px-3 py-3 text-xl font-bold number-display rounded-2xl bg-[hsl(var(--bg-input))] border focus:outline-none transition-all"
                  style={{
                    color: rawHours ? RING : undefined,
                    borderColor: rawHours ? `${RING}40` : "hsl(var(--border))",
                  }} />
              </div>
            </div>

            {/* Expected amount preview */}
            <AnimatePresence>
              {expected > 0 && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="flex items-center justify-between px-4 py-3 rounded-2xl border bg-cyan-400/8 border-cyan-400/20">
                  <span className="text-xs t2">{t("work.expected_amount")}</span>
                  <span className="text-sm font-bold number-display text-cyan-400">
                    {symbol}{expected.toFixed(2)}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Date + recurrence */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium t3 uppercase tracking-wide mb-2">
                  {t("work.work_date")}
                </label>
                <input type="date" required value={form.work_date}
                  onChange={(e) => set("work_date", e.target.value)} className="field" />
              </div>
              <div>
                <label className="block text-xs font-medium t3 uppercase tracking-wide mb-2">
                  {t("work.recurrence")}
                </label>
                <select value={form.recurrence}
                  onChange={(e) => set("recurrence", e.target.value as WorkRecurrence)}
                  className="field" style={{ backgroundColor: "hsl(var(--bg-input))" }}>
                  {RECURRENCES.map((r) => (
                    <option key={r} value={r}>{t(`work.recurrence_${r}`)}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Recurrence end date */}
            <AnimatePresence>
              {form.recurrence !== "none" && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                  <label className="block text-xs font-medium t3 uppercase tracking-wide mb-2">
                    {t("work.recurrence_end")}
                    <span className="ms-1 normal-case font-normal opacity-60">({t("transactions.notes_optional")})</span>
                  </label>
                  <input type="date" value={form.recurrence_end_date ?? ""}
                    onChange={(e) => set("recurrence_end_date", e.target.value || null)}
                    className="field" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium t3 uppercase tracking-wide mb-2">
                {t("transactions.notes")}
                <span className="ms-1 normal-case font-normal opacity-60">({t("transactions.notes_optional")})</span>
              </label>
              <input value={form.notes ?? ""}
                onChange={(e) => set("notes", e.target.value || null)}
                className="field" placeholder={t("transactions.notes_placeholder")} />
            </div>

            {/* Paid immediately toggle */}
            {!isEdit && (
              <motion.button type="button"
                onClick={() => set("paid_immediately", !form.paid_immediately)}
                whileTap={{ scale: 0.98 }} transition={tapTransition}
                className={`flex items-center gap-3 w-full px-4 py-3 rounded-2xl border transition-all text-start ${
                  form.paid_immediately
                    ? "bg-emerald-400/10 border-emerald-400/30"
                    : "border-[hsl(var(--border))] bg-[hsl(var(--bg-input))]"
                }`}>
                <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${
                  form.paid_immediately ? "bg-emerald-400 border-emerald-400" : "border-[hsl(var(--border))]"
                }`}>
                  {form.paid_immediately && <Check className="w-3 h-3 text-[#0B0F17]" strokeWidth={3} />}
                </div>
                <div>
                  <p className="text-sm font-medium t1">{t("work.paid_immediately")}</p>
                  <p className="text-xs t3 mt-0.5">{t("work.paid_immediately_hint")}</p>
                </div>
              </motion.button>
            )}

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
            <motion.button type="submit" disabled={loading || form.hours_worked <= 0}
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
                    <Briefcase className="w-4 h-4" />
                    {isEdit ? t("common.save") : t("common.add")}
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
