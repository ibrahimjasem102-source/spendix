"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Receipt, Plus, Pencil, Trash2, X, Check, AlertCircle,
  AlertTriangle, Calendar, RefreshCw, ChevronDown,
  Zap, Banknote, Building2, CreditCard, Wallet, PiggyBank,
  CheckCircle2, Clock,
} from "lucide-react";
import { useBills, useCreateBill, useUpdateBill, useDeleteBill, usePayBill, useAccounts } from "@/lib/query/hooks";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { spring, tapTransition } from "@/lib/motion";
import type { Bill, BillFormData, BillPayData, BillRecurrence, BillStatus, AccountType } from "@/types";

// ── Constants ────────────────────────────────────────────────

const BILL_PRESETS = [
  { name: "الكهرباء",  icon: "⚡", color: "#F59E0B" },
  { name: "الإنترنت",  icon: "🌐", color: "#3B82F6" },
  { name: "الإيجار",   icon: "🏠", color: "#8B5CF6" },
  { name: "التأمين",   icon: "🛡️", color: "#10B981" },
  { name: "الماء",     icon: "💧", color: "#06B6D4" },
  { name: "الغاز",     icon: "🔥", color: "#F97316" },
  { name: "الهاتف",    icon: "📱", color: "#6366F1" },
  { name: "السيارة",   icon: "🚗", color: "#EF4444" },
  { name: "الضرائب",   icon: "📊", color: "#64748B" },
  { name: "التعليم",   icon: "🎓", color: "#A855F7" },
];

const RECURRENCES: { value: BillRecurrence; labelKey: string }[] = [
  { value: "monthly",   labelKey: "bills.monthly"   },
  { value: "quarterly", labelKey: "bills.quarterly" },
  { value: "yearly",    labelKey: "bills.yearly"    },
];

const ACCOUNT_ICONS: Record<AccountType, React.ElementType> = {
  cash: Banknote, bank: Building2, credit_card: CreditCard, wallet: Wallet, savings: PiggyBank,
};
const ACCOUNT_COLORS: Record<AccountType, string> = {
  cash: "#10B981", bank: "#3B82F6", credit_card: "#8B5CF6", wallet: "#F59E0B", savings: "#06B6D4",
};

const COLORS = [
  "#F59E0B","#3B82F6","#8B5CF6","#10B981","#06B6D4",
  "#F97316","#EF4444","#6366F1","#A855F7","#64748B",
];

function statusColor(s: BillStatus): string {
  return s === "paid" ? "#10B981" : s === "overdue" ? "#EF4444" : "#F59E0B";
}

function dayLabel(days: number, t: (k: string) => string): string {
  if (days < 0) return `${Math.abs(days)} ${t("bills.days_overdue")}`;
  if (days === 0) return t("bills.due_today");
  if (days === 1) return t("bills.due_tomorrow");
  return `${t("bills.in")} ${days} ${t("bills.days")}`;
}

// ── Pay Modal ────────────────────────────────────────────────

interface PayModalProps {
  bill: Bill;
  onSubmit: (data: BillPayData) => Promise<void>;
  onClose: () => void;
}

function PayModal({ bill, onSubmit, onClose }: PayModalProps) {
  const { t } = useTranslation();
  const { symbol } = useCurrency();
  const { data: accounts = [] } = useAccounts();
  const today = new Date().toISOString().split("T")[0];

  const [amount, setAmount]   = useState(bill.amount ? String(bill.amount) : "");
  const [date, setDate]       = useState(today);
  const [accountId, setAccountId] = useState<string | null>(bill.account_id ?? null);
  const [notes, setNotes]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const accent = bill.color ?? "#10B981";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError(t("bills.amount_positive")); return; }
    setLoading(true); setError("");
    try {
      await onSubmit({ amount: amt, payment_date: date, account_id: accountId, notes: notes || undefined });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: "rgba(11,15,20,0.75)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
        transition={spring}
        className="w-full sm:max-w-sm rounded-t-[2rem] sm:rounded-[1.75rem] overflow-hidden"
        style={{ backgroundColor: "hsl(var(--bg-card))", border: "1px solid hsl(var(--border))" }}
      >
        <div className="px-5 pt-4 pb-3" style={{ background: `${accent}10` }}>
          <div className="w-10 h-1 rounded-full bg-white/12 mx-auto mb-3 sm:hidden" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">{bill.icon ?? "📋"}</span>
              <div>
                <p className="text-xs font-bold t3 uppercase tracking-widest">{t("bills.pay_bill")}</p>
                <p className="text-sm font-bold t1">{bill.name}</p>
              </div>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center t3 hover:t1 transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4">
          {/* Amount */}
          <div>
            <label className="block text-[10px] font-semibold t3 uppercase tracking-[0.12em] mb-2">
              {t("bills.actual_amount")}
            </label>
            <div className="relative">
              <span className="absolute start-3 top-1/2 -translate-y-1/2 text-sm t3">{symbol}</span>
              <input
                type="number" inputMode="decimal" min="0.01" step="0.01" required autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="field text-sm ps-8 font-bold"
                placeholder="0.00"
                style={{ color: accent }}
              />
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-[10px] font-semibold t3 uppercase tracking-[0.12em] mb-2">
              {t("bills.payment_date")}
            </label>
            <input type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="field text-sm"
            />
          </div>

          {/* Account */}
          {accounts.length > 0 && (
            <div>
              <label className="block text-[10px] font-semibold t3 uppercase tracking-[0.12em] mb-2">
                {t("bills.from_account")}
              </label>
              <div className="flex gap-2 flex-wrap">
                <button type="button" onClick={() => setAccountId(null)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${!accountId ? "t1 bg-[hsl(var(--bg-card-2))] border-[hsl(var(--text-3))] border-[1.5px]" : "t3 bg-[hsl(var(--bg-input))] border-[hsl(var(--border))]"}`}>
                  —
                </button>
                {accounts.map((acc) => {
                  const Icon = ACCOUNT_ICONS[acc.type] ?? Wallet;
                  const color = ACCOUNT_COLORS[acc.type] ?? "#3B82F6";
                  const selected = accountId === acc.id;
                  return (
                    <button key={acc.id} type="button" onClick={() => setAccountId(acc.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all"
                      style={selected ? { backgroundColor: `${color}14`, borderColor: `${color}45`, color } : { backgroundColor: "hsl(var(--bg-input))", borderColor: "hsl(var(--border))", color: "hsl(var(--text-2))" }}>
                      <Icon className="w-3 h-3" />{acc.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-[10px] font-semibold t3 uppercase tracking-[0.12em] mb-2">
              {t("bills.notes")} <span className="font-normal opacity-40">({t("bills.optional")})</span>
            </label>
            <input type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="field text-sm"
              placeholder={t("bills.notes_placeholder")}
            />
          </div>

          <AnimatePresence>
            {error && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-xs text-rose-400 bg-rose-400/10 border border-rose-400/20 px-3 py-2 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.button type="submit"
            disabled={loading || !amount}
            whileTap={{ scale: 0.97 }} transition={tapTransition}
            className="w-full py-4 rounded-2xl text-sm font-bold text-white disabled:opacity-40"
            style={{ background: `linear-gradient(135deg, ${accent}, ${accent}bb)`, boxShadow: `0 4px 20px ${accent}30` }}>
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.span key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t("common.saving")}
                </motion.span>
              ) : (
                <motion.span key="i" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" />{t("bills.confirm_payment")}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}

// ── Bill Form ────────────────────────────────────────────────

interface BillFormProps {
  initial?: Bill;
  onSubmit: (data: BillFormData) => Promise<void>;
  onClose: () => void;
}

function BillForm({ initial, onSubmit, onClose }: BillFormProps) {
  const { t } = useTranslation();
  const { data: accounts = [] } = useAccounts();
  const isEdit = !!initial;
  const defaultDue = new Date(Date.now() + 30 * 86_400_000).toISOString().split("T")[0];

  const [form, setForm] = useState<BillFormData>({
    name:               initial?.name               ?? "",
    amount:             initial?.amount             ?? null,
    currency:           initial?.currency           ?? "USD",
    due_date:           initial?.due_date           ?? defaultDue,
    category_id:        initial?.category_id        ?? null,
    account_id:         initial?.account_id         ?? null,
    is_recurring:       initial?.is_recurring       ?? false,
    recurrence:         initial?.recurrence         ?? "monthly",
    color:              initial?.color              ?? null,
    icon:               initial?.icon               ?? null,
    notes:              initial?.notes              ?? "",
    remind_days_before: initial?.remind_days_before ?? 3,
  });
  const [rawAmount, setRawAmount]   = useState(initial?.amount ? String(initial.amount) : "");
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  function set<K extends keyof BillFormData>(k: K, v: BillFormData[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function applyPreset(p: typeof BILL_PRESETS[0]) {
    setForm((prev) => ({ ...prev, name: p.name, icon: p.icon, color: p.color }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError(t("bills.name_required")); return; }
    if (!form.due_date) { setError(t("bills.due_date_required")); return; }
    setLoading(true); setError("");
    try {
      await onSubmit({ ...form, amount: form.amount ? Number(form.amount) : null });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
      setLoading(false);
    }
  }

  const accent = form.color ?? "#F59E0B";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: "rgba(11,15,20,0.75)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
        transition={spring}
        className="w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[1.75rem] overflow-hidden flex flex-col"
        style={{ backgroundColor: "hsl(var(--bg-card))", border: "1px solid hsl(var(--border))", maxHeight: "92dvh" }}
      >
        <div className="shrink-0 px-5 pt-4 pb-3" style={{ background: `${accent}10` }}>
          <div className="w-10 h-1 rounded-full bg-white/12 mx-auto mb-3 sm:hidden" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {form.icon && <span className="text-2xl">{form.icon}</span>}
              <p className="text-xs font-bold t3 uppercase tracking-widest">
                {isEdit ? t("bills.edit") : t("bills.new")}
              </p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center t3 hover:t1 transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-5 py-5 space-y-5">

            {/* Presets */}
            {!isEdit && (
              <div>
                <label className="block text-[10px] font-semibold t3 uppercase tracking-[0.12em] mb-2">
                  {t("bills.quick_pick")}
                </label>
                <div className="flex gap-2 flex-wrap">
                  {BILL_PRESETS.map((p) => (
                    <motion.button key={p.name} type="button"
                      onClick={() => applyPreset(p)}
                      whileTap={{ scale: 0.9 }} transition={tapTransition}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all"
                      style={form.name === p.name ? {
                        backgroundColor: `${p.color}18`, borderColor: `${p.color}40`, color: p.color,
                      } : {
                        backgroundColor: "hsl(var(--bg-input))", borderColor: "hsl(var(--border))", color: "hsl(var(--text-2))",
                      }}>
                      {p.icon} {p.name}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {/* Name */}
            <div>
              <label className="block text-[10px] font-semibold t3 uppercase tracking-[0.12em] mb-2">{t("bills.name")}</label>
              <input type="text" required
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className="field text-sm font-medium"
                placeholder={t("bills.name_placeholder")}
              />
            </div>

            {/* Amount (optional) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-semibold t3 uppercase tracking-[0.12em]">
                  {t("bills.amount")}
                </label>
                <span className="text-[9px] t3">{t("bills.amount_optional_hint")}</span>
              </div>
              <input type="number" inputMode="decimal" min="0" step="0.01"
                value={rawAmount}
                onChange={(e) => { setRawAmount(e.target.value); set("amount", parseFloat(e.target.value) || null); }}
                className="field text-sm"
                placeholder={t("bills.amount_variable")}
              />
            </div>

            {/* Due date */}
            <div>
              <label className="block text-[10px] font-semibold t3 uppercase tracking-[0.12em] mb-2">{t("bills.due_date")}</label>
              <input type="date"
                value={form.due_date}
                onChange={(e) => set("due_date", e.target.value)}
                className="field text-sm"
              />
            </div>

            {/* Color */}
            <div>
              <label className="block text-[10px] font-semibold t3 uppercase tracking-[0.12em] mb-2">{t("bills.color")}</label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => set("color", c)}
                    className="w-7 h-7 rounded-full transition-all relative"
                    style={{ backgroundColor: c, boxShadow: form.color === c ? `0 0 0 2px hsl(var(--bg-card)), 0 0 0 4px ${c}` : undefined }}>
                    {form.color === c && <Check className="w-3.5 h-3.5 text-white absolute inset-0 m-auto" strokeWidth={3} />}
                  </button>
                ))}
              </div>
            </div>

            {/* Account */}
            {accounts.length > 0 && (
              <div>
                <label className="block text-[10px] font-semibold t3 uppercase tracking-[0.12em] mb-2">{t("bills.default_account")}</label>
                <div className="flex gap-2 flex-wrap">
                  <button type="button" onClick={() => set("account_id", null)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${!form.account_id ? "t1 bg-[hsl(var(--bg-card-2))] border-[hsl(var(--text-3))] border-[1.5px]" : "t3 bg-[hsl(var(--bg-input))] border-[hsl(var(--border))]"}`}>
                    —
                  </button>
                  {accounts.map((acc) => {
                    const Icon = ACCOUNT_ICONS[acc.type] ?? Wallet;
                    const color = ACCOUNT_COLORS[acc.type] ?? "#3B82F6";
                    const sel = form.account_id === acc.id;
                    return (
                      <button key={acc.id} type="button" onClick={() => set("account_id", acc.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all"
                        style={sel ? { backgroundColor: `${color}14`, borderColor: `${color}45`, color } : { backgroundColor: "hsl(var(--bg-input))", borderColor: "hsl(var(--border))", color: "hsl(var(--text-2))" }}>
                        <Icon className="w-3 h-3" />{acc.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Advanced */}
            <button type="button" onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-2 text-xs t3 hover:t2 transition-all">
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
              {t("bills.advanced")}
            </button>

            <AnimatePresence>
              {showAdvanced && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                  className="overflow-hidden space-y-4"
                >
                  {/* Recurring toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium t1">{t("bills.recurring")}</p>
                      <p className="text-[10px] t3">{t("bills.recurring_hint")}</p>
                    </div>
                    <motion.button type="button"
                      onClick={() => set("is_recurring", !form.is_recurring)}
                      whileTap={{ scale: 0.92 }} transition={tapTransition}
                      className="w-11 h-6 rounded-full relative transition-all shrink-0"
                      style={{ backgroundColor: form.is_recurring ? accent : "hsl(var(--bg-input))" }}>
                      <motion.div
                        className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm"
                        animate={{ left: form.is_recurring ? "calc(100% - 22px)" : "2px" }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    </motion.button>
                  </div>

                  {form.is_recurring && (
                    <div>
                      <label className="block text-[10px] font-semibold t3 uppercase tracking-[0.12em] mb-2">{t("bills.recurrence")}</label>
                      <div className="flex gap-2">
                        {RECURRENCES.map((r) => (
                          <button key={r.value} type="button" onClick={() => set("recurrence", r.value)}
                            className="flex-1 py-2 rounded-xl text-xs font-semibold border transition-all"
                            style={form.recurrence === r.value ? {
                              backgroundColor: `${accent}14`, borderColor: `${accent}45`, color: accent,
                            } : {
                              backgroundColor: "hsl(var(--bg-input))", borderColor: "hsl(var(--border))", color: "hsl(var(--text-2))",
                            }}>
                            {t(r.labelKey)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Remind days */}
                  <div>
                    <label className="block text-[10px] font-semibold t3 uppercase tracking-[0.12em] mb-2">{t("bills.remind_days")}</label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 5, 7].map((d) => (
                        <button key={d} type="button" onClick={() => set("remind_days_before", d)}
                          className="flex-1 py-2 rounded-xl text-xs font-semibold border transition-all"
                          style={form.remind_days_before === d ? {
                            backgroundColor: `${accent}14`, borderColor: `${accent}45`, color: accent,
                          } : {
                            backgroundColor: "hsl(var(--bg-input))", borderColor: "hsl(var(--border))", color: "hsl(var(--text-2))",
                          }}>
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-[10px] font-semibold t3 uppercase tracking-[0.12em] mb-2">{t("bills.notes")}</label>
                    <input type="text"
                      value={form.notes ?? ""}
                      onChange={(e) => set("notes", e.target.value)}
                      className="field text-sm"
                      placeholder={t("bills.notes_placeholder")}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {error && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="text-xs text-rose-400 bg-rose-400/10 border border-rose-400/20 px-3 py-2.5 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <div className="px-5 pb-5 pt-2">
            <motion.button type="submit"
              disabled={loading || !form.name.trim()}
              whileTap={{ scale: 0.97 }} transition={tapTransition}
              className="w-full py-4 rounded-2xl text-sm font-bold text-white disabled:opacity-40"
              style={{ background: `linear-gradient(135deg, ${accent}, ${accent}bb)`, boxShadow: `0 4px 20px ${accent}30` }}>
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.span key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t("common.saving")}
                  </motion.span>
                ) : (
                  <motion.span key="i" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center justify-center gap-2">
                    <Check className="w-4 h-4" />{isEdit ? t("bills.save_edit") : t("bills.add_bill")}
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

// ── Bill Card ────────────────────────────────────────────────

interface BillCardProps {
  bill: Bill;
  onEdit: (b: Bill) => void;
  onDelete: (b: Bill) => void;
  onPay: (b: Bill) => void;
}

function BillCard({ bill, onEdit, onDelete, onPay }: BillCardProps) {
  const { t } = useTranslation();
  const { format } = useCurrency();
  const status = bill.effective_status ?? bill.status;
  const days   = bill.days_until_due ?? 0;
  const color  = bill.color ?? "#F59E0B";
  const sColor = statusColor(status);

  const isPaid     = status === "paid";
  const isOverdue  = status === "overdue";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
      transition={spring}
      className="relative rounded-[1.5rem] p-4 flex flex-col gap-3"
      style={{
        background: isPaid
          ? "hsl(var(--bg-card-2))"
          : `linear-gradient(135deg, ${color}10 0%, ${color}05 100%)`,
        border: `1px solid ${isPaid ? "hsl(var(--border))" : isOverdue ? `${sColor}35` : `${color}22`}`,
        opacity: isPaid ? 0.75 : 1,
      }}
    >
      {/* Top */}
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0"
          style={{ backgroundColor: `${color}18` }}>
          {bill.icon ?? "📋"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-sm t1 truncate">{bill.name}</p>
            {bill.is_recurring && (
              <RefreshCw className="w-3 h-3 t3 shrink-0" />
            )}
          </div>
          {/* Status badge */}
          <span className="inline-flex items-center gap-1 text-[9px] font-bold mt-0.5 px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: `${sColor}14`, color: sColor }}>
            {isPaid
              ? <><CheckCircle2 className="w-2.5 h-2.5" />{t("bills.paid")}</>
              : isOverdue
                ? <><AlertTriangle className="w-2.5 h-2.5" />{t("bills.overdue")}</>
                : <><Clock className="w-2.5 h-2.5" />{dayLabel(days, t)}</>}
          </span>
        </div>
        <div className="flex gap-1 shrink-0">
          {!isPaid && (
            <motion.button type="button" onClick={() => onPay(bill)}
              whileTap={{ scale: 0.88 }} transition={tapTransition}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold text-white"
              style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}>
              <Check className="w-3 h-3" />
              {t("bills.pay")}
            </motion.button>
          )}
          <motion.button type="button" onClick={() => onEdit(bill)}
            whileTap={{ scale: 0.88 }} transition={tapTransition}
            className="w-7 h-7 rounded-xl flex items-center justify-center t3 hover:t1 hover:bg-white/8 transition-all">
            <Pencil className="w-3.5 h-3.5" />
          </motion.button>
          <motion.button type="button" onClick={() => onDelete(bill)}
            whileTap={{ scale: 0.88 }} transition={tapTransition}
            className="w-7 h-7 rounded-xl flex items-center justify-center text-rose-400/60 hover:text-rose-400 hover:bg-rose-400/10 transition-all">
            <Trash2 className="w-3.5 h-3.5" />
          </motion.button>
        </div>
      </div>

      {/* Amount + date */}
      <div className="flex items-end justify-between">
        <div>
          {bill.amount
            ? <p className="text-2xl font-bold" style={{ color: isPaid ? "hsl(var(--text-2))" : color }}>{format(bill.amount)}</p>
            : <p className="text-sm font-semibold t3 italic">{t("bills.variable_amount")}</p>}
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 text-[10px] t3 justify-end">
            <Calendar className="w-3 h-3" />
            {isPaid ? bill.paid_at : bill.due_date}
          </div>
          {bill.category?.name && (
            <div className="text-[9px] mt-0.5 px-2 py-0.5 rounded-full inline-block"
              style={{ backgroundColor: `${bill.category.color}18`, color: bill.category.color }}>
              {bill.category.name}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Delete Confirm ───────────────────────────────────────────

function DeleteConfirm({ bill, onConfirm, onCancel }: { bill: Bill; onConfirm: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const color = bill.color ?? "#F59E0B";
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(11,15,20,0.80)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        transition={spring}
        className="w-full max-w-sm rounded-[1.75rem] p-6 space-y-4"
        style={{ backgroundColor: "hsl(var(--bg-card))", border: "1px solid hsl(var(--border))" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
            style={{ backgroundColor: `${color}14` }}>{bill.icon ?? "📋"}</div>
          <div>
            <p className="font-bold t1">{bill.name}</p>
            <p className="text-xs t3">{bill.due_date}</p>
          </div>
        </div>
        <p className="text-sm t2">{t("bills.delete_confirm")}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 rounded-2xl text-sm font-semibold t2 bg-[hsl(var(--bg-input))]">{t("common.cancel")}</button>
          <button onClick={onConfirm} className="flex-1 py-3 rounded-2xl text-sm font-bold text-white bg-rose-500">{t("common.delete")}</button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Section ──────────────────────────────────────────────────

function Section({ title, icon: Icon, color, bills, onEdit, onDelete, onPay }: {
  title: string; icon: React.ElementType; color: string;
  bills: Bill[]; onEdit: (b: Bill) => void; onDelete: (b: Bill) => void; onPay: (b: Bill) => void;
}) {
  if (!bills.length) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4" style={{ color }} />
        <h2 className="text-sm font-bold" style={{ color }}>{title}</h2>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: `${color}18`, color }}>{bills.length}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {bills.map((b) => (
            <BillCard key={b.id} bill={b} onEdit={onEdit} onDelete={onDelete} onPay={onPay} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────

export default function BillsPage() {
  const { t } = useTranslation();
  const { format } = useCurrency();
  const { data: bills = [], isLoading } = useBills();
  const createBill  = useCreateBill();
  const updateBill  = useUpdateBill();
  const deleteBill  = useDeleteBill();
  const payBill     = usePayBill();

  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<Bill | null>(null);
  const [deleting, setDeleting]   = useState<Bill | null>(null);
  const [paying, setPaying]       = useState<Bill | null>(null);

  // Group bills
  const overdue  = bills.filter((b) => (b.effective_status ?? b.status) === "overdue");
  const dueSoon  = bills.filter((b) => (b.effective_status ?? b.status) === "unpaid" && (b.days_until_due ?? 99) <= 7);
  const upcoming = bills.filter((b) => (b.effective_status ?? b.status) === "unpaid" && (b.days_until_due ?? 99) > 7);
  const paid     = bills.filter((b) => (b.effective_status ?? b.status) === "paid");

  // Stats
  const totalUnpaid  = [...overdue, ...dueSoon, ...upcoming].reduce((s, b) => s + (b.amount ?? 0), 0);
  const overdueTotal = overdue.reduce((s, b) => s + (b.amount ?? 0), 0);

  async function handleCreate(data: BillFormData) { await createBill.mutateAsync(data); }
  async function handleEdit(data: BillFormData) { if (!editing) return; await updateBill.mutateAsync({ id: editing.id, data }); }
  async function handleDelete() { if (!deleting) return; await deleteBill.mutateAsync(deleting.id); setDeleting(null); }
  async function handlePay(data: BillPayData) { if (!paying) return; await payBill.mutateAsync({ id: paying.id, data }); }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold t1">{t("bills.title")}</h1>
          <p className="text-sm t3 mt-0.5">{t("bills.subtitle")}</p>
        </div>
        <motion.button
          onClick={() => setShowForm(true)}
          whileTap={{ scale: 0.93 }} transition={tapTransition}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold text-white"
          style={{ background: "linear-gradient(135deg, #F59E0B, #D97706)", boxShadow: "0 4px 16px #F59E0B40" }}>
          <Plus className="w-4 h-4" />
          {t("bills.add")}
        </motion.button>
      </div>

      {/* Summary */}
      {bills.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spring}
          className="grid grid-cols-3 gap-3"
        >
          <div className="rounded-[1.5rem] p-4" style={{ background: "linear-gradient(135deg, #7c1d1d18, #7c1d1d08)", border: "1px solid #EF444422" }}>
            <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-rose-400/70">{t("bills.overdue_total")}</p>
            <p className="text-lg font-bold text-rose-400 mt-1">{overdue.length > 0 ? format(overdueTotal) : "—"}</p>
            <p className="text-[9px] text-rose-400/60 mt-0.5">{overdue.length} {t("bills.bills")}</p>
          </div>
          <div className="rounded-[1.5rem] p-4" style={{ background: "linear-gradient(135deg, #78350f18, #78350f08)", border: "1px solid #F59E0B22" }}>
            <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-amber-400/70">{t("bills.unpaid_total")}</p>
            <p className="text-lg font-bold text-amber-400 mt-1">{totalUnpaid > 0 ? format(totalUnpaid) : "—"}</p>
            <p className="text-[9px] text-amber-400/60 mt-0.5">{overdue.length + dueSoon.length + upcoming.length} {t("bills.bills")}</p>
          </div>
          <div className="rounded-[1.5rem] p-4" style={{ background: "linear-gradient(135deg, #06402618, #06402608)", border: "1px solid #10B98122" }}>
            <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-emerald-400/70">{t("bills.paid_this_month")}</p>
            <p className="text-lg font-bold text-emerald-400 mt-1">{paid.length}</p>
            <p className="text-[9px] text-emerald-400/60 mt-0.5">{t("bills.bills_paid")}</p>
          </div>
        </motion.div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map((i) => <div key={i} className="rounded-[1.5rem] h-40 animate-pulse bg-[hsl(var(--bg-card-2))]" />)}
        </div>
      )}

      {/* Grouped sections */}
      {!isLoading && (
        <div className="space-y-8">
          <Section title={t("bills.section_overdue")} icon={AlertTriangle} color="#EF4444"
            bills={overdue} onEdit={setEditing} onDelete={setDeleting} onPay={setPaying} />
          <Section title={t("bills.section_due_soon")} icon={Clock} color="#F59E0B"
            bills={dueSoon} onEdit={setEditing} onDelete={setDeleting} onPay={setPaying} />
          <Section title={t("bills.section_upcoming")} icon={Calendar} color="#6366F1"
            bills={upcoming} onEdit={setEditing} onDelete={setDeleting} onPay={setPaying} />
          <Section title={t("bills.section_paid")} icon={CheckCircle2} color="#10B981"
            bills={paid} onEdit={setEditing} onDelete={setDeleting} onPay={setPaying} />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && bills.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="text-center py-16 space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/10 flex items-center justify-center mx-auto">
            <Receipt className="w-8 h-8 text-amber-400/60" />
          </div>
          <div>
            <p className="font-bold t1 text-lg">{t("bills.empty_title")}</p>
            <p className="text-sm t3 mt-1 max-w-xs mx-auto">{t("bills.empty_subtitle")}</p>
          </div>
          <motion.button
            onClick={() => setShowForm(true)}
            whileTap={{ scale: 0.95 }} transition={tapTransition}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg, #F59E0B, #D97706)" }}>
            <Plus className="w-4 h-4" />
            {t("bills.add_first")}
          </motion.button>
        </motion.div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {(showForm || editing) && (
          <BillForm key="form"
            initial={editing ?? undefined}
            onSubmit={editing ? handleEdit : handleCreate}
            onClose={() => { setShowForm(false); setEditing(null); }}
          />
        )}
        {paying && (
          <PayModal key="pay"
            bill={paying}
            onSubmit={handlePay}
            onClose={() => setPaying(null)}
          />
        )}
        {deleting && (
          <DeleteConfirm key="del"
            bill={deleting}
            onConfirm={handleDelete}
            onCancel={() => setDeleting(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
