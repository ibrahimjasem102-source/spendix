"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, TrendingUp, Bitcoin, BarChart2, Home, Package, Check, Loader2,
} from "lucide-react";
import { Investment, InvestmentFormData, AssetType } from "@/types";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { spring, tapTransition } from "@/lib/motion";

interface Props {
  initial?: Investment;
  onSubmit: (data: InvestmentFormData) => Promise<void>;
  onClose: () => void;
}

const today = new Date().toISOString().split("T")[0];

const ASSET_CONFIG: Record<AssetType, { icon: React.ElementType; color: string; bg: string; ring: string }> = {
  stock:       { icon: TrendingUp, color: "text-purple-400", bg: "bg-purple-400/10", ring: "#a78bfa" },
  crypto:      { icon: Bitcoin,    color: "text-amber-400",  bg: "bg-amber-400/10",  ring: "#fbbf24" },
  etf:         { icon: BarChart2,  color: "text-cyan-400",   bg: "bg-cyan-400/10",   ring: "#22d3ee" },
  real_estate: { icon: Home,       color: "text-emerald-400",bg: "bg-emerald-400/10",ring: "#34d399" },
  other:       { icon: Package,    color: "text-gray-400",   bg: "bg-gray-400/10",   ring: "#9ca3af" },
};

const ASSET_TYPES: AssetType[] = ["stock", "crypto", "etf", "real_estate", "other"];

export default function InvestmentForm({ initial, onSubmit, onClose }: Props) {
  const { t } = useTranslation();
  const { symbol } = useCurrency();
  const isEdit = !!initial;

  const [form, setForm] = useState<InvestmentFormData>({
    asset_name:      initial?.asset_name      ?? "",
    asset_type:      initial?.asset_type      ?? "stock",
    amount_invested: initial?.amount_invested ?? 0,
    current_value:   initial?.current_value   ?? null,
    investment_date: initial?.investment_date ?? today,
    notes:           initial?.notes           ?? null,
  });
  const [rawAmount, setRawAmount]   = useState(initial?.amount_invested ? String(initial.amount_invested) : "");
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");

  function set<K extends keyof InvestmentFormData>(k: K, v: InvestmentFormData[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  const cfg = ASSET_CONFIG[form.asset_type];

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (form.amount_invested <= 0) { setError(t("transactions.amount_positive")); return; }
    if (!form.asset_name.trim())   { setError(t("investments.asset_name") + " " + t("transactions.title_required")); return; }
    setLoading(true); setError("");
    try { await onSubmit(form); onClose(); }
    catch (err) { setError(err instanceof Error ? err.message : t("common.unknown_error")); setLoading(false); }
  }

  const gain = form.current_value != null ? form.current_value - form.amount_invested : null;

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
        <div className="shrink-0 relative px-5 pt-5 pb-4" style={{ background: `${cfg.ring}12` }}>
          <div className="w-10 h-1 rounded-full bg-white/10 mx-auto mb-4 sm:hidden" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-2xl ${cfg.bg}`}>
                <cfg.icon className={`w-5 h-5 ${cfg.color}`} />
              </div>
              <div>
                <h2 className="text-sm font-bold t1">
                  {isEdit ? t("investments.edit") : t("investments.add")}
                </h2>
                <p className="text-xs t3">{t(`investments.types.${form.asset_type}`)}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-xl t3 hover:t1 hover:bg-white/5 transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto min-h-0 flex flex-col">
          <div className="px-5 py-4 space-y-5 flex-1">

            {/* Asset type selector */}
            <div>
              <label className="block text-xs font-medium t3 uppercase tracking-wide mb-2.5">
                {t("investments.type")}
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {ASSET_TYPES.map((type) => {
                  const c = ASSET_CONFIG[type];
                  const active = form.asset_type === type;
                  return (
                    <motion.button key={type} type="button"
                      onClick={() => set("asset_type", type)}
                      whileTap={{ scale: 0.95 }} transition={tapTransition}
                      className={`flex flex-col items-center gap-1.5 p-2.5 rounded-2xl border transition-all relative ${
                        active ? `${c.bg} border-2` : "bg-[hsl(var(--bg-input))] border-[hsl(var(--border))]"
                      }`}
                      style={active ? { borderColor: `${c.ring}60` } : {}}>
                      {active && (
                        <span className="absolute top-0.5 end-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: c.ring }}>
                          <Check className="w-2 h-2 text-white" strokeWidth={3.5} />
                        </span>
                      )}
                      <c.icon className={`w-4 h-4 ${active ? c.color : "t3"}`} />
                      <span className={`text-[9px] font-semibold leading-tight text-center ${active ? c.color : "t3"}`}>
                        {t(`investments.types.${type}`)}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Asset name */}
            <div>
              <label className="block text-xs font-medium t3 uppercase tracking-wide mb-2">
                {t("investments.asset_name")}
              </label>
              <input required value={form.asset_name}
                onChange={(e) => set("asset_name", e.target.value)}
                className="field" placeholder={t("investments.asset_placeholder")} />
            </div>

            {/* Amount invested — large */}
            <div>
              <label className="block text-xs font-medium t3 uppercase tracking-wide mb-2">
                {t("investments.amount_invested_label")}
              </label>
              <div className="relative">
                <span className="absolute start-4 top-1/2 -translate-y-1/2 text-xl font-bold t3">{symbol}</span>
                <input
                  type="number" inputMode="decimal" min="0.01" step="0.01"
                  value={rawAmount}
                  onChange={(e) => { setRawAmount(e.target.value); set("amount_invested", parseFloat(e.target.value) || 0); }}
                  placeholder="0.00"
                  className="w-full ps-10 pe-4 py-4 text-3xl font-bold number-display rounded-2xl bg-[hsl(var(--bg-input))] border focus:outline-none transition-all"
                  style={{
                    color: rawAmount ? cfg.ring : undefined,
                    borderColor: rawAmount ? `${cfg.ring}40` : "hsl(var(--border))",
                  }} />
              </div>
            </div>

            {/* Current value + date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium t3 uppercase tracking-wide mb-2">
                  {t("investments.current_price")}
                  <span className="ms-1 normal-case t3 font-normal opacity-60">({t("transactions.notes_optional")})</span>
                </label>
                <input type="number" min="0" step="0.01" inputMode="decimal"
                  value={form.current_value ?? ""}
                  onChange={(e) => set("current_value", e.target.value ? parseFloat(e.target.value) : null)}
                  className="field" placeholder={t("investments.current_price_placeholder")} />
              </div>
              <div>
                <label className="block text-xs font-medium t3 uppercase tracking-wide mb-2">
                  {t("investments.date")}
                </label>
                <input type="date" required value={form.investment_date}
                  onChange={(e) => set("investment_date", e.target.value)} className="field" />
              </div>
            </div>

            {/* Gain preview */}
            {gain !== null && form.amount_invested > 0 && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className={`flex items-center justify-between px-4 py-3 rounded-2xl border ${
                  gain >= 0 ? "bg-emerald-400/8 border-emerald-400/20" : "bg-rose-400/8 border-rose-400/20"
                }`}>
                <span className="text-xs t2">{t("investments.gain_loss")}</span>
                <span className={`text-sm font-bold number-display ${gain >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {gain >= 0 ? "+" : ""}{symbol}{gain.toFixed(2)} ({gain >= 0 ? "+" : ""}{form.amount_invested > 0 ? ((gain / form.amount_invested) * 100).toFixed(1) : 0}%)
                </span>
              </motion.div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium t3 uppercase tracking-wide mb-2">
                {t("transactions.notes")}
                <span className="ms-1 normal-case t3 font-normal opacity-60">({t("transactions.notes_optional")})</span>
              </label>
              <input value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value || null)}
                className="field" placeholder={t("transactions.notes_placeholder")} />
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
            <motion.button type="submit" disabled={loading || form.amount_invested <= 0}
              whileTap={{ scale: 0.97 }} transition={tapTransition}
              className="w-full py-3.5 rounded-2xl text-sm font-bold text-white transition-all disabled:opacity-40"
              style={{ background: `linear-gradient(135deg, ${cfg.ring}, ${cfg.ring}bb)` }}>
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.span key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />{t("common.saving")}
                  </motion.span>
                ) : (
                  <motion.span key="i" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center justify-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    {isEdit ? t("investments.save_edit") : t("investments.add")}
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
