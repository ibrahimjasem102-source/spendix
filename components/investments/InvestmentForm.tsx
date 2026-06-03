"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, TrendingUp, Bitcoin, BarChart2, Home, Package, Check, Loader2,
  ArrowDownRight, CalendarDays, FileText, Wallet,
} from "lucide-react";
import { Investment, InvestmentFormData, AssetType } from "@/types";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { useGuest } from "@/contexts/GuestContext";
import { spring, tapTransition } from "@/lib/motion";
import SheetDragHandle from "@/components/ui/SheetDragHandle";

interface Props {
  initial?: Investment;
  onSubmit: (data: InvestmentFormData) => Promise<void>;
  onClose: () => void;
}

const today = new Date().toISOString().split("T")[0];

const ASSET_CONFIG: Record<AssetType, { icon: React.ElementType; color: string; bg: string; ring: string }> = {
  stock:       { icon: TrendingUp, color: "text-purple-400",  bg: "bg-purple-400/10",  ring: "#a78bfa" },
  crypto:      { icon: Bitcoin,    color: "text-amber-400",   bg: "bg-amber-400/10",   ring: "#fbbf24" },
  etf:         { icon: BarChart2,  color: "text-cyan-400",    bg: "bg-cyan-400/10",    ring: "#22d3ee" },
  real_estate: { icon: Home,       color: "text-emerald-400", bg: "bg-emerald-400/10", ring: "#34d399" },
  other:       { icon: Package,    color: "text-gray-400",    bg: "bg-gray-400/10",    ring: "#9ca3af" },
};

const ASSET_TYPES: AssetType[] = ["stock", "crypto", "etf", "real_estate", "other"];

export default function InvestmentForm({ initial, onSubmit, onClose }: Props) {
  const { t } = useTranslation();
  const { symbol, format } = useCurrency();
  const { isLoading: guestLoading } = useGuest();
  const isEdit = !!initial;

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("spendix:nav-hide"));
    return () => { window.dispatchEvent(new CustomEvent("spendix:nav-show")); };
  }, []);

  const [form, setForm] = useState<InvestmentFormData>({
    asset_name:      initial?.asset_name      ?? "",
    asset_type:      initial?.asset_type      ?? "stock",
    amount_invested: initial?.amount_invested ?? 0,
    current_value:   initial?.current_value   ?? null,
    investment_date: initial?.investment_date ?? today,
    notes:           initial?.notes           ?? null,
  });
  const [rawAmount, setRawAmount] = useState(initial?.amount_invested ? String(initial.amount_invested) : "");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  function set<K extends keyof InvestmentFormData>(key: K, value: InvestmentFormData[K]) {
    if (error) setError("");
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const cfg = ASSET_CONFIG[form.asset_type];
  const currentValue = form.current_value ?? form.amount_invested;
  const gain = form.amount_invested > 0 ? currentValue - form.amount_invested : null;
  const gainPct = gain !== null && form.amount_invested > 0 ? (gain / form.amount_invested) * 100 : 0;
  const canSubmit =
    !loading &&
    !guestLoading &&
    form.amount_invested > 0 &&
    form.asset_name.trim().length > 0;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (guestLoading) return;
    if (form.amount_invested <= 0) { setError(t("transactions.amount_positive")); return; }
    if (!form.asset_name.trim()) { setError(t("investments.asset_name") + " " + t("transactions.title_required")); return; }

    setLoading(true);
    setError("");
    try {
      await onSubmit({
        ...form,
        asset_name: form.asset_name.trim(),
        notes: form.notes?.trim() ? form.notes.trim() : null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.unknown_error"));
      setLoading(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      style={{
        backgroundColor: "rgba(11,15,20,0.75)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={spring}
        className="flex w-full flex-col overflow-hidden rounded-t-[2rem] sm:max-w-md sm:rounded-[1.75rem]"
        style={{
          backgroundColor: "hsl(var(--bg-card))",
          border: "1px solid hsl(var(--border))",
          maxHeight: "92dvh",
        }}
      >
        <div className="shrink-0 px-5 pb-4 pt-5" style={{ background: `${cfg.ring}12` }}>
          <div className="mb-2 sm:hidden">
            <SheetDragHandle onClose={onClose} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${cfg.bg}`}>
                <cfg.icon className={`h-5 w-5 ${cfg.color}`} />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold t1">
                  {isEdit ? t("investments.edit") : t("investments.add")}
                </h2>
                <p className="mt-0.5 text-xs t3">{t("investments.form_subtitle")}</p>
              </div>
            </div>
            <button onClick={onClose} className="rounded-xl p-2 t3 transition-all hover:bg-white/5 hover:t1">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">

            {/* 1 ── Amount (big, centered) ──────────────────── */}
            <div className="text-center">
              <p className="text-[10px] font-semibold t3 uppercase tracking-[0.14em] mb-3">
                {t("investments.amount_invested_label")}
              </p>
              <div className="relative flex items-center justify-center gap-2">
                <span className="text-xl font-bold t3 select-none">{symbol}</span>
                <input
                  type="number" inputMode="decimal" min="0.01" step="0.01"
                  value={rawAmount}
                  onChange={(e) => { setRawAmount(e.target.value); set("amount_invested", parseFloat(e.target.value) || 0); }}
                  placeholder="0.00"
                  className="text-5xl font-bold bg-transparent border-none outline-none tabular-nums text-center w-48 placeholder:text-[hsl(var(--text-3))] number-display"
                  style={{ color: rawAmount ? cfg.ring : undefined }}
                />
                {rawAmount && (
                  <button type="button" onClick={() => { setRawAmount(""); set("amount_invested", 0); }}
                    className="absolute -end-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[hsl(var(--bg-input))] flex items-center justify-center t3 hover:t1 transition-all">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <p className="mt-2 flex items-center justify-center gap-1.5 text-xs t3">
                <ArrowDownRight className="h-3.5 w-3.5 text-rose-400" />
                {t("investments.linked_transaction_hint")}
              </p>
            </div>

            {/* Separator */}
            <div className="h-px bg-[hsl(var(--border-2))]" />

            {/* 2 ── Asset name ─────────────────────────────── */}
            <div className="space-y-2">
              <label className="block text-[10px] font-semibold uppercase tracking-wide t3">
                {t("investments.asset_name")}
              </label>
              <input
                required
                value={form.asset_name}
                onChange={(e) => set("asset_name", e.target.value)}
                className="field"
                placeholder={t("investments.asset_placeholder")}
              />
            </div>

            {/* 3 ── Asset type ─────────────────────────────── */}
            <section className="space-y-2.5">
              <label className="block text-[10px] font-semibold uppercase tracking-wide t3">
                {t("investments.type")}
              </label>
              <div className="grid grid-cols-5 gap-2">
                {ASSET_TYPES.map((type) => {
                  const item = ASSET_CONFIG[type];
                  const active = form.asset_type === type;
                  return (
                    <motion.button
                      key={type} type="button"
                      onClick={() => set("asset_type", type)}
                      whileTap={{ scale: 0.95 }} transition={tapTransition}
                      className={`relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border py-3 transition-all ${
                        active ? `${item.bg} border-2` : "bg-[hsl(var(--bg-input))] border-[hsl(var(--border))]"
                      }`}
                      style={active ? { borderColor: `${item.ring}60` } : undefined}
                    >
                      {active && (
                        <span className="absolute end-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full"
                          style={{ backgroundColor: item.ring }}>
                          <Check className="h-2 w-2 text-white" strokeWidth={3.5} />
                        </span>
                      )}
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${active ? item.bg : "bg-[hsl(var(--bg-card))]"}`}>
                        <item.icon className={`h-3.5 w-3.5 ${active ? item.color : "t3"}`} />
                      </div>
                      <span className={`text-[9px] font-semibold leading-tight text-center ${active ? item.color : "t2"}`}>
                        {t(`investments.types.${type}`)}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </section>

            {/* 4 ── Date ───────────────────────────────────── */}
            <div className="space-y-2">
              <label className="block text-[10px] font-semibold uppercase tracking-wide t3">
                {t("investments.date")}
              </label>
              <div className="relative">
                <CalendarDays className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 t3" />
                <input
                  type="date" required
                  value={form.investment_date}
                  onChange={(e) => set("investment_date", e.target.value)}
                  className="field ps-9"
                />
              </div>
            </div>

            {/* 5 ── Optional details ────────────────────── */}
            <section className="space-y-4 rounded-2xl border border-[hsl(var(--border))] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide t3">{t("investments.optional_details")}</p>
                  <p className="mt-0.5 text-xs t3">{t("investments.current_value_hint")}</p>
                </div>
                {form.current_value != null && (
                  <button
                    type="button"
                    onClick={() => set("current_value", null)}
                    className="shrink-0 rounded-xl border border-[hsl(var(--border))] px-2.5 py-1.5 text-xs font-semibold t2 hover:t1"
                  >
                    {t("investments.same_as_invested")}
                  </button>
                )}
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wide t3">
                  {t("investments.current_value")}
                  <span className="ms-1 font-normal normal-case opacity-60 t3">({t("transactions.notes_optional")})</span>
                </label>
                <div className="relative">
                  <span className="absolute start-3 top-1/2 -translate-y-1/2 text-sm font-bold t3">{symbol}</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={form.current_value ?? ""}
                    onChange={(event) => set("current_value", event.target.value ? parseFloat(event.target.value) : null)}
                    className="field ps-8"
                    placeholder={t("investments.current_price_placeholder")}
                  />
                </div>
              </div>

              {gain !== null && form.amount_invested > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-2xl border px-4 py-3 ${
                    gain >= 0 ? "border-emerald-400/20 bg-emerald-400/10" : "border-rose-400/20 bg-rose-400/10"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs t2">{t("investments.gain_loss")}</span>
                    <span className={`text-sm font-bold number-display ${gain >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {gain >= 0 ? "+" : ""}{format(gain)}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full ${gain >= 0 ? "bg-emerald-400" : "bg-rose-400"}`}
                      style={{ width: `${Math.min(100, Math.abs(gainPct))}%` }}
                    />
                  </div>
                  <p className={`mt-1 text-end text-xs font-semibold number-display ${gain >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {gain >= 0 ? "+" : ""}{gainPct.toFixed(1)}%
                  </p>
                </motion.div>
              )}

              <div>
                <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wide t3">
                  {t("transactions.notes")}
                  <span className="ms-1 font-normal normal-case opacity-60 t3">({t("transactions.notes_optional")})</span>
                </label>
                <textarea
                  value={form.notes ?? ""}
                  onChange={(event) => set("notes", event.target.value || null)}
                  rows={3}
                  className="field min-h-[92px] resize-none"
                  placeholder={t("transactions.notes_placeholder")}
                />
              </div>
            </section>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-400"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <div className="shrink-0 px-5 pt-2" style={{ paddingBottom: "max(20px, calc(env(safe-area-inset-bottom, 0px) + 8px))" }}>
            <motion.button
              type="submit"
              disabled={!canSubmit}
              whileTap={{ scale: 0.97 }}
              transition={tapTransition}
              className="w-full rounded-2xl py-3.5 text-sm font-bold text-white transition-all disabled:opacity-40"
              style={{ background: `linear-gradient(135deg, ${cfg.ring}, ${cfg.ring}bb)` }}
            >
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.span
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center justify-center gap-2"
                  >
                    <Loader2 className="h-4 w-4 animate-spin" />{t("common.saving")}
                  </motion.span>
                ) : (
                  <motion.span
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center justify-center gap-2"
                  >
                    <TrendingUp className="h-4 w-4" />
                    {isEdit ? t("investments.save_edit") : t("investments.add")}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>,
    document.body
  );
}
