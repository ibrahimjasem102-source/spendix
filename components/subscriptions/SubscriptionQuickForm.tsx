"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarClock, Check, RefreshCw, WalletCards, X, Zap } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { useAccounts } from "@/lib/query/hooks";
import { backdropVariants, ease, sheetTransition, tapTransition } from "@/lib/motion";
import SheetDragHandle from "@/components/ui/SheetDragHandle";
import type { BillingCycle, SubscriptionFormData } from "@/types";

interface Props {
  onSubmit: (data: SubscriptionFormData) => Promise<void>;
  onClose: () => void;
}

const cycles: BillingCycle[] = ["weekly", "monthly", "quarterly", "yearly"];

function dateAfter(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseAmount(value: string) {
  return Number(value.replace(",", "."));
}

export default function SubscriptionQuickForm({ onSubmit, onClose }: Props) {
  const { t } = useTranslation();
  const { currency, symbol } = useCurrency();
  const { data: accounts = [] } = useAccounts();

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [nextBillingDate, setNextBillingDate] = useState(dateAfter(1));
  const [accountId, setAccountId] = useState<string | null>(null);
  const [autoCreateTransaction, setAutoCreateTransaction] = useState(true);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("spendix:nav-hide"));
    return () => { window.dispatchEvent(new CustomEvent("spendix:nav-show")); };
  }, []);

  useEffect(() => {
    if (accountId || accounts.length === 0) return;
    setAccountId(accounts.find((account) => account.is_default)?.id ?? accounts[0]?.id ?? null);
  }, [accountId, accounts]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    const parsedAmount = parseAmount(amount);

    if (!trimmedName) {
      setError(t("subscriptions.name_required"));
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError(t("subscriptions.amount_positive"));
      return;
    }

    setSaving(true);
    setError("");
    try {
      await onSubmit({
        name: trimmedName,
        amount: parsedAmount,
        currency,
        billing_cycle: billingCycle,
        next_billing_date: nextBillingDate,
        account_id: accountId,
        color: "#A855F7",
        icon: null,
        notes: notes.trim() || null,
        status: "active",
        remind_days_before: 3,
        auto_create_transaction: autoCreateTransaction,
      });
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(message && t(message) !== message ? t(message) : t("transactions.form_error"));
      setSaving(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        variants={backdropVariants}
        initial="hidden" animate="visible" exit="exit"
        transition={ease}
        className="fixed inset-0 z-[120] bg-black/55 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.form
        onSubmit={handleSubmit}
        initial={{ y: "100%", opacity: 0.92 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={sheetTransition}
        className="fixed inset-x-0 bottom-0 z-[130] flex flex-col rounded-t-[28px] overflow-hidden"
        style={{
          backgroundColor: "hsl(var(--bg-card))",
          border: "1px solid hsl(var(--border))",
          maxHeight: "88dvh",
        }}
      >
        <div className="flex justify-center pt-3">
          <SheetDragHandle onClose={onClose} />
        </div>

        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid hsl(var(--border-2))" }}>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-500/15 text-purple-400">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-bold t1">{t("subscriptions.new")}</p>
              <p className="text-xs t3">{t("hub.action_subscription_desc")}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-2xl t3" style={{ backgroundColor: "hsl(var(--bg-input))" }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 space-y-4 overflow-y-auto px-5 py-5 overscroll-contain">
          {error && (
            <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
              {error}
            </div>
          )}

          {/* 1 ── Amount (big, centered) ───────────────────── */}
          <div className="text-center">
            <p className="text-[10px] font-semibold t3 uppercase tracking-[0.14em] mb-3">{t("subscriptions.amount")}</p>
            <div className="relative flex items-center justify-center gap-2">
              <span className="text-xl font-bold t3 select-none">{symbol}</span>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                autoFocus
                className="text-5xl font-bold bg-transparent border-none outline-none tabular-nums text-center w-48 placeholder:text-[hsl(var(--text-3))] number-display"
                style={{ color: amount ? "#A855F7" : undefined }}
              />
              {amount && (
                <button type="button" onClick={() => setAmount("")}
                  className="absolute -end-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[hsl(var(--bg-input))] flex items-center justify-center t3 hover:t1 transition-all">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Separator */}
          <div className="h-px bg-[hsl(var(--border-2))]" />

          {/* 2 ── Name ─────────────────────────────────────── */}
          <label className="block">
            <span className="mb-2 block text-[10px] font-bold uppercase t3">{t("subscriptions.name")}</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("subscriptions.name_placeholder")}
              className="w-full rounded-2xl px-4 py-3 text-sm font-semibold t1 outline-none"
              style={{ backgroundColor: "hsl(var(--bg-input))", border: "1px solid hsl(var(--border))" }}
            />
          </label>

          {/* 3 ── Billing cycle ────────────────────────────── */}
          <div>
            <span className="mb-2 block text-[10px] font-bold uppercase t3">{t("subscriptions.month")}</span>
            <div className="grid grid-cols-4 gap-2">
              {cycles.map((cycle) => (
                <motion.button
                  key={cycle}
                  type="button"
                  onClick={() => setBillingCycle(cycle)}
                  whileTap={{ scale: 0.96 }}
                  transition={tapTransition}
                  className="rounded-2xl px-2 py-2 text-[11px] font-bold"
                  style={{
                    backgroundColor: billingCycle === cycle ? "#A855F7" : "hsl(var(--bg-input))",
                    color: billingCycle === cycle ? "white" : "hsl(var(--text-2))",
                    border: "1px solid hsl(var(--border))",
                  }}
                >
                  {t(`subscriptions.${cycle}`)}
                </motion.button>
              ))}
            </div>
          </div>

          {/* 4 ── Next billing date ────────────────────────── */}
          <label className="block">
            <span className="mb-2 block text-[10px] font-bold uppercase t3">{t("subscriptions.next_billing")}</span>
            <div className="flex items-center gap-2 rounded-2xl px-4 py-3" style={{ backgroundColor: "hsl(var(--bg-input))", border: "1px solid hsl(var(--border))" }}>
              <CalendarClock className="h-4 w-4 t3" />
              <input
                type="date"
                value={nextBillingDate}
                onChange={(e) => setNextBillingDate(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold t1 outline-none"
              />
            </div>
          </label>

          {accounts.length > 0 && (
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase t3">{t("subscriptions.account")}</span>
              <div className="flex items-center gap-2 rounded-2xl px-4 py-3" style={{ backgroundColor: "hsl(var(--bg-input))", border: "1px solid hsl(var(--border))" }}>
                <WalletCards className="h-4 w-4 t3" />
                <select
                  value={accountId ?? ""}
                  onChange={(event) => setAccountId(event.target.value || null)}
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold t1 outline-none"
                >
                  <option value="">{t("common.none")}</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>
            </label>
          )}

          <button
            type="button"
            onClick={() => setAutoCreateTransaction((value) => !value)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl p-3 text-start"
            style={{ backgroundColor: "hsl(var(--bg-card-2))", border: "1px solid hsl(var(--border))" }}
          >
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-500/12 text-purple-400">
                <Zap className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-sm font-bold t1">{t("subscriptions.auto_transaction")}</span>
                <span className="block text-[11px] t3">{t("subscriptions.auto_transaction_hint")}</span>
              </span>
            </span>
            <span className={`h-6 w-11 rounded-full p-1 transition-colors ${autoCreateTransaction ? "bg-purple-500" : "bg-white/10"}`}>
              <span className={`block h-4 w-4 rounded-full bg-white transition-transform ${
                autoCreateTransaction ? "translate-x-5 rtl:translate-x-0" : "rtl:translate-x-5"
              }`} />
            </span>
          </button>

          <label className="block">
            <span className="mb-2 block text-[10px] font-bold uppercase t3">{t("subscriptions.notes")}</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={t("subscriptions.notes_placeholder")}
              rows={3}
              className="w-full resize-none rounded-2xl px-4 py-3 text-sm t1 outline-none"
              style={{ backgroundColor: "hsl(var(--bg-input))", border: "1px solid hsl(var(--border))" }}
            />
          </label>
        </div>

        <div className="flex gap-3 px-5 pt-2" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom, 0px))" }}>
          <motion.button
            type="button"
            onClick={onClose}
            whileTap={{ scale: 0.97 }}
            transition={tapTransition}
            className="h-12 flex-1 rounded-2xl text-sm font-bold t2"
            style={{ backgroundColor: "hsl(var(--bg-input))" }}
          >
            {t("common.cancel")}
          </motion.button>
          <motion.button
            type="submit"
            disabled={saving}
            whileTap={{ scale: 0.97 }}
            transition={tapTransition}
            className="flex h-12 flex-[1.4] items-center justify-center gap-2 rounded-2xl bg-purple-500 text-sm font-bold text-white disabled:opacity-60"
          >
            <Check className="h-4 w-4" />
            {saving ? t("common.saving") : t("subscriptions.add_subscription")}
          </motion.button>
        </div>
      </motion.form>
    </AnimatePresence>,
    document.body
  );
}
