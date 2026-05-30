"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarClock, Car, CheckCircle2, GraduationCap, Home,
  Pencil, PiggyBank, Plane, Plus, ShieldAlert, Sparkles,
  Target, Trash2, Wallet, TrendingUp, Landmark, CreditCard,
  Zap, ChevronDown, RefreshCw, BriefcaseBusiness,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { spring } from "@/lib/motion";
import {
  useGoals, useCreateGoal, useUpdateGoal, useDeleteGoal, useContributeToGoal,
} from "@/lib/query/hooks";
import { useDebts } from "@/lib/query/hooks";
import type { Goal, GoalCategory, GoalFormData, GoalTrackingType, GoalStatus } from "@/types";

// ── Constants ─────────────────────────────────────────────────

const GOAL_CATEGORIES: GoalCategory[] = ["emergency","home","travel","education","car","retirement","other"];
const TRACKING_TYPES: GoalTrackingType[] = ["manual","savings","income","investment","debt_payoff"];

type CatCfg = { icon: React.ElementType; ring: string; color: string; bg: string };
const CAT: Record<GoalCategory, CatCfg> = {
  emergency:  { icon: ShieldAlert,       ring: "#f87171", color: "text-rose-400",    bg: "bg-rose-400/10"    },
  home:       { icon: Home,              ring: "#fbbf24", color: "text-amber-400",   bg: "bg-amber-400/10"   },
  travel:     { icon: Plane,             ring: "#22d3ee", color: "text-cyan-400",    bg: "bg-cyan-400/10"    },
  education:  { icon: GraduationCap,     ring: "#a78bfa", color: "text-purple-400",  bg: "bg-purple-400/10"  },
  car:        { icon: Car,               ring: "#60a5fa", color: "text-blue-400",    bg: "bg-blue-400/10"    },
  retirement: { icon: BriefcaseBusiness, ring: "#34d399", color: "text-emerald-400", bg: "bg-emerald-400/10" },
  other:      { icon: Sparkles,          ring: "#9ca3af", color: "text-gray-400",    bg: "bg-gray-400/10"    },
};

const TRACKING_ICONS: Record<GoalTrackingType, React.ElementType> = {
  manual:      Wallet,
  savings:     PiggyBank,
  income:      TrendingUp,
  investment:  Landmark,
  debt_payoff: CreditCard,
};

const TRACKING_COLORS: Record<GoalTrackingType, string> = {
  manual:      "#06B6D4",
  savings:     "#10B981",
  income:      "#10B981",
  investment:  "#3B82F6",
  debt_payoff: "#F59E0B",
};

const STATUS_STYLE: Record<GoalStatus, string> = {
  completed: "text-emerald-300 bg-emerald-400/10 border-emerald-400/20",
  overdue:   "text-rose-300   bg-rose-400/10   border-rose-400/20",
  due_soon:  "text-amber-300  bg-amber-400/10  border-amber-400/20",
  on_track:  "text-cyan-300   bg-cyan-400/10   border-cyan-400/20",
};

const COLORS = ["#F59E0B","#3B82F6","#8B5CF6","#10B981","#06B6D4","#F97316","#EF4444","#6366F1","#A855F7","#34D399"];

// ── Helpers ───────────────────────────────────────────────────

function todayStr() { return new Date().toISOString().slice(0, 10); }
function clamp(v: number) { return Math.max(0, Math.min(100, Math.round(v))); }

// ── Circular SVG ring ─────────────────────────────────────────

function Ring({ pct, ring, size = 64, stroke = 5 }: { pct: number; ring: string; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }} className="shrink-0">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={ring} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.6s ease" }} />
    </svg>
  );
}

// ── Goal Form Modal ───────────────────────────────────────────

interface FormState {
  title: string;
  target_amount: string;
  saved_amount: string;
  monthly_contribution: string;
  due_date: string;
  category: GoalCategory;
  tracking_type: GoalTrackingType;
  linked_debt_id: string;
  start_date: string;
  color: string;
}

function emptyForm(): FormState {
  return {
    title: "", target_amount: "", saved_amount: "0",
    monthly_contribution: "0", due_date: "", category: "emergency",
    tracking_type: "manual", linked_debt_id: "", start_date: todayStr(), color: "#10B981",
  };
}

function goalToForm(g: Goal): FormState {
  return {
    title: g.title,
    target_amount: String(g.target_amount),
    saved_amount: String(g.saved_amount),
    monthly_contribution: String(g.monthly_contribution),
    due_date: g.due_date ?? "",
    category: g.category,
    tracking_type: g.tracking_type,
    linked_debt_id: g.linked_debt_id ?? "",
    start_date: g.start_date,
    color: g.color ?? "#10B981",
  };
}

function GoalFormModal({ initial, onClose, onSubmit, debts }: {
  initial?: Goal;
  onClose: () => void;
  onSubmit: (data: GoalFormData) => void;
  debts: { id: string; person_or_entity: string; total_amount: number }[];
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<FormState>(initial ? goalToForm(initial) : emptyForm);
  const [error, setError] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const isManual = form.tracking_type === "manual";
  const isDebtPayoff = form.tracking_type === "debt_payoff";

  function set(k: keyof FormState, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  function handleSubmit() {
    if (!form.title.trim() || !form.target_amount || Number(form.target_amount) <= 0) {
      setError(t("goals.form_error")); return;
    }
    if (isDebtPayoff && !form.linked_debt_id) {
      setError(t("goals.form_error")); return;
    }
    setError("");
    onSubmit({
      title:                form.title.trim(),
      target_amount:        Number(form.target_amount),
      saved_amount:         isManual ? Number(form.saved_amount) || 0 : 0,
      monthly_contribution: Number(form.monthly_contribution) || 0,
      due_date:             form.due_date || null,
      category:             form.category,
      tracking_type:        form.tracking_type,
      linked_debt_id:       isDebtPayoff ? form.linked_debt_id || null : null,
      start_date:           form.start_date || todayStr(),
      color:                form.color,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={spring}
        className="w-full sm:max-w-lg bg-[#12121A] border border-white/10 rounded-t-3xl sm:rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/10">
          <h2 className="text-base font-bold text-white">{initial ? t("goals.edit_goal") : t("goals.new_goal")}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs font-semibold text-white/50 mb-1.5 block">{t("goals.title_field")}</label>
            <input
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
              placeholder={t("goals.title_placeholder")}
              value={form.title} onChange={(e) => set("title", e.target.value)}
            />
          </div>

          {/* Target + Color */}
          <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
            <div>
              <label className="text-xs font-semibold text-white/50 mb-1.5 block">{t("goals.target_amount")}</label>
              <input type="number" min="0" step="1"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-white/30"
                value={form.target_amount} onChange={(e) => set("target_amount", e.target.value)}
              />
            </div>
            <div className="flex gap-1.5 flex-wrap pb-0.5">
              {COLORS.map((c) => (
                <button key={c} onClick={() => set("color", c)}
                  className={`w-6 h-6 rounded-full shrink-0 ${form.color === c ? "ring-2 ring-white ring-offset-1 ring-offset-[#12121A]" : ""}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="text-xs font-semibold text-white/50 mb-1.5 block">{t("goals.category")}</label>
            <div className="flex flex-wrap gap-2">
              {GOAL_CATEGORIES.map((cat) => {
                const cfg = CAT[cat];
                const Icon = cfg.icon;
                return (
                  <button key={cat} onClick={() => set("category", cat)}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold border transition-all ${
                      form.category === cat
                        ? `${cfg.bg} ${cfg.color} border-current`
                        : "bg-white/5 text-white/50 border-white/10 hover:bg-white/10"
                    }`}>
                    <Icon size={12} />
                    {t(`goals.categories.${cat}`)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tracking type */}
          <div>
            <label className="text-xs font-semibold text-white/50 mb-1.5 block">{t("goals.tracking_type")}</label>
            <div className="space-y-1.5">
              {TRACKING_TYPES.map((tt) => {
                const Icon = TRACKING_ICONS[tt];
                const color = TRACKING_COLORS[tt];
                return (
                  <button key={tt} onClick={() => set("tracking_type", tt)}
                    className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all border ${
                      form.tracking_type === tt
                        ? "bg-white/10 border-white/20"
                        : "bg-white/5 border-white/10 hover:bg-white/8"
                    }`}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: color + "22", color }}>
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white">{t(`goals.tracking_${tt}`)}</p>
                      <p className="text-[10px] text-white/40 truncate">{t(`goals.tracking_${tt}_hint`)}</p>
                    </div>
                    {form.tracking_type === tt && (
                      <div className="w-4 h-4 rounded-full bg-white/80 flex items-center justify-center shrink-0">
                        <CheckCircle2 size={12} className="text-black" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Linked debt (only for debt_payoff) */}
          {isDebtPayoff && debts.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-white/50 mb-1.5 block">{t("goals.linked_debt")}</label>
              <select
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-white/30"
                value={form.linked_debt_id} onChange={(e) => set("linked_debt_id", e.target.value)}
              >
                <option value="">— select —</option>
                {debts.map((d) => (
                  <option key={d.id} value={d.id}>{d.person_or_entity}</option>
                ))}
              </select>
            </div>
          )}

          {/* Manual saved amount */}
          {isManual && (
            <div>
              <label className="text-xs font-semibold text-white/50 mb-1.5 block">{t("goals.saved_amount")}</label>
              <input type="number" min="0" step="1"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-white/30"
                value={form.saved_amount} onChange={(e) => set("saved_amount", e.target.value)}
              />
            </div>
          )}

          {/* Advanced */}
          <button onClick={() => setShowAdvanced((v) => !v)}
            className="flex items-center gap-2 text-xs font-semibold text-white/40 hover:text-white/70 transition-colors w-full">
            <ChevronDown size={13} className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
            Advanced
          </button>

          {showAdvanced && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-white/50 mb-1.5 block">{t("goals.due_date")}</label>
                <input type="date"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-white/30"
                  value={form.due_date} onChange={(e) => set("due_date", e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/50 mb-1.5 block">{t("goals.monthly_contribution")}</label>
                <input type="number" min="0" step="1"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-white/30"
                  value={form.monthly_contribution} onChange={(e) => set("monthly_contribution", e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/50 mb-1.5 block">{t("goals.start_date")}</label>
                <input type="date"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-white/30"
                  value={form.start_date} onChange={(e) => set("start_date", e.target.value)}
                />
              </div>
            </div>
          )}

          {error && <p className="text-xs text-rose-400">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/10 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-semibold text-white/60 hover:bg-white/5">
            {t("common.cancel")}
          </button>
          <button onClick={handleSubmit}
            className="flex-1 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-400 py-2.5 text-sm font-bold text-[#0B0F17]">
            {initial ? t("goals.edit_goal") : t("goals.create_goal")}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Goal Card ─────────────────────────────────────────────────

function GoalCard({ goal, onEdit, onDelete, onContribute, format, t }: {
  goal: Goal;
  onEdit: () => void;
  onDelete: () => void;
  onContribute: (amount: number) => void;
  format: (n: number) => string;
  t: (k: string, p?: Record<string, string | number>) => string;
}) {
  const cfg       = CAT[goal.category];
  const CatIcon   = cfg.icon;
  const TrkIcon   = TRACKING_ICONS[goal.tracking_type];
  const trkColor  = TRACKING_COLORS[goal.tracking_type];
  const pct       = goal.progress;
  const isManual  = goal.tracking_type === "manual";
  const isComplete = goal.status === "completed";

  const monthsLeft = goal.days_until_due != null && goal.days_until_due > 0
    ? Math.max(1, Math.ceil(goal.days_until_due / 30)) : null;
  const requiredMonthly = monthsLeft && goal.remaining > 0 ? goal.remaining / monthsLeft : null;
  const projectedMonths = goal.monthly_contribution > 0 && goal.remaining > 0
    ? Math.ceil(goal.remaining / goal.monthly_contribution) : null;
  const contributeAmount = Math.min(goal.remaining, Math.max(goal.monthly_contribution, 0));

  return (
    <motion.article layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
      transition={spring} className="card p-5 flex flex-col gap-4">
      {/* Top row */}
      <div className="flex items-start gap-4">
        <div className="relative shrink-0" style={{ width: 64, height: 64 }}>
          <Ring pct={pct} ring={goal.color ?? cfg.ring} size={64} stroke={5} />
          <div className={`absolute inset-0 flex items-center justify-center rounded-full ${cfg.bg}`} style={{ margin: 7 }}>
            <CatIcon className={`h-4 w-4 ${cfg.color}`} />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLE[goal.status]}`}>
              {t(`goals.${goal.status === "completed" ? "completed_status" : goal.status}`)}
            </span>
            <span className={`rounded-lg px-2 py-0.5 text-[10px] font-semibold ${cfg.bg} ${cfg.color}`}>
              {t(`goals.categories.${goal.category}`)}
            </span>
            {!isManual && (
              <span className="rounded-lg px-2 py-0.5 text-[10px] font-semibold flex items-center gap-1"
                style={{ backgroundColor: trkColor + "22", color: trkColor }}>
                <Zap size={9} />
                {t("goals.auto_tracked")}
              </span>
            )}
          </div>
          <h2 className="text-base font-bold t1 truncate">{goal.title}</h2>
          {goal.due_date && (
            <p className="mt-0.5 text-xs t3 flex items-center gap-1">
              <CalendarClock className="h-3 w-3" />
              {goal.due_date}
              {goal.days_until_due != null && (
                <span className="t3">· {goal.days_until_due > 0 ? `${goal.days_until_due}d` : `${Math.abs(goal.days_until_due)}d ago`}</span>
              )}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button onClick={onEdit} className="icon-button"><Pencil className="h-3.5 w-3.5" /></button>
          <button onClick={onDelete} className="icon-button text-rose-300 hover:bg-rose-400/10">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Progress */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs t3">
            <TrkIcon size={11} style={{ color: trkColor }} />
            <span>{t(`goals.tracking_${goal.tracking_type}`)}</span>
          </div>
          <span className="text-sm font-bold t1 number-display">{clamp(pct)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[hsl(var(--bg-input))]">
          <div className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${goal.color ?? cfg.ring}99, ${goal.color ?? cfg.ring})` }} />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] t3 number-display">{format(goal.computed_saved)}</span>
          <span className="text-[10px] t3 number-display">{format(goal.target_amount)}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-[hsl(var(--border-2))] bg-[hsl(var(--bg-input))] p-3">
          <p className="text-[10px] font-semibold t3">{t("goals.remaining")}</p>
          <p className="mt-1 text-sm font-bold text-amber-300 number-display">{format(goal.remaining)}</p>
        </div>
        <div className="rounded-2xl border border-[hsl(var(--border-2))] bg-[hsl(var(--bg-input))] p-3">
          <p className="text-[10px] font-semibold t3">{t("goals.monthly_need")}</p>
          <p className="mt-1 text-sm font-bold text-cyan-300 number-display">
            {requiredMonthly != null ? format(requiredMonthly) : "—"}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs t3 leading-tight">
          {projectedMonths === null
            ? t("goals.no_contribution")
            : t("goals.projected_months", { count: projectedMonths })}
        </p>
        {isManual ? (
          <button
            onClick={() => onContribute(contributeAmount)}
            disabled={isComplete || contributeAmount <= 0}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all shrink-0 ${cfg.bg} ${cfg.color} hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30`}>
            <Plus className="h-3 w-3" />
            {format(contributeAmount)}
          </button>
        ) : (
          <div className="flex items-center gap-1 text-[10px] text-white/30">
            <RefreshCw size={10} />
            <span>{t("goals.auto_tracked")}</span>
          </div>
        )}
      </div>
    </motion.article>
  );
}

// ── Main page ─────────────────────────────────────────────────

export default function GoalsPage() {
  const { t } = useTranslation();
  const { format } = useCurrency();

  const { data: goals = [], isLoading } = useGoals();
  const { data: debtsData } = useDebts();
  const debts = debtsData?.debts ?? [];
  const createGoal     = useCreateGoal();
  const updateGoal     = useUpdateGoal();
  const deleteGoal     = useDeleteGoal();
  const contribute     = useContributeToGoal();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<Goal | undefined>();

  const debtList = useMemo(() =>
    debts.map((d) => ({ id: d.id, person_or_entity: d.person_or_entity, total_amount: d.total_amount })),
    [debts]
  );

  const summary = useMemo(() => {
    const totalTarget       = goals.reduce((s, g) => s + g.target_amount, 0);
    const totalSaved        = goals.reduce((s, g) => s + g.computed_saved, 0);
    const monthlyCommitment = goals.reduce((s, g) => s + g.monthly_contribution, 0);
    const completed         = goals.filter((g) => g.status === "completed").length;
    const overallProgress   = totalTarget > 0 ? clamp((totalSaved / totalTarget) * 100) : 0;
    const nextGoal          = [...goals]
      .filter((g) => g.status !== "completed" && g.due_date)
      .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))[0];
    return { totalTarget, totalSaved, totalRemaining: Math.max(0, totalTarget - totalSaved), monthlyCommitment, completed, overallProgress, nextGoal };
  }, [goals]);

  function handleSubmit(data: GoalFormData) {
    if (editing) {
      updateGoal.mutate({ id: editing.id, data });
    } else {
      createGoal.mutate(data);
    }
    setShowForm(false);
    setEditing(undefined);
  }

  const kpis = [
    { label: t("goals.total_saved"),  value: format(summary.totalSaved),     icon: PiggyBank,   color: "text-emerald-400", bg: "bg-emerald-400/10" },
    { label: t("goals.total_target"), value: format(summary.totalTarget),     icon: Target,      color: "text-cyan-400",    bg: "bg-cyan-400/10"    },
    { label: t("goals.remaining"),    value: format(summary.totalRemaining),  icon: Wallet,      color: "text-amber-400",   bg: "bg-amber-400/10"   },
    { label: t("goals.completed"),    value: `${summary.completed}/${goals.length}`, icon: CheckCircle2, color: "text-purple-400", bg: "bg-purple-400/10" },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold t1">{t("goals.title")}</h1>
          <p className="mt-0.5 text-sm t2">{t("goals.subtitle")}</p>
        </div>
        <button
          onClick={() => { setEditing(undefined); setShowForm(true); }}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-400 px-4 py-2.5 text-sm font-semibold text-[#0B0F17] transition-all pressable shrink-0">
          <Plus className="h-3.5 w-3.5" />
          {t("goals.new_goal")}
        </button>
      </div>

      {/* Banner */}
      <div className="relative overflow-hidden rounded-[1.5rem] border border-[hsl(var(--border))] p-5 sm:p-6"
        style={{ background: "linear-gradient(135deg, #10202A 0%, #132218 48%, #231E12 100%)" }}>
        <div className="relative z-10 grid gap-5 lg:grid-cols-[1fr_220px] lg:items-center">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-white/45">
              {t("goals.overall_progress")}
            </p>
            <div className="flex items-end gap-4">
              <p className="text-4xl font-black text-white number-display">{summary.overallProgress}%</p>
              <p className="mb-1 text-sm text-white/55">{format(summary.totalSaved)} / {format(summary.totalTarget)}</p>
            </div>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-emerald-300 to-amber-300 transition-all"
                style={{ width: `${summary.overallProgress}%` }} />
            </div>
            <p className="mt-3 text-xs text-white/40">
              {t("goals.monthly_commitment_label")}: <span className="font-bold text-white/70">{format(summary.monthlyCommitment)}</span>
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-2 mb-3">
              <CalendarClock className="h-4 w-4 text-amber-300" />
              <p className="text-xs font-bold uppercase tracking-wide text-white/45">{t("goals.next_deadline")}</p>
            </div>
            {summary.nextGoal ? (
              <>
                <p className="truncate text-base font-bold text-white">{summary.nextGoal.title}</p>
                <p className="mt-1 text-sm text-white/60">{summary.nextGoal.due_date}</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-amber-300 transition-all"
                    style={{ width: `${summary.nextGoal.progress}%` }} />
                </div>
              </>
            ) : (
              <p className="text-sm text-white/60">{t("goals.all_complete")}</p>
            )}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((item) => (
          <div key={item.label} className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wide t3">{item.label}</p>
              <div className={`rounded-lg p-1.5 ${item.bg}`}><item.icon className={`h-3.5 w-3.5 ${item.color}`} /></div>
            </div>
            <p className={`text-lg font-bold number-display ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center h-32 text-white/40 text-sm">
          {t("common.loading")}
        </div>
      )}

      {/* Empty */}
      {!isLoading && goals.length === 0 && (
        <div className="card py-16 text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/10">
            <Target className="h-6 w-6 text-amber-400" />
          </div>
          <p className="font-bold t1">{t("goals.empty_title")}</p>
          <p className="text-sm t3 max-w-xs mx-auto">{t("goals.empty_body")}</p>
          <button
            onClick={() => { setEditing(undefined); setShowForm(true); }}
            className="mx-auto mt-2 flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-400 px-4 py-2.5 text-sm font-semibold text-[#0B0F17]">
            <Plus className="h-3.5 w-3.5" />
            {t("goals.new_goal")}
          </button>
        </div>
      )}

      {/* Goals grid */}
      {!isLoading && goals.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AnimatePresence initial={false}>
            {goals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onEdit={() => { setEditing(goal); setShowForm(true); }}
                onDelete={() => deleteGoal.mutate(goal.id)}
                onContribute={(amount) => contribute.mutate({ id: goal.id, amount })}
                format={format}
                t={t}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showForm && (
          <GoalFormModal
            key="goal-form"
            initial={editing}
            onClose={() => { setShowForm(false); setEditing(undefined); }}
            onSubmit={handleSubmit}
            debts={debtList}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
