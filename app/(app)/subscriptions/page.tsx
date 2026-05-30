"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RefreshCw, Plus, Pencil, Trash2, X, Check, AlertCircle,
  Bell, BellOff, ChevronDown, Calendar,
  Banknote, Building2, CreditCard, Wallet, PiggyBank,
  Zap, Pause, Play, TrendingDown,
} from "lucide-react";
import { useSubscriptions, useCreateSubscription, useUpdateSubscription, useDeleteSubscription } from "@/lib/query/hooks";
import { useAccounts } from "@/lib/query/hooks";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { spring, tapTransition } from "@/lib/motion";
import { safeFetch } from "@/lib/fetch-safe";
import type { Subscription, SubscriptionFormData, BillingCycle, SubscriptionStatus, AccountType } from "@/types";

// ── Constants ────────────────────────────────────────────────

const BILLING_CYCLES: { value: BillingCycle; labelKey: string; multiplier: number }[] = [
  { value: "weekly",    labelKey: "subscriptions.weekly",    multiplier: 52 / 12 },
  { value: "monthly",   labelKey: "subscriptions.monthly",   multiplier: 1 },
  { value: "quarterly", labelKey: "subscriptions.quarterly", multiplier: 1 / 3 },
  { value: "yearly",    labelKey: "subscriptions.yearly",    multiplier: 1 / 12 },
];

const PRESETS = [
  { name: "Netflix",       icon: "🎬", color: "#E50914" },
  { name: "Spotify",       icon: "🎵", color: "#1DB954" },
  { name: "Amazon Prime",  icon: "📦", color: "#00A8E0" },
  { name: "YouTube",       icon: "📺", color: "#FF0000" },
  { name: "Disney+",       icon: "🏰", color: "#113CCF" },
  { name: "Apple Music",   icon: "🍎", color: "#FC3C44" },
  { name: "iCloud",        icon: "☁️", color: "#3B82F6" },
  { name: "Gym",           icon: "💪", color: "#10B981" },
  { name: "ChatGPT",       icon: "🤖", color: "#10A37F" },
  { name: "Adobe",         icon: "🎨", color: "#FF0000" },
  { name: "Dropbox",       icon: "📁", color: "#0061FF" },
  { name: "LinkedIn",      icon: "💼", color: "#0A66C2" },
];

const COLORS = [
  "#E50914","#1DB954","#00A8E0","#FF0000","#113CCF",
  "#FC3C44","#3B82F6","#10B981","#10A37F","#8B5CF6",
  "#F59E0B","#06B6D4","#EF4444","#6366F1",
];

const ACCOUNT_ICONS: Record<AccountType, React.ElementType> = {
  cash: Banknote, bank: Building2, credit_card: CreditCard, wallet: Wallet, savings: PiggyBank,
};
const ACCOUNT_COLORS: Record<AccountType, string> = {
  cash: "#10B981", bank: "#3B82F6", credit_card: "#8B5CF6", wallet: "#F59E0B", savings: "#06B6D4",
};

function toMonthly(amount: number, cycle: BillingCycle): number {
  const m = BILLING_CYCLES.find((c) => c.value === cycle)?.multiplier ?? 1;
  return amount * m;
}

function urgencyColor(days: number): string {
  if (days < 0) return "#EF4444";
  if (days <= 2) return "#EF4444";
  if (days <= 7) return "#F59E0B";
  return "#10B981";
}

function dayLabel(days: number, t: (k: string) => string): string {
  if (days < 0) return t("subscriptions.overdue");
  if (days === 0) return t("subscriptions.today");
  if (days === 1) return t("subscriptions.tomorrow");
  return `${t("subscriptions.in")} ${days} ${t("subscriptions.days")}`;
}

// ── Subscription Form ────────────────────────────────────────

interface FormProps {
  initial?: Subscription;
  onSubmit: (data: SubscriptionFormData) => Promise<void>;
  onClose: () => void;
}

function SubscriptionForm({ initial, onSubmit, onClose }: FormProps) {
  const { t } = useTranslation();
  const { data: accounts = [] } = useAccounts();
  const isEdit = !!initial;

  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split("T")[0];

  const [form, setForm] = useState<SubscriptionFormData>({
    name:                   initial?.name                   ?? "",
    amount:                 initial?.amount                 ?? 0,
    currency:               initial?.currency               ?? "USD",
    billing_cycle:          initial?.billing_cycle          ?? "monthly",
    next_billing_date:      initial?.next_billing_date      ?? tomorrow,
    category_id:            initial?.category_id            ?? null,
    account_id:             initial?.account_id             ?? null,
    color:                  initial?.color                  ?? null,
    icon:                   initial?.icon                   ?? null,
    notes:                  initial?.notes                  ?? "",
    status:                 initial?.status                 ?? "active",
    remind_days_before:     initial?.remind_days_before     ?? 3,
    auto_create_transaction: initial?.auto_create_transaction ?? true,
  });
  const [rawAmount, setRawAmount] = useState(initial?.amount ? String(initial.amount) : "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  function set<K extends keyof SubscriptionFormData>(k: K, v: SubscriptionFormData[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function applyPreset(p: typeof PRESETS[0]) {
    setForm((prev) => ({ ...prev, name: p.name, icon: p.icon, color: p.color }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError(t("subscriptions.name_required")); return; }
    if (!form.amount || Number(form.amount) <= 0) { setError(t("subscriptions.amount_positive")); return; }
    setLoading(true); setError("");
    try {
      await onSubmit(form);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
      setLoading(false);
    }
  }

  const accent = form.color ?? "#6366F1";
  const monthlyEq = toMonthly(form.amount || 0, form.billing_cycle);

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
        {/* Header */}
        <div className="shrink-0 px-5 pt-4 pb-3" style={{ background: `${accent}10` }}>
          <div className="w-10 h-1 rounded-full bg-white/12 mx-auto mb-3 sm:hidden" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {form.icon && <span className="text-2xl">{form.icon}</span>}
              <p className="text-xs font-bold t3 uppercase tracking-widest">
                {isEdit ? t("subscriptions.edit") : t("subscriptions.new")}
              </p>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center t3 hover:t1 hover:bg-white/8 transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-5 py-5 space-y-5">

            {/* Quick presets */}
            {!isEdit && (
              <div>
                <label className="block text-[10px] font-semibold t3 uppercase tracking-[0.12em] mb-2">
                  {t("subscriptions.quick_pick")}
                </label>
                <div className="flex gap-2 flex-wrap">
                  {PRESETS.map((p) => (
                    <motion.button key={p.name} type="button"
                      onClick={() => applyPreset(p)}
                      whileTap={{ scale: 0.9 }} transition={tapTransition}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all"
                      style={form.name === p.name ? {
                        backgroundColor: `${p.color}18`, borderColor: `${p.color}40`, color: p.color,
                      } : {
                        backgroundColor: "hsl(var(--bg-input))", borderColor: "hsl(var(--border))", color: "hsl(var(--text-2))",
                      }}>
                      <span>{p.icon}</span>{p.name}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {/* Name */}
            <div>
              <label className="block text-[10px] font-semibold t3 uppercase tracking-[0.12em] mb-2">
                {t("subscriptions.name")}
              </label>
              <input type="text" required
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className="field text-sm font-medium"
                placeholder={t("subscriptions.name_placeholder")}
              />
            </div>

            {/* Amount + billing cycle */}
            <div>
              <label className="block text-[10px] font-semibold t3 uppercase tracking-[0.12em] mb-2">
                {t("subscriptions.amount")}
              </label>
              <div className="flex gap-2">
                <input type="number" inputMode="decimal" min="0.01" step="0.01"
                  value={rawAmount}
                  onChange={(e) => { setRawAmount(e.target.value); set("amount", parseFloat(e.target.value) || 0); }}
                  className="field text-sm flex-1"
                  placeholder="0.00"
                />
                <select
                  value={form.billing_cycle}
                  onChange={(e) => set("billing_cycle", e.target.value as BillingCycle)}
                  className="field text-sm w-32 shrink-0"
                >
                  {BILLING_CYCLES.map((c) => (
                    <option key={c.value} value={c.value}>{t(c.labelKey)}</option>
                  ))}
                </select>
              </div>
              {form.amount > 0 && form.billing_cycle !== "monthly" && (
                <p className="text-[10px] t3 mt-1.5">
                  ≈ {monthlyEq.toFixed(2)} / {t("subscriptions.month")}
                </p>
              )}
            </div>

            {/* Next billing date */}
            <div>
              <label className="block text-[10px] font-semibold t3 uppercase tracking-[0.12em] mb-2">
                {t("subscriptions.next_billing")}
              </label>
              <input type="date"
                value={form.next_billing_date}
                onChange={(e) => set("next_billing_date", e.target.value)}
                className="field text-sm"
              />
            </div>

            {/* Color dot picker */}
            <div>
              <label className="block text-[10px] font-semibold t3 uppercase tracking-[0.12em] mb-2">
                {t("subscriptions.color")}
              </label>
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

            {/* Account selector */}
            {accounts.length > 0 && (
              <div>
                <label className="block text-[10px] font-semibold t3 uppercase tracking-[0.12em] mb-2">
                  {t("subscriptions.account")}
                </label>
                <div className="flex gap-2 flex-wrap">
                  <button type="button" onClick={() => set("account_id", null)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      !form.account_id ? "bg-[hsl(var(--bg-card-2))] border-[hsl(var(--text-3))] t1 border-[1.5px]" : "bg-[hsl(var(--bg-input))] border-[hsl(var(--border))] t3"
                    }`}>
                    —
                  </button>
                  {accounts.map((acc) => {
                    const Icon = ACCOUNT_ICONS[acc.type] ?? Wallet;
                    const color = ACCOUNT_COLORS[acc.type] ?? "#3B82F6";
                    const isSelected = form.account_id === acc.id;
                    return (
                      <button key={acc.id} type="button" onClick={() => set("account_id", acc.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all"
                        style={isSelected ? {
                          backgroundColor: `${color}14`, borderColor: `${color}45`, color,
                        } : {
                          backgroundColor: "hsl(var(--bg-input))", borderColor: "hsl(var(--border))", color: "hsl(var(--text-2))",
                        }}>
                        <Icon className="w-3 h-3" />
                        {acc.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Advanced toggle */}
            <button type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-2 text-xs t3 hover:t2 transition-all">
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
              {t("subscriptions.advanced")}
            </button>

            <AnimatePresence>
              {showAdvanced && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                  className="overflow-hidden space-y-4"
                >
                  {/* Remind days */}
                  <div>
                    <label className="block text-[10px] font-semibold t3 uppercase tracking-[0.12em] mb-2">
                      {t("subscriptions.remind_days")}
                    </label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 5, 7].map((d) => (
                        <button key={d} type="button" onClick={() => set("remind_days_before", d)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                            form.remind_days_before === d
                              ? "border-[1.5px] t1"
                              : "bg-[hsl(var(--bg-input))] border-[hsl(var(--border))] t3"
                          }`}
                          style={form.remind_days_before === d ? { backgroundColor: `${accent}14`, borderColor: `${accent}45`, color: accent } : {}}>
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Auto-create transaction */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium t1">{t("subscriptions.auto_transaction")}</p>
                      <p className="text-[10px] t3">{t("subscriptions.auto_transaction_hint")}</p>
                    </div>
                    <motion.button type="button"
                      onClick={() => set("auto_create_transaction", !form.auto_create_transaction)}
                      whileTap={{ scale: 0.92 }} transition={tapTransition}
                      className="w-11 h-6 rounded-full relative transition-all shrink-0"
                      style={{ backgroundColor: form.auto_create_transaction ? accent : "hsl(var(--bg-input))" }}>
                      <motion.div
                        className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm"
                        animate={{ left: form.auto_create_transaction ? "calc(100% - 22px)" : "2px" }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    </motion.button>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-[10px] font-semibold t3 uppercase tracking-[0.12em] mb-2">
                      {t("subscriptions.notes")}
                    </label>
                    <input type="text"
                      value={form.notes ?? ""}
                      onChange={(e) => set("notes", e.target.value || "")}
                      className="field text-sm"
                      placeholder={t("subscriptions.notes_placeholder")}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="text-xs text-rose-400 bg-rose-400/10 border border-rose-400/20 px-3 py-2.5 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Submit */}
          <div className="px-5 pb-5 pt-2">
            <motion.button type="submit"
              disabled={loading || !form.name.trim() || !form.amount}
              whileTap={{ scale: 0.97 }} transition={tapTransition}
              className="w-full py-4 rounded-2xl text-sm font-bold text-white transition-all disabled:opacity-40"
              style={{ background: `linear-gradient(135deg, ${accent}, ${accent}bb)`, boxShadow: `0 4px 20px ${accent}35` }}>
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.span key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t("common.saving")}
                  </motion.span>
                ) : (
                  <motion.span key="i" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center justify-center gap-2">
                    <Check className="w-4 h-4" />
                    {isEdit ? t("subscriptions.save_edit") : t("subscriptions.add_subscription")}
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

// ── Subscription Card ────────────────────────────────────────

interface CardProps {
  sub: Subscription;
  onEdit: (s: Subscription) => void;
  onDelete: (s: Subscription) => void;
  onToggleStatus: (s: Subscription) => void;
}

function SubscriptionCard({ sub, onEdit, onDelete, onToggleStatus }: CardProps) {
  const { t } = useTranslation();
  const { format } = useCurrency();
  const days = sub.days_until_billing ?? 0;
  const color = sub.color ?? "#6366F1";
  const urgency = urgencyColor(days);
  const isPaused = sub.status === "paused";
  const isCancelled = sub.status === "cancelled";
  const cycleLabel = BILLING_CYCLES.find((c) => c.value === sub.billing_cycle)?.labelKey ?? "subscriptions.monthly";
  const monthly = toMonthly(sub.amount, sub.billing_cycle);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
      transition={spring}
      className="relative rounded-[1.5rem] p-4 flex flex-col gap-3 overflow-hidden"
      style={{
        background: isPaused || isCancelled
          ? "hsl(var(--bg-card-2))"
          : `linear-gradient(135deg, ${color}10 0%, ${color}05 100%)`,
        border: `1px solid ${isPaused || isCancelled ? "hsl(var(--border))" : `${color}22`}`,
        opacity: isCancelled ? 0.6 : 1,
      }}
    >
      {/* Status badge */}
      {(isPaused || isCancelled) && (
        <div className="absolute top-3 end-3 px-2 py-0.5 rounded-full text-[9px] font-bold"
          style={{ backgroundColor: isPaused ? "#F59E0B18" : "#EF444418", color: isPaused ? "#F59E0B" : "#EF4444" }}>
          {isPaused ? t("subscriptions.paused") : t("subscriptions.cancelled")}
        </div>
      )}

      {/* Top row */}
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0"
          style={{ backgroundColor: `${color}18` }}>
          {sub.icon ?? <RefreshCw className="w-5 h-5" style={{ color }} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm t1 truncate">{sub.name}</p>
          <p className="text-[10px] t3 mt-0.5">{t(cycleLabel)}</p>
        </div>
        <div className="flex gap-1 shrink-0">
          <motion.button type="button" onClick={() => onToggleStatus(sub)}
            whileTap={{ scale: 0.88 }} transition={tapTransition}
            className="w-7 h-7 rounded-xl flex items-center justify-center t3 hover:t1 hover:bg-white/8 transition-all"
            title={isPaused ? t("subscriptions.resume") : t("subscriptions.pause")}>
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </motion.button>
          <motion.button type="button" onClick={() => onEdit(sub)}
            whileTap={{ scale: 0.88 }} transition={tapTransition}
            className="w-7 h-7 rounded-xl flex items-center justify-center t3 hover:t1 hover:bg-white/8 transition-all">
            <Pencil className="w-3.5 h-3.5" />
          </motion.button>
          <motion.button type="button" onClick={() => onDelete(sub)}
            whileTap={{ scale: 0.88 }} transition={tapTransition}
            className="w-7 h-7 rounded-xl flex items-center justify-center text-rose-400/60 hover:text-rose-400 hover:bg-rose-400/10 transition-all">
            <Trash2 className="w-3.5 h-3.5" />
          </motion.button>
        </div>
      </div>

      {/* Amount */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold" style={{ color: isPaused || isCancelled ? "hsl(var(--text-2))" : color }}>
            {format(sub.amount)}
          </p>
          {sub.billing_cycle !== "monthly" && (
            <p className="text-[10px] t3">≈ {format(monthly)}/{t("subscriptions.month")}</p>
          )}
        </div>

        {/* Countdown badge */}
        {!isCancelled && (
          <div className="px-2.5 py-1.5 rounded-xl text-[10px] font-bold"
            style={{
              backgroundColor: isPaused ? "hsl(var(--bg-input))" : `${urgency}18`,
              color: isPaused ? "hsl(var(--text-3))" : urgency,
            }}>
            {isPaused ? "—" : dayLabel(days, t)}
          </div>
        )}
      </div>

      {/* Next billing info */}
      {!isCancelled && (
        <div className="flex items-center gap-2 pt-1 border-t" style={{ borderColor: `${color}15` }}>
          <Calendar className="w-3 h-3 t3" />
          <span className="text-[10px] t3">
            {t("subscriptions.next")}: {sub.next_billing_date}
          </span>
          {sub.auto_create_transaction && !isPaused && (
            <div className="ms-auto flex items-center gap-1 text-[9px] t3">
              <Zap className="w-3 h-3" />
              {t("subscriptions.auto")}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ── Delete Confirm ───────────────────────────────────────────

function DeleteConfirm({ sub, onConfirm, onCancel }: { sub: Subscription; onConfirm: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const { format } = useCurrency();
  const color = sub.color ?? "#6366F1";
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
            style={{ backgroundColor: `${color}14` }}>
            {sub.icon ?? "📋"}
          </div>
          <div>
            <p className="font-bold t1">{sub.name}</p>
            <p className="text-xs t3">{format(sub.amount)} / {sub.billing_cycle}</p>
          </div>
        </div>
        <p className="text-sm t2">{t("subscriptions.delete_confirm")}</p>
        <div className="flex gap-3 pt-1">
          <button onClick={onCancel}
            className="flex-1 py-3 rounded-2xl text-sm font-semibold t2 bg-[hsl(var(--bg-input))] hover:t1 transition-all">
            {t("common.cancel")}
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-3 rounded-2xl text-sm font-bold text-white bg-rose-500 hover:bg-rose-600 transition-all">
            {t("common.delete")}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────

export default function SubscriptionsPage() {
  const { t } = useTranslation();
  const { format } = useCurrency();
  const { data: subscriptions = [], isLoading } = useSubscriptions();
  const createSubscription = useCreateSubscription();
  const updateSubscription = useUpdateSubscription();
  const deleteSubscription = useDeleteSubscription();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [deleting, setDeleting] = useState<Subscription | null>(null);

  // Stats
  const active = subscriptions.filter((s) => s.status === "active");
  const paused = subscriptions.filter((s) => s.status === "paused");
  const totalMonthly = active.reduce((sum, s) => sum + toMonthly(s.amount, s.billing_cycle), 0);
  const totalYearly  = totalMonthly * 12;
  const dueSoon      = active.filter((s) => (s.days_until_billing ?? Infinity) <= 7).sort((a, b) => (a.days_until_billing ?? 0) - (b.days_until_billing ?? 0));
  const rest         = active.filter((s) => (s.days_until_billing ?? Infinity) > 7);

  async function handleCreate(data: SubscriptionFormData) {
    await createSubscription.mutateAsync(data);
  }

  async function handleEdit(data: SubscriptionFormData) {
    if (!editing) return;
    await updateSubscription.mutateAsync({ id: editing.id, data });
  }

  async function handleDelete() {
    if (!deleting) return;
    await deleteSubscription.mutateAsync(deleting.id);
    setDeleting(null);
  }

  async function handleToggleStatus(sub: Subscription) {
    const newStatus: SubscriptionStatus = sub.status === "active" ? "paused" : "active";
    await updateSubscription.mutateAsync({ id: sub.id, data: { status: newStatus } });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold t1">{t("subscriptions.title")}</h1>
          <p className="text-sm t3 mt-0.5">{t("subscriptions.subtitle")}</p>
        </div>
        <motion.button
          onClick={() => setShowForm(true)}
          whileTap={{ scale: 0.93 }} transition={tapTransition}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold text-white"
          style={{ background: "linear-gradient(135deg, #6366F1, #4F46E5)", boxShadow: "0 4px 16px #6366F140" }}>
          <Plus className="w-4 h-4" />
          {t("subscriptions.add")}
        </motion.button>
      </div>

      {/* Summary card */}
      {active.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spring}
          className="rounded-[1.75rem] p-5 grid grid-cols-3 gap-4"
          style={{
            background: "linear-gradient(135deg, #1a1040 0%, #0d0a1e 100%)",
            border: "1px solid rgba(99,102,241,0.2)",
          }}
        >
          <div>
            <p className="text-[10px] font-semibold text-indigo-300/70 uppercase tracking-[0.1em]">{t("subscriptions.monthly_total")}</p>
            <p className="text-xl font-bold text-white mt-1">{format(totalMonthly)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-indigo-300/70 uppercase tracking-[0.1em]">{t("subscriptions.yearly_total")}</p>
            <p className="text-xl font-bold text-white mt-1">{format(totalYearly)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-indigo-300/70 uppercase tracking-[0.1em]">{t("subscriptions.active_count")}</p>
            <p className="text-xl font-bold text-white mt-1">
              {active.length}
              {paused.length > 0 && <span className="text-sm text-indigo-300/50 ms-1">+{paused.length}</span>}
            </p>
          </div>
        </motion.div>
      )}

      {/* Due soon section */}
      {dueSoon.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold t1">{t("subscriptions.due_soon")}</h2>
          </div>
          <div className="space-y-2">
            {dueSoon.map((sub) => {
              const days = sub.days_until_billing ?? 0;
              const urgency = urgencyColor(days);
              return (
                <motion.div key={sub.id}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={spring}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                  style={{ backgroundColor: `${urgency}10`, border: `1px solid ${urgency}25` }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                    style={{ backgroundColor: `${sub.color ?? urgency}18` }}>
                    {sub.icon ?? "📋"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold t1 truncate">{sub.name}</p>
                    <p className="text-[10px] t3">{sub.next_billing_date}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold" style={{ color: urgency }}>{format(sub.amount)}</p>
                    <p className="text-[10px] font-semibold" style={{ color: urgency }}>{dayLabel(days, t)}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map((i) => <div key={i} className="rounded-[1.5rem] h-44 animate-pulse bg-[hsl(var(--bg-card-2))]" />)}
        </div>
      )}

      {/* All active subscriptions (> 7 days) */}
      {!isLoading && rest.length > 0 && (
        <div>
          {dueSoon.length > 0 && (
            <h2 className="text-sm font-bold t2 mb-3">{t("subscriptions.upcoming")}</h2>
          )}
          <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {rest.map((sub) => (
                <SubscriptionCard key={sub.id} sub={sub}
                  onEdit={(s) => setEditing(s)}
                  onDelete={(s) => setDeleting(s)}
                  onToggleStatus={handleToggleStatus}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      )}

      {/* Paused subscriptions */}
      {!isLoading && paused.length > 0 && (
        <div>
          <h2 className="text-sm font-bold t3 mb-3">{t("subscriptions.paused_section")}</h2>
          <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {paused.map((sub) => (
                <SubscriptionCard key={sub.id} sub={sub}
                  onEdit={(s) => setEditing(s)}
                  onDelete={(s) => setDeleting(s)}
                  onToggleStatus={handleToggleStatus}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && subscriptions.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="text-center py-16 space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 flex items-center justify-center mx-auto">
            <RefreshCw className="w-8 h-8 text-indigo-400/60" />
          </div>
          <div>
            <p className="font-bold t1 text-lg">{t("subscriptions.empty_title")}</p>
            <p className="text-sm t3 mt-1">{t("subscriptions.empty_subtitle")}</p>
          </div>
          <motion.button
            onClick={() => setShowForm(true)}
            whileTap={{ scale: 0.95 }} transition={tapTransition}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg, #6366F1, #4F46E5)" }}>
            <Plus className="w-4 h-4" />
            {t("subscriptions.add_first")}
          </motion.button>
        </motion.div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {(showForm || editing) && (
          <SubscriptionForm
            key="form"
            initial={editing ?? undefined}
            onSubmit={editing ? handleEdit : handleCreate}
            onClose={() => { setShowForm(false); setEditing(null); }}
          />
        )}
        {deleting && (
          <DeleteConfirm
            key="delete"
            sub={deleting}
            onConfirm={handleDelete}
            onCancel={() => setDeleting(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
