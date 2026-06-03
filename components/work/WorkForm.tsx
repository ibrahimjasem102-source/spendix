"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Briefcase, Banknote, Check, Loader2,
  CalendarDays, FileText, Building2, RefreshCcw, AlarmClock,
} from "lucide-react";
import type { WorkSessionFormData, WorkPaymentFormData, WorkRecurrence, WorkSession, WorkPayment } from "@/types";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { spring, tapTransition } from "@/lib/motion";
import SheetDragHandle from "@/components/ui/SheetDragHandle";

type WorkTab = "session" | "payment";

interface Props {
  initialTab?: WorkTab;
  initialSession?: WorkSession;
  initialPayment?: WorkPayment;
  sessions?: WorkSession[];
  onSubmitSession: (data: WorkSessionFormData) => Promise<void>;
  onSubmitPayment: (data: WorkPaymentFormData) => Promise<void>;
  onClose: () => void;
}

const today = new Date().toISOString().split("T")[0];
const RECURRENCES: WorkRecurrence[] = ["none", "daily", "weekly", "monthly"];
const SESSION_COLOR = "#22d3ee";
const PAYMENT_COLOR = "#34d399";

export default function WorkForm({
  initialTab = "session",
  initialSession,
  initialPayment,
  sessions = [],
  onSubmitSession,
  onSubmitPayment,
  onClose,
}: Props) {
  const { t, dir } = useTranslation();
  const { symbol, format } = useCurrency();
  const rtl = dir === "rtl";
  const [tab, setTab] = useState<WorkTab>(initialTab);

  const isEditSession = !!initialSession;
  const isEditPayment = !!initialPayment;

  // ── Session state ──────────────────────────────────────────────
  const [sf, setSf] = useState<WorkSessionFormData>(() => initialSession ? {
    title: initialSession.title,
    employer_or_client: initialSession.employer_or_client,
    hourly_rate: Number(initialSession.hourly_rate),
    hours_worked: Number(initialSession.hours_worked),
    work_date: initialSession.work_date,
    due_date: initialSession.due_date ?? null,
    notes: initialSession.notes ?? null,
    recurrence: initialSession.recurrence,
    recurrence_end_date: initialSession.recurrence_end_date ?? null,
  } : {
    title: "", employer_or_client: "", hourly_rate: 0, hours_worked: 0,
    work_date: today, due_date: null, notes: null, recurrence: "none", recurrence_end_date: null,
  });
  const [rawRate,  setRawRate]  = useState(() => initialSession?.hourly_rate  ? String(initialSession.hourly_rate)  : "");
  const [rawHours, setRawHours] = useState(() => initialSession?.hours_worked ? String(initialSession.hours_worked) : "");
  const [sLoading, setSLoading] = useState(false);
  const [sError,   setSError]   = useState("");

  // ── Payment state ──────────────────────────────────────────────
  const [pf, setPf] = useState<WorkPaymentFormData>(() => initialPayment ? {
    employer_or_client: initialPayment.employer_or_client,
    amount: Number(initialPayment.amount),
    payment_date: initialPayment.payment_date,
    notes: initialPayment.notes ?? null,
    work_session_id: initialPayment.work_session_id ?? null,
  } : {
    employer_or_client: "", amount: 0, payment_date: today,
    notes: null, work_session_id: null,
  });
  const [rawAmount, setRawAmount] = useState(() => initialPayment?.amount ? String(initialPayment.amount) : "");
  const [pLoading, setPLoading]   = useState(false);
  const [pError,   setPError]     = useState("");

  function setS<K extends keyof WorkSessionFormData>(k: K, v: WorkSessionFormData[K]) {
    setSf((p) => ({ ...p, [k]: v }));
  }
  function setP<K extends keyof WorkPaymentFormData>(k: K, v: WorkPaymentFormData[K]) {
    setPf((p) => ({ ...p, [k]: v }));
  }

  const expected = sf.hourly_rate * sf.hours_worked;

  function handleSessionChange(sessionId: string) {
    const s = sessions.find((x) => x.id === sessionId);
    if (s) {
      const amt = s.expected_amount ?? 0;
      setRawAmount(amt ? String(amt) : "");
      setPf((p) => ({ ...p, work_session_id: sessionId, employer_or_client: s.employer_or_client, amount: amt }));
    } else {
      setP("work_session_id", sessionId || null);
    }
  }

  async function submitSession(e: React.FormEvent) {
    e.preventDefault();
    if (sf.hours_worked <= 0) { setSError(t("work.hours_positive")); return; }
    if (!sf.title.trim())    { setSError(t("transactions.title_required") || "Title required"); return; }
    setSLoading(true); setSError("");
    try { await onSubmitSession(sf); onClose(); }
    catch (err) { setSError(err instanceof Error ? err.message : t("common.unknown_error")); setSLoading(false); }
  }

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (pf.amount <= 0) { setPError(t("transactions.amount_positive")); return; }
    setPLoading(true); setPError("");
    try { await onSubmitPayment(pf); onClose(); }
    catch (err) { setPError(err instanceof Error ? err.message : t("common.unknown_error")); setPLoading(false); }
  }

  const accent  = tab === "session" ? SESSION_COLOR : PAYMENT_COLOR;
  const unpaid  = sessions.filter((s) => s.status !== "paid");

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: "rgba(19,26,34,0.68)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={spring}
        className="w-full sm:max-w-lg rounded-t-[1.75rem] sm:rounded-[1.5rem] overflow-hidden flex flex-col"
        style={{ backgroundColor: "hsl(var(--bg-card))", border: "1px solid hsl(var(--border))", maxHeight: "92dvh" }}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <div
          className="shrink-0 px-5 pt-4 pb-4 border-b border-[hsl(var(--border))] transition-colors duration-300"
          style={{ background: `${accent}10` }}
        >
          <div className="mb-2 sm:hidden">
            <SheetDragHandle onClose={onClose} />
          </div>

          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold t3 uppercase tracking-widest">{t("work.title")}</p>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center t3 hover:t1 hover:bg-white/8 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tab toggle */}
          <div className="flex gap-1 bg-black/12 rounded-2xl p-1">
            {(["session", "payment"] as const).map((item) => {
              const isActive = tab === item;
              const col = item === "session" ? SESSION_COLOR : PAYMENT_COLOR;
              return (
                <motion.button
                  key={item} type="button"
                  onClick={() => setTab(item)}
                  whileTap={{ scale: 0.97 }} transition={tapTransition}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all"
                  style={
                    isActive
                      ? { backgroundColor: `${col}18`, color: col, boxShadow: `0 0 0 1.5px ${col}30` }
                      : { color: "hsl(var(--text-3))" }
                  }
                >
                  {item === "session" ? <Briefcase className="w-4 h-4" /> : <Banknote className="w-4 h-4" />}
                  {t(item === "session" ? "work.add_session" : "work.add_payment")}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* ── Form body ──────────────────────────────────────── */}
        <AnimatePresence mode="wait" initial={false}>
          {tab === "session" ? (

            <motion.form
              key="session"
              initial={{ opacity: 0, x: rtl ? -18 : 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: rtl ? 18 : -18 }}
              transition={{ type: "tween", duration: 0.16 }}
              onSubmit={submitSession}
              className="flex-1 overflow-y-auto min-h-0 flex flex-col"
            >
              <div className="px-5 py-5 space-y-5 flex-1">

                {/* ── 1. Rate × Hours (amount first) ─────────── */}
                <section
                  className="rounded-2xl border p-4"
                  style={{ borderColor: `${SESSION_COLOR}30`, backgroundColor: `${SESSION_COLOR}08` }}
                >
                  <label className="mb-3 block text-[10px] font-semibold uppercase tracking-wide t3">
                    {t("work.hourly_rate")} × {t("work.hours_worked")}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold t3 uppercase tracking-wide">{t("work.hourly_rate")}</p>
                      <div className="relative">
                        <span className="absolute start-3 top-1/2 -translate-y-1/2 text-base font-bold t3">{symbol}</span>
                        <input
                          type="number" inputMode="decimal" min="0" step="0.01"
                          value={rawRate}
                          onChange={(e) => { setRawRate(e.target.value); setS("hourly_rate", parseFloat(e.target.value) || 0); }}
                          placeholder="0.00"
                          className="w-full ps-7 pe-3 py-3 text-xl font-bold number-display rounded-2xl bg-[hsl(var(--bg-card))] border focus:outline-none transition-all"
                          style={{ color: rawRate ? SESSION_COLOR : undefined, borderColor: rawRate ? `${SESSION_COLOR}40` : "hsl(var(--border))" }}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold t3 uppercase tracking-wide">{t("work.hours_worked")}</p>
                      <input
                        type="number" inputMode="decimal" min="0.1" step="0.1"
                        value={rawHours}
                        onChange={(e) => { setRawHours(e.target.value); setS("hours_worked", parseFloat(e.target.value) || 0); }}
                        placeholder="0"
                        className="w-full px-3 py-3 text-xl font-bold number-display rounded-2xl bg-[hsl(var(--bg-card))] border focus:outline-none transition-all"
                        style={{ color: rawHours ? SESSION_COLOR : undefined, borderColor: rawHours ? `${SESSION_COLOR}40` : "hsl(var(--border))" }}
                      />
                    </div>
                  </div>

                  <AnimatePresence>
                    {expected > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="flex items-center justify-between mt-3 px-4 py-3 rounded-2xl"
                        style={{ backgroundColor: `${SESSION_COLOR}15`, border: `1px solid ${SESSION_COLOR}30` }}
                      >
                        <span className="text-xs t2">{t("work.expected_amount")}</span>
                        <span className="text-base font-black number-display" style={{ color: SESSION_COLOR }}>
                          {symbol}{expected.toFixed(2)}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>

                {/* ── 2. Title + Employer ────────────────────── */}
                <section className="space-y-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--bg-input))]/50 p-4">
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide t3">
                      <Briefcase className="w-3.5 h-3.5" />{t("work.session_title")}
                    </label>
                    <input
                      required value={sf.title}
                      onChange={(e) => setS("title", e.target.value)}
                      className="field text-sm"
                      placeholder={t("work.session_title_placeholder") || "e.g. Web design, Programming…"}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide t3">
                      <Building2 className="w-3.5 h-3.5" />{t("work.employer")}
                    </label>
                    <input
                      required value={sf.employer_or_client}
                      onChange={(e) => setS("employer_or_client", e.target.value)}
                      className="field text-sm"
                      placeholder={t("work.employer_placeholder") || "Company / Client name"}
                    />
                  </div>
                </section>

                {/* ── 3. Schedule ────────────────────────────── */}
                <section className="space-y-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--bg-input))]/50 p-4">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 t3" />
                    <label className="text-[10px] font-semibold uppercase tracking-wide t3">{t("work.work_date")}</label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input type="date" required value={sf.work_date}
                      onChange={(e) => setS("work_date", e.target.value)} className="field text-sm" />
                    <div className="relative">
                      <RefreshCcw className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 t3 pointer-events-none" />
                      <select
                        value={sf.recurrence}
                        onChange={(e) => setS("recurrence", e.target.value as WorkRecurrence)}
                        className="field text-sm ps-8"
                        style={{ backgroundColor: "hsl(var(--bg-input))" }}
                      >
                        {RECURRENCES.map((r) => (
                          <option key={r} value={r}>{t(`work.recurrence_${r}`)}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Due date */}
                  <div>
                    <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide t2 mb-1.5">
                      <AlarmClock className="w-3.5 h-3.5 t3" />
                      {t("work.due_date") || "Payment Due Date"}
                      <span className="ms-1 font-normal normal-case t3">({t("transactions.notes_optional")})</span>
                    </label>
                    <input type="date" value={sf.due_date ?? ""}
                      onChange={(e) => setS("due_date", e.target.value || null)}
                      className="field text-sm" />
                  </div>

                  <AnimatePresence>
                    {sf.recurrence !== "none" && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                        <label className="text-[10px] font-semibold t3 uppercase tracking-wide mb-1.5 block">
                          {t("work.recurrence_end")}
                          <span className="ms-1 normal-case font-normal opacity-60">({t("transactions.notes_optional")})</span>
                        </label>
                        <input type="date" value={sf.recurrence_end_date ?? ""}
                          onChange={(e) => setS("recurrence_end_date", e.target.value || null)}
                          className="field text-sm" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>

                {/* Notes */}
                <div>
                  <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide t2 mb-2">
                    <FileText className="w-4 h-4 t3" />
                    {t("transactions.notes")}
                    <span className="ms-1 font-normal normal-case t3">({t("transactions.notes_optional")})</span>
                  </label>
                  <input value={sf.notes ?? ""}
                    onChange={(e) => setS("notes", e.target.value || null)}
                    className="field text-sm" placeholder={t("transactions.notes_placeholder")} />
                </div>

                <AnimatePresence>
                  {sError && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="text-xs text-rose-400 bg-rose-400/10 border border-rose-400/20 px-3 py-2 rounded-xl">
                      {sError}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <div className="shrink-0 border-t border-[hsl(var(--border))] px-5 pt-3"
                style={{ paddingBottom: "max(20px, calc(env(safe-area-inset-bottom,0px) + 8px))" }}>
                <motion.button
                  type="submit" disabled={sLoading || sf.hours_worked <= 0}
                  whileTap={{ scale: 0.97 }} transition={tapTransition}
                  className="w-full py-3.5 rounded-2xl text-sm font-bold text-[#0B0F14] transition-all disabled:opacity-40"
                  style={{ background: `linear-gradient(135deg, ${SESSION_COLOR}, ${SESSION_COLOR}bb)` }}
                >
                  <AnimatePresence mode="wait">
                    {sLoading ? (
                      <motion.span key="load" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t("common.saving")}
                      </motion.span>
                    ) : (
                      <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex items-center justify-center gap-2">
                        <Briefcase className="w-4 h-4" />
                        {isEditSession ? t("common.save") : t("work.add_session")}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              </div>
            </motion.form>

          ) : (

            <motion.form
              key="payment"
              initial={{ opacity: 0, x: rtl ? 18 : -18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: rtl ? -18 : 18 }}
              transition={{ type: "tween", duration: 0.16 }}
              onSubmit={submitPayment}
              className="flex-1 overflow-y-auto min-h-0 flex flex-col"
            >
              <div className="px-5 py-4 space-y-4 flex-1">

                {/* Amount */}
                <section
                  className="rounded-2xl border p-4"
                  style={{ borderColor: `${PAYMENT_COLOR}30`, backgroundColor: `${PAYMENT_COLOR}08` }}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <label className="text-xs font-semibold uppercase tracking-wide t2">{t("transactions.amount")}</label>
                    {rawAmount && (
                      <button type="button" onClick={() => { setRawAmount(""); setP("amount", 0); }}
                        className="rounded-lg p-1.5 t3 transition-colors hover:bg-white/5 hover:t1">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute start-4 top-1/2 -translate-y-1/2 text-lg font-bold t3">{symbol}</span>
                    <input
                      type="number" inputMode="decimal" min="0.01" step="0.01"
                      value={rawAmount}
                      onChange={(e) => { setRawAmount(e.target.value); setP("amount", parseFloat(e.target.value) || 0); }}
                      placeholder="0.00"
                      className="w-full ps-12 pe-4 py-4 text-4xl font-black number-display rounded-2xl bg-[hsl(var(--bg-card))] border focus:outline-none transition-all"
                      style={{ color: rawAmount ? PAYMENT_COLOR : undefined, borderColor: rawAmount ? `${PAYMENT_COLOR}40` : "hsl(var(--border))" }}
                    />
                  </div>
                </section>

                {/* Details */}
                <section className="space-y-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--bg-input))]/50 p-4">
                  {unpaid.length > 0 && (
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide t2 mb-2 block">
                        {t("work.sessions")}
                        <span className="ms-1 font-normal normal-case t3">({t("transactions.notes_optional")})</span>
                      </label>
                      <select
                        value={pf.work_session_id ?? ""}
                        onChange={(e) => handleSessionChange(e.target.value)}
                        className="field text-sm"
                        style={{ backgroundColor: "hsl(var(--bg-input))" }}
                      >
                        <option value="">— {t("work.sessions")} —</option>
                        {unpaid.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.title} · {s.employer_or_client} ({format(s.expected_amount)})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide t2 mb-2">
                      <Building2 className="w-4 h-4 t3" />
                      {t("work.employer")}
                    </label>
                    <input
                      required value={pf.employer_or_client}
                      onChange={(e) => setP("employer_or_client", e.target.value)}
                      className="field text-sm"
                      placeholder={t("work.employer_placeholder") || "Company / Client name"}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide t2 mb-2">
                        <CalendarDays className="w-4 h-4 t3" />
                        {t("transactions.date")}
                      </label>
                      <input type="date" required value={pf.payment_date}
                        onChange={(e) => setP("payment_date", e.target.value)} className="field text-sm" />
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide t2 mb-2">
                        <FileText className="w-4 h-4 t3" />
                        {t("transactions.notes")}
                        <span className="font-normal normal-case t3">({t("transactions.notes_optional")})</span>
                      </label>
                      <input value={pf.notes ?? ""}
                        onChange={(e) => setP("notes", e.target.value || null)}
                        className="field text-sm" placeholder={t("transactions.notes_placeholder")} />
                    </div>
                  </div>
                </section>

                <AnimatePresence>
                  {pError && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="text-xs text-rose-400 bg-rose-400/10 border border-rose-400/20 px-3 py-2 rounded-xl">
                      {pError}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <div className="shrink-0 border-t border-[hsl(var(--border))] px-5 pt-3"
                style={{ paddingBottom: "max(20px, calc(env(safe-area-inset-bottom,0px) + 8px))" }}>
                <motion.button
                  type="submit" disabled={pLoading || pf.amount <= 0}
                  whileTap={{ scale: 0.97 }} transition={tapTransition}
                  className="w-full py-3.5 rounded-2xl text-sm font-bold text-[#0B0F14] transition-all disabled:opacity-40"
                  style={{ background: `linear-gradient(135deg, ${PAYMENT_COLOR}, ${PAYMENT_COLOR}bb)` }}
                >
                  <AnimatePresence mode="wait">
                    {pLoading ? (
                      <motion.span key="load" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t("common.saving")}
                      </motion.span>
                    ) : (
                      <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex items-center justify-center gap-2">
                        <Banknote className="w-4 h-4" />
                        {isEditPayment ? t("common.save") : t("work.add_payment")}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              </div>
            </motion.form>

          )}
        </AnimatePresence>
      </motion.div>
    </div>,
    document.body
  );
}
