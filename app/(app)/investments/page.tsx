"use client";

import { useState, useMemo } from "react";
import {
  Plus, Pencil, Trash2, TrendingUp, TrendingDown,
  Wallet, Percent, Loader2, Bitcoin, BarChart2, Home, Package, ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { type Investment, type InvestmentFormData, type AssetType } from "@/types";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { useToast } from "@/hooks/useToast";
import ToastList from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";
import InvestmentForm from "@/components/investments/InvestmentForm";
import PortfolioChart from "@/components/investments/PortfolioChart";
import {
  useInvestments, usePortfolioHistory,
  useCreateInvestment, useUpdateInvestment, useDeleteInvestment,
} from "@/lib/query/hooks";
import { spring, tapTransition } from "@/lib/motion";

const ASSET_CONFIG: Record<AssetType, {
  icon: React.ElementType; color: string; bg: string; ring: string; bar: string;
}> = {
  stock:       { icon: TrendingUp, color: "text-purple-400",  bg: "bg-purple-400/10",  ring: "#a78bfa", bar: "bg-purple-400"  },
  crypto:      { icon: Bitcoin,    color: "text-amber-400",   bg: "bg-amber-400/10",   ring: "#fbbf24", bar: "bg-amber-400"   },
  etf:         { icon: BarChart2,  color: "text-cyan-400",    bg: "bg-cyan-400/10",    ring: "#22d3ee", bar: "bg-cyan-400"    },
  real_estate: { icon: Home,       color: "text-emerald-400", bg: "bg-emerald-400/10", ring: "#34d399", bar: "bg-emerald-400" },
  other:       { icon: Package,    color: "text-gray-400",    bg: "bg-gray-400/10",    ring: "#9ca3af", bar: "bg-gray-400"    },
};

const ASSET_TYPES: AssetType[] = ["stock", "crypto", "etf", "real_estate", "other"];

export default function InvestmentsPage() {
  const { t, formatDate } = useTranslation();
  const { format }        = useCurrency();
  const { toasts, addToast, dismiss } = useToast();

  const [showForm,   setShowForm]   = useState(false);
  const [editing,    setEditing]    = useState<Investment | undefined>();
  const [confirmId,  setConfirmId]  = useState<string | null>(null);
  const [activeType, setActiveType] = useState<AssetType | "all">("all");

  const { data: investments = [], isLoading } = useInvestments();
  const { data: portfolioHistory = [] }       = usePortfolioHistory();

  const createMut = useCreateInvestment();
  const updateMut = useUpdateInvestment();
  const deleteMut = useDeleteInvestment();

  async function handleSubmit(data: InvestmentFormData) {
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, data });
        addToast(t("investments.updated"), "success");
      } else {
        await createMut.mutateAsync(data);
        addToast(t("investments.created"), "success");
      }
      setEditing(undefined);
      setShowForm(false);
    } catch {
      addToast(t("investments.save_failed"), "error");
      throw new Error("submit failed");
    }
  }

  async function handleDelete() {
    if (!confirmId) return;
    const id = confirmId;
    setConfirmId(null);
    try {
      await deleteMut.mutateAsync(id);
      addToast(t("investments.deleted"), "success");
    } catch {
      addToast(t("investments.delete_failed"), "error");
    }
  }

  // ── Aggregates ────────────────────────────────────────────────
  const totalInvested = useMemo(
    () => investments.reduce((s, i) => s + Number(i.amount_invested), 0),
    [investments],
  );
  const currentValue = useMemo(
    () => investments.reduce((s, i) => s + Number(i.current_value ?? i.amount_invested), 0),
    [investments],
  );
  const totalProfit = currentValue - totalInvested;
  const returnPct   = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;
  const isPositive  = totalProfit >= 0;

  // Allocation breakdown
  const allocation = useMemo(() => {
    const total = currentValue || 1;
    return ASSET_TYPES
      .map((type) => {
        const val = investments
          .filter((i) => i.asset_type === type)
          .reduce((s, i) => s + Number(i.current_value ?? i.amount_invested), 0);
        return { type, value: val, pct: (val / total) * 100 };
      })
      .filter((a) => a.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [investments, currentValue]);

  // Filtered list
  const filtered = useMemo(
    () => (activeType === "all" ? investments : investments.filter((i) => i.asset_type === activeType)),
    [investments, activeType],
  );

  const deletingId = deleteMut.isPending ? (deleteMut.variables as string) : null;

  const kpis = [
    { label: t("investments.total_invested"), value: format(totalInvested),  icon: Wallet,                                  color: "text-cyan-400",    bg: "bg-cyan-400/10"    },
    { label: t("investments.current_value"),  value: format(currentValue),   icon: TrendingUp,                              color: "text-purple-400",  bg: "bg-purple-400/10"  },
    { label: t("investments.total_profit"),   value: (isPositive ? "+" : "") + format(Math.abs(totalProfit)), icon: isPositive ? TrendingUp : TrendingDown, color: isPositive ? "text-emerald-400" : "text-rose-400", bg: isPositive ? "bg-emerald-400/10" : "bg-rose-400/10" },
    { label: t("investments.return"),         value: `${returnPct >= 0 ? "+" : ""}${returnPct.toFixed(1)}%`,  icon: Percent,                                color: returnPct >= 0 ? "text-emerald-400" : "text-rose-400", bg: returnPct >= 0 ? "bg-emerald-400/10" : "bg-rose-400/10" },
  ];

  return (
    <div className="space-y-5">

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold t1">{t("investments.title")}</h1>
          <p className="text-sm t2 mt-0.5">{t("investments.subtitle")}</p>
        </div>
        <motion.button
          onClick={() => { setEditing(undefined); setShowForm(true); }}
          whileTap={{ scale: 0.95 }} transition={tapTransition}
          className="flex items-center gap-2 px-4 py-2.5 text-white rounded-xl text-sm font-semibold pressable"
          style={{ background: "linear-gradient(135deg, #7C3AED, #6D28D9)" }}>
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t("investments.add")}</span>
          <span className="sm:hidden">{t("common.add")}</span>
        </motion.button>
      </div>

      {/* ── Portfolio Hero ────────────────────────────────────── */}
      {investments.length > 0 && (
        <div
          className="relative rounded-[1.5rem] overflow-hidden p-6"
          style={{
            background: isPositive
              ? "linear-gradient(135deg, #1A0F3A 0%, #0E1F3A 50%, #0B3D2A 100%)"
              : "linear-gradient(135deg, #3D0B1A 0%, #1A0F0B 50%, #1A0F3A 100%)",
          }}>
          <div
            className="absolute top-0 end-0 w-64 h-64 rounded-full opacity-15 blur-3xl pointer-events-none"
            style={{ background: isPositive ? "#7C3AED" : "#F43F5E", transform: "translate(30%, -30%)" }} />
          <div className="relative z-10">
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.15em] mb-2">
              {t("investments.portfolio_value")}
            </p>
            <p className="text-4xl font-bold text-white number-display mb-1">{format(currentValue)}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`text-sm font-semibold ${isPositive ? "text-emerald-300" : "text-rose-300"}`}>
                {isPositive ? "▲" : "▼"} {isPositive ? "+" : ""}{format(totalProfit)}
                {" "}({returnPct >= 0 ? "+" : ""}{returnPct.toFixed(1)}%)
              </span>
              <span className="text-white/30 text-xs">
                · {format(totalInvested)} {t("investments.total_invested").toLowerCase()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── KPIs ─────────────────────────────────────────────── */}
      {investments.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpis.map((k) => (
            <div key={k.label} className="card-elevated p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] t3 uppercase tracking-wide font-semibold leading-tight">{k.label}</p>
                <div className={`p-1.5 rounded-lg ${k.bg} shrink-0`}>
                  <k.icon className={`w-3 h-3 ${k.color}`} />
                </div>
              </div>
              <p className={`text-lg font-bold number-display ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Allocation + Chart ────────────────────────────────── */}
      {investments.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.6fr]">

          {/* Allocation */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold t1 mb-4">{t("investments.allocation")}</h3>
            <div className="space-y-4">
              {allocation.map(({ type, value, pct }) => {
                const cfg = ASSET_CONFIG[type as AssetType] ?? ASSET_CONFIG.other;
                return (
                  <div key={type}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${cfg.bg}`}>
                          <cfg.icon className={`w-3 h-3 ${cfg.color}`} />
                        </div>
                        <span className="text-xs font-medium t2">
                          {t(`investments.types.${type}`)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs t3 number-display">{format(value)}</span>
                        <span className="text-xs font-bold t1 number-display w-10 text-end">
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className={`h-full rounded-full ${cfg.bar}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chart */}
          <div className="card p-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold t1">{t("investments.portfolio_value")}</h3>
              <p className="text-xs t3 mt-0.5">{t("investments.over_time")}</p>
            </div>
            <PortfolioChart data={portfolioHistory} />
          </div>
        </div>
      )}

      {/* ── Assets list ───────────────────────────────────────── */}
      <div className="card overflow-hidden">

        {/* List header + type filter tabs */}
        <div className="px-5 pt-4 border-b border-[hsl(var(--border))]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold t1">
              {t("investments.assets_count", { count: investments.length })}
            </h3>
          </div>

          {investments.length > 0 && (
            <div className="tabs-row">
              <button
                onClick={() => setActiveType("all")}
                className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                  activeType === "all"
                    ? "bg-purple-400/15 text-purple-400 border-purple-400/30"
                    : "border-[hsl(var(--border))] t3 hover:t2"
                }`}>
                {t("common.all")}
              </button>
              {ASSET_TYPES.filter((type) => investments.some((i) => i.asset_type === type)).map((type) => {
                const cfg    = ASSET_CONFIG[type];
                const active = activeType === type;
                return (
                  <button
                    key={type}
                    onClick={() => setActiveType(active ? "all" : type)}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                      active ? cfg.bg : "border-[hsl(var(--border))] t3 hover:t2"
                    }`}
                    style={active ? { borderColor: `${cfg.ring}50`, color: cfg.ring } : {}}>
                    <cfg.icon className="w-3 h-3" />
                    {t(`investments.types.${type}`)}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="py-16 flex items-center justify-center gap-2 t3">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">{t("common.loading")}</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center px-5">
            <div className="w-14 h-14 rounded-2xl bg-purple-400/10 flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-7 h-7 text-purple-400" />
            </div>
            <p className="text-sm font-medium t2 mb-1">
              {activeType === "all"
                ? t("investments.no_data")
                : `${t("common.no_data")} — ${t(`investments.types.${activeType}`)}`}
            </p>
            {activeType === "all" && (
              <button
                onClick={() => setShowForm(true)}
                className="text-sm text-purple-400 hover:underline mt-1">
                {t("investments.add")}
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[hsl(var(--border))]">
            <AnimatePresence initial={false}>
              {filtered.map((inv) => {
                const cfg      = ASSET_CONFIG[inv.asset_type as AssetType] ?? ASSET_CONFIG.other;
                const cv       = Number(inv.current_value ?? inv.amount_invested);
                const ai       = Number(inv.amount_invested);
                const pl       = cv - ai;
                const plPct    = ai > 0 ? (pl / ai) * 100 : 0;
                const profit   = pl >= 0;
                const isDeleting = deletingId === inv.id;

                return (
                  <motion.div
                    key={inv.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: isDeleting ? 0.4 : 1 }}
                    exit={{ opacity: 0, height: 0, overflow: "hidden" }}
                    transition={spring}
                    className={`p-5 ${isDeleting ? "pointer-events-none" : ""}`}>

                    {/* Row 1: icon + name + P&L */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2.5 rounded-2xl ${cfg.bg} shrink-0`}>
                          <cfg.icon className={`w-4 h-4 ${cfg.color}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold t1 truncate">{inv.asset_name}</p>
                          <span
                            className="text-[11px] font-semibold px-2 py-0.5 rounded-lg"
                            style={{ backgroundColor: `${cfg.ring}18`, color: cfg.ring }}>
                            {t(`investments.types.${inv.asset_type}`)}
                          </span>
                        </div>
                      </div>
                      <div className="text-end shrink-0">
                        <p className={`text-sm font-bold number-display ${profit ? "text-emerald-400" : "text-rose-400"}`}>
                          {profit ? "+" : ""}{format(pl)}
                        </p>
                        <p className={`text-xs number-display opacity-70 ${profit ? "text-emerald-400" : "text-rose-400"}`}>
                          {profit ? "+" : ""}{plPct.toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    {/* Row 2: invested → current + date */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="t3 number-display">{format(ai)}</span>
                        <ArrowRight className="w-3 h-3 t3 shrink-0" />
                        <span className="t1 font-semibold number-display">{format(cv)}</span>
                      </div>
                      <span className="text-xs t3">{formatDate(inv.investment_date)}</span>
                    </div>

                    {inv.notes && (
                      <p className="text-xs t3 mb-3 leading-relaxed">{inv.notes}</p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setEditing(inv); setShowForm(true); }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-[hsl(var(--border))] text-xs font-medium t2 hover:t1 transition-all">
                        <Pencil className="w-3 h-3" />{t("common.edit")}
                      </button>
                      <button
                        onClick={() => setConfirmId(inv.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-rose-400/20 text-xs font-medium text-rose-400 hover:bg-rose-400/8 transition-all">
                        {isDeleting
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Trash2 className="w-3 h-3" />}
                        {t("common.delete")}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── Modals ───────────────────────────────────────────── */}
      <AnimatePresence>
        {showForm && (
          <InvestmentForm
            initial={editing}
            onSubmit={handleSubmit}
            onClose={() => { setShowForm(false); setEditing(undefined); }}
          />
        )}
      </AnimatePresence>

      {confirmId && (
        <ConfirmModal
          message={t("investments.confirm_delete_msg")}
          loading={deleteMut.isPending}
          onConfirm={handleDelete}
          onCancel={() => setConfirmId(null)}
        />
      )}

      <ToastList toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
