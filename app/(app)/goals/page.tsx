"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarClock, Car, CheckCircle2, GraduationCap, Home,
  Pencil, PiggyBank, Plane, Plus, ShieldAlert, Sparkles,
  Target, Trash2, Wallet, TrendingUp, Landmark, CreditCard,
  ChevronDown, BriefcaseBusiness, Clock,
  ChevronRight, X, Info, AlertTriangle, Flag,
} from "lucide-react";
import { useTranslation, type Direction } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { spring } from "@/lib/motion";
import {
  useGoals, useCreateGoal, useUpdateGoal, useDeleteGoal, useContributeToGoal,
  useDebts,
} from "@/lib/query/hooks";
import ConfirmModal from "@/components/ui/ConfirmModal";
import SheetDragHandle from "@/components/ui/SheetDragHandle";
import GoalMilestonesProgress from "@/components/goals/GoalMilestonesProgress";
import type { Goal, GoalCategory, GoalFormData, GoalMilestone, GoalTrackingType, GoalStatus } from "@/types";

// ── Constants ─────────────────────────────────────────────────

const GOAL_CATEGORIES: GoalCategory[]   = ["emergency","home","travel","education","car","retirement","other"];
const TRACKING_TYPES: GoalTrackingType[] = ["manual","income","investment","debt_payoff"];

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

const STATUS_CFG: Record<GoalStatus, { label: string; color: string; bg: string; icon: React.ElementType } | null> = {
  on_track:  null,
  completed: null,
  due_soon:  { label: "goals.status_due_soon",  color: "text-amber-400",  bg: "bg-amber-400/10",  icon: Clock        },
  overdue:   { label: "goals.status_overdue",   color: "text-rose-400",   bg: "bg-rose-400/10",   icon: AlertTriangle },
};

const COLORS = ["#F59E0B","#3B82F6","#8B5CF6","#10B981","#06B6D4","#F97316","#EF4444","#6366F1","#A855F7","#34D399"];

function todayStr() { return new Date().toISOString().slice(0, 10); }
function clamp(v: number) { return Math.max(0, Math.min(100, Math.round(v))); }

// ── Goal form modal ───────────────────────────────────────────

interface MilestoneRow {
  id: string;
  label: string;
  amount: string;
}

interface FormState {
  title: string; target_amount: string; saved_amount: string;
  monthly_contribution: string; due_date: string; category: GoalCategory;
  tracking_type: GoalTrackingType; linked_debt_id: string;
  start_date: string; color: string; notes: string;
  milestones: MilestoneRow[];
}

function emptyForm(): FormState {
  return {
    title: "", target_amount: "", saved_amount: "0",
    monthly_contribution: "0", due_date: "", category: "emergency",
    tracking_type: "manual", linked_debt_id: "", start_date: todayStr(),
    color: "#10B981", notes: "", milestones: [],
  };
}

function goalToForm(g: Goal): FormState {
  return {
    title: g.title, target_amount: String(g.target_amount),
    saved_amount: String(g.saved_amount), monthly_contribution: String(g.monthly_contribution),
    due_date: g.due_date ?? "", category: g.category, tracking_type: g.tracking_type,
    linked_debt_id: g.linked_debt_id ?? "", start_date: g.start_date,
    color: g.color ?? "#10B981", notes: g.notes ?? "",
    milestones: (g.milestones ?? []).map((m) => ({ id: m.id, label: m.label, amount: String(m.amount) })),
  };
}

function uid() { return Math.random().toString(36).slice(2, 9); }

function GoalFormModal({ initial, onClose, onSubmit, debts, saving, saveError }: {
  initial?: Goal;
  onClose: () => void;
  onSubmit: (data: GoalFormData) => void;
  debts: { id: string; person_or_entity: string; total_amount: number }[];
  saving?: boolean;
  saveError?: string;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<FormState>(initial ? goalToForm(initial) : emptyForm);
  const [error, setError] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const isManual     = form.tracking_type === "manual";
  const isDebtPayoff = form.tracking_type === "debt_payoff";

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("spendix:nav-hide"));
    return () => { window.dispatchEvent(new CustomEvent("spendix:nav-show")); };
  }, []);

  function set(k: keyof FormState, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  function addMilestone() {
    setForm((f) => ({
      ...f,
      milestones: [...f.milestones, { id: uid(), label: "", amount: "" }],
    }));
  }

  function updateMilestone(id: string, key: "label" | "amount", val: string) {
    setForm((f) => ({
      ...f,
      milestones: f.milestones.map((m) => m.id === id ? { ...m, [key]: val } : m),
    }));
  }

  function removeMilestone(id: string) {
    setForm((f) => ({ ...f, milestones: f.milestones.filter((m) => m.id !== id) }));
  }

  function handleSubmit() {
    if (!form.title.trim() || !form.target_amount || Number(form.target_amount) <= 0) {
      setError(t("goals.form_error")); return;
    }
    if (isDebtPayoff && !form.linked_debt_id) { setError(t("goals.form_error")); return; }
    const target = Number(form.target_amount);
    const validMilestones: GoalMilestone[] = form.milestones
      .filter((m) => Number(m.amount) > 0 && Number(m.amount) < target)
      .sort((a, b) => Number(a.amount) - Number(b.amount))
      .map((m, i) => ({
        id: m.id,
        label: m.label.trim() || `${t("goals.phase")} ${i + 1}`,
        amount: Number(m.amount),
      }));
    setError("");
    onSubmit({
      title: form.title.trim(), target_amount: target,
      saved_amount: isManual ? Number(form.saved_amount) || 0 : 0,
      monthly_contribution: Number(form.monthly_contribution) || 0,
      due_date: form.due_date || null, category: form.category,
      tracking_type: form.tracking_type,
      linked_debt_id: isDebtPayoff ? form.linked_debt_id || null : null,
      start_date: form.start_date || todayStr(),
      notes: form.notes.trim() || null,
      color: form.color,
      milestones: validMilestones,
    });
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-6"
      style={{ backgroundColor: "rgba(11,15,20,0.78)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 38, mass: 0.9 }}
        className="w-full sm:max-w-lg rounded-t-[1.75rem] sm:rounded-[1.5rem] flex flex-col"
        style={{
          backgroundColor: "hsl(var(--bg-card))",
          border: "1px solid hsl(var(--border))",
          maxHeight: "calc(100dvh - max(env(safe-area-inset-top, 0px), 56px))",
          overflow: "hidden",
        }}
      >
        {/* Drag handle — mobile only */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
          <SheetDragHandle onClose={onClose} disabled={saving} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-3 border-b border-[hsl(var(--border))] shrink-0">
          <div>
            <h2 className="text-base font-bold t1">{initial ? t("goals.edit_goal") : t("goals.new_goal")}</h2>
            <p className="text-xs t3 mt-0.5">{t(`goals.tracking_${form.tracking_type}`)}</p>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-xl bg-[hsl(var(--bg-input))] flex items-center justify-center t3 hover:t1 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4 overscroll-contain">

          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--bg-input))]/50 p-4">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide t2">{t("goals.title_field")}</label>
            <input className="field"
              placeholder={t("goals.title_placeholder")} value={form.title}
              onChange={(e) => set("title", e.target.value)} />
          </div>

          <div className="rounded-2xl border p-4" style={{ borderColor: `${CAT[form.category].ring}30`, backgroundColor: `${CAT[form.category].ring}08` }}>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide t2">{t("goals.target_amount")}</label>
              <input type="number" min="0" step="1"
                className="w-full rounded-2xl border bg-[hsl(var(--bg-card))] px-4 py-4 text-3xl font-black number-display focus:outline-none"
                style={{ borderColor: form.target_amount ? `${CAT[form.category].ring}55` : "hsl(var(--border))", color: form.target_amount ? CAT[form.category].ring : undefined }}
                value={form.target_amount} onChange={(e) => set("target_amount", e.target.value)} />
            </div>
            <div className="flex gap-1.5 flex-wrap pt-3">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => set("color", c)}
                  className={`w-6 h-6 rounded-full shrink-0 ${form.color === c ? "ring-2 ring-white ring-offset-1 ring-offset-[hsl(var(--bg-card))]" : ""}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide t2">{t("goals.category")}</label>
            <div className="grid grid-cols-3 gap-2">
              {GOAL_CATEGORIES.map((cat) => {
                const cfg = CAT[cat]; const Icon = cfg.icon;
                return (
                  <button key={cat} type="button" onClick={() => set("category", cat)}
                    className={`min-h-[68px] flex flex-col items-center justify-center gap-1.5 rounded-2xl px-2 py-2 text-[10px] font-bold border transition-all ${
                      form.category === cat ? `${cfg.bg} ${cfg.color} border-current` : "bg-[hsl(var(--bg-input))] t3 border-[hsl(var(--border))]"
                    }`}>
                    <Icon size={12} />{t(`goals.categories.${cat}`)}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide t2">{t("goals.tracking_type")}</label>
            <div className="space-y-1.5">
              {TRACKING_TYPES.map((tt) => {
                const Icon = TRACKING_ICONS[tt]; const color = TRACKING_COLORS[tt];
                return (
                  <button key={tt} type="button" onClick={() => set("tracking_type", tt)}
                    className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-start transition-all border ${
                      form.tracking_type === tt ? "bg-[hsl(var(--bg-input))] border-[hsl(var(--border))]" : "bg-[hsl(var(--bg-card))] border-[hsl(var(--border))] hover:bg-[hsl(var(--bg-input))]"
                    }`}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: color + "22", color }}>
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold t1">{t(`goals.tracking_${tt}`)}</p>
                      <p className="text-[10px] t3 truncate">{t(`goals.tracking_${tt}_hint`)}</p>
                    </div>
                    {form.tracking_type === tt && (
                      <CheckCircle2 size={16} className="text-cyan-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {isDebtPayoff && debts.length > 0 && (
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide t2">{t("goals.linked_debt")}</label>
              <select className="field"
                value={form.linked_debt_id} onChange={(e) => set("linked_debt_id", e.target.value)}>
                <option value="">— select —</option>
                {debts.map((d) => <option key={d.id} value={d.id}>{d.person_or_entity}</option>)}
              </select>
            </div>
          )}

          {isManual && (
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide t2">{t("goals.saved_amount")}</label>
              <input type="number" min="0" step="1"
                className="field"
                value={form.saved_amount} onChange={(e) => set("saved_amount", e.target.value)} />
            </div>
          )}

          {/* ── Milestones / Phases ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wide t2 flex items-center gap-1.5">
                <Flag size={11} className="text-cyan-400" />
                {t("goals.milestones_title")}
              </label>
              <button type="button" onClick={addMilestone}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold text-cyan-400 bg-cyan-400/10 hover:bg-cyan-400/20 transition-colors">
                <Plus size={10} />
                {t("goals.milestone_add")}
              </button>
            </div>
            {form.milestones.length === 0 ? (
              <p className="text-[11px] t3 text-center py-3 rounded-xl border border-dashed border-[hsl(var(--border))]">
                {t("goals.milestones_empty")}
              </p>
            ) : (
              <div className="space-y-2">
                {form.milestones.map((m, i) => (
                  <div key={m.id} className="flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--bg-input))]/50 px-3 py-2">
                    <div className="flex items-center justify-center w-5 h-5 rounded-full shrink-0 text-[9px] font-black"
                      style={{ backgroundColor: `${CAT[form.category].ring}22`, color: CAT[form.category].ring }}>
                      {i + 1}
                    </div>
                    <input
                      className="flex-1 min-w-0 bg-transparent text-xs t1 placeholder:t3 outline-none"
                      placeholder={`${t("goals.phase")} ${i + 1}`}
                      value={m.label}
                      onChange={(e) => updateMilestone(m.id, "label", e.target.value)}
                    />
                    <input
                      type="number" min="1" step="1"
                      className="w-24 bg-transparent text-xs font-bold tabular-nums t1 text-end placeholder:t3 outline-none"
                      placeholder={t("goals.milestone_amount")}
                      value={m.amount}
                      onChange={(e) => updateMilestone(m.id, "amount", e.target.value)}
                    />
                    <button type="button" onClick={() => removeMilestone(m.id)}
                      className="shrink-0 w-5 h-5 flex items-center justify-center rounded-md text-rose-400 hover:bg-rose-400/10 transition-colors">
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button type="button" onClick={() => setShowAdvanced((v) => !v)}
            className="flex items-center gap-2 text-xs font-semibold t3 hover:t1 transition-colors w-full">
            <ChevronDown size={13} className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
            {t("goals.advanced")}
          </button>

          {showAdvanced && (
            <div className="space-y-3">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide t2">{t("goals.due_date")}</label>
                <input type="date" className="field"
                  value={form.due_date} onChange={(e) => set("due_date", e.target.value)} />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide t2">{t("goals.monthly_contribution")}</label>
                <input type="number" min="0" step="1"
                  className="field"
                  value={form.monthly_contribution} onChange={(e) => set("monthly_contribution", e.target.value)} />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide t2">{t("goals.start_date")}</label>
                <input type="date" className="field"
                  value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide t2">{t("goals.notes")}</label>
                <textarea
                  rows={3}
                  className="field resize-none"
                  placeholder={t("goals.notes_placeholder")}
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                />
              </div>
            </div>
          )}

          {(error || saveError) && (
            <p className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-400">
              {error || saveError}
            </p>
          )}
        </div>

        {/* Sticky footer */}
        <div
          className="px-5 pt-3 pb-5 flex gap-3 border-t border-[hsl(var(--border))] shrink-0"
        >
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-[hsl(var(--border))] py-2.5 text-sm font-semibold t2 hover:bg-[hsl(var(--bg-input))]">
            {t("common.cancel")}
          </button>
          <button type="button" onClick={handleSubmit} disabled={saving}
            className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: `linear-gradient(135deg, ${CAT[form.category].ring}, ${CAT[form.category].ring}bb)` }}>
            {saving && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            {initial ? t("common.save") : t("goals.create_goal")}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Contribute modal ──────────────────────────────────────────

function ContributeModal({ goal, onClose, onSubmit, format }: {
  goal: Goal;
  onClose: () => void;
  onSubmit: (amount: number) => void;
  format: (n: number) => string;
}) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState(String(goal.monthly_contribution || ""));
  const cfg = CAT[goal.category];

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("spendix:nav-hide"));
    return () => { window.dispatchEvent(new CustomEvent("spendix:nav-show")); };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4"
      style={{ backgroundColor: "rgba(11,15,20,0.78)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }} transition={spring}
        className="w-full sm:max-w-sm rounded-t-[2rem] sm:rounded-[1.75rem] overflow-hidden"
        style={{
          backgroundColor: "hsl(var(--bg-card))",
          border: "1px solid hsl(var(--border))",
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-0 sm:hidden">
          <SheetDragHandle onClose={onClose} />
        </div>

        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[hsl(var(--border))]">
          <div>
            <h2 className="text-base font-bold t1">{t("goals.manual_contribute")}</h2>
            <p className="text-xs t3 mt-0.5 truncate max-w-[200px]">{goal.title}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-[hsl(var(--bg-input))] flex items-center justify-center t3 hover:t1 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Progress reminder */}
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--bg-input))]/50 px-4 py-3 flex items-center justify-between">
            <span className="text-xs t3">{t("goals.remaining")}</span>
            <span className="text-sm font-bold tabular-nums" style={{ color: goal.color ?? cfg.ring }}>
              {format(goal.remaining)}
            </span>
          </div>

          <div>
            <label className="text-xs font-semibold t2 mb-1.5 block">{t("goals.saved_amount")}</label>
            <input type="number" min="0" step="1" autoFocus
              className="field text-lg font-bold"
              value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>

          <div className="flex gap-3" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
            <button onClick={onClose} className="flex-1 rounded-xl border border-[hsl(var(--border))] py-2.5 text-sm font-semibold t2 hover:bg-[hsl(var(--bg-input))]">
              {t("common.cancel")}
            </button>
            <button
              onClick={() => { const n = Number(amount); if (n > 0) { onSubmit(n); onClose(); } }}
              className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-80"
              style={{ background: `linear-gradient(135deg, ${cfg.ring}, ${cfg.ring}bb)` }}
            >
              {t("goals.manual_contribute")}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────

function SectionHeader({ title, href }: { title: string; href?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-bold t1">{title}</h2>
      {href && (
        <Link href={href} className="flex items-center gap-0.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
          {t("common.view_all")}
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  );
}

// ── Goal row (compact) ────────────────────────────────────────

function GoalRow({ goal, onEdit, onDelete, onContribute, format, t, dir }: {
  goal: Goal;
  onEdit: () => void;
  onDelete: () => void;
  onContribute: () => void;
  format: (n: number) => string;
  t: (k: string, p?: Record<string, string | number>) => string;
  dir: Direction;
}) {
  const cfg = CAT[goal.category];
  const Icon = cfg.icon;
  const TrackIcon = TRACKING_ICONS[goal.tracking_type];
  const trackColor = TRACKING_COLORS[goal.tracking_type];
  const pct = clamp(goal.progress);
  const isComplete = goal.status === "completed";
  const isManual = goal.tracking_type === "manual";
  const statusCfg = STATUS_CFG[goal.status];
  const isRtl = dir === "rtl";

  return (
    <div className="px-4 py-3.5 border-b border-[hsl(var(--border-2))] last:border-0">
      <div className="flex items-center gap-3 mb-2.5">
        <div className={`p-1.5 rounded-lg shrink-0 ${cfg.bg}`}>
          <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-semibold t1 truncate">{goal.title}</p>
            {statusCfg && (
              <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${statusCfg.color} ${statusCfg.bg}`}>
                <statusCfg.icon className="w-2.5 h-2.5" />
                {t(statusCfg.label)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {goal.due_date && (
              <p className="text-[10px] t3 flex items-center gap-1">
                <CalendarClock className="w-2.5 h-2.5" />
                {goal.due_date}
              </p>
            )}
            {/* Tracking type badge */}
            <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold rounded-md px-1.5 py-0.5"
              style={{ backgroundColor: trackColor + "15", color: trackColor }}>
              <TrackIcon className="w-2.5 h-2.5" />
              {t(`goals.tracking_${goal.tracking_type}`)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-sm font-bold tabular-nums" style={{ color: goal.color ?? cfg.ring }}>
            {pct}%
          </span>
          {isManual && !isComplete && (
            <button
              onClick={(e) => { e.stopPropagation(); onContribute(); }}
              className={`p-1 rounded-lg ${cfg.bg} hover:opacity-70 transition-opacity ms-1`}
              title={t("goals.manual_contribute")}
            >
              <Plus className={`w-3 h-3 ${cfg.color}`} />
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="icon-button p-1">
            <Pencil className="w-3 h-3" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="icon-button p-1 text-rose-400">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      <GoalMilestonesProgress
        milestones={goal.milestones}
        targetAmount={goal.target_amount}
        currentAmount={goal.computed_saved}
        progress={pct}
        color={goal.color ?? cfg.ring}
        isRtl={isRtl}
        format={format}
        variant="regular"
        showAmounts={!isComplete}
      />

      <div className="mt-1.5 flex items-center justify-end">
        {isComplete ? (
          <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            {t("goals.completed_status")}
          </span>
        ) : null}
      </div>

      {/* Notes snippet */}
      {goal.notes && (
        <p className="mt-1.5 text-[10px] t3 flex items-start gap-1 line-clamp-1">
          <Info className="w-2.5 h-2.5 shrink-0 mt-px" />
          {goal.notes}
        </p>
      )}
    </div>
  );
}

// ── Savings pot row ───────────────────────────────────────────

// ── Forecast row ──────────────────────────────────────────────

function ForecastRow({ goal, format, t }: {
  goal: Goal;
  format: (n: number) => string;
  t: (k: string, p?: Record<string, string | number>) => string;
}) {
  const cfg = CAT[goal.category];
  const Icon = cfg.icon;
  const projectedMonths = goal.monthly_contribution > 0 && goal.remaining > 0
    ? Math.ceil(goal.remaining / goal.monthly_contribution)
    : null;

  if (projectedMonths === null) return null;

  const projectedDate = new Date();
  projectedDate.setMonth(projectedDate.getMonth() + projectedMonths);
  const projectedStr = projectedDate.toLocaleDateString(undefined, { month: "short", year: "numeric" });

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-[hsl(var(--border-2))] last:border-0">
      <div className={`p-1.5 rounded-lg shrink-0 ${cfg.bg}`}>
        <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium t1 truncate">{goal.title}</p>
        <p className="text-[10px] t3 tabular-nums">
          {format(goal.monthly_contribution)} / {t("goals.monthly_contribution").toLowerCase()}
        </p>
      </div>
      <div className="text-end shrink-0">
        <p className="text-sm font-bold t1">{t("goals.months_away", { count: projectedMonths })}</p>
        <p className="text-[10px] t3">{projectedStr}</p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────

export default function GoalsPage() {
  const { t, dir } = useTranslation();
  const { format } = useCurrency();

  const { data: goals = [], isLoading }  = useGoals();
  const { data: debtsData }              = useDebts();
  const debts = debtsData?.debts ?? [];

  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();
  const deleteGoal = useDeleteGoal();
  const contribute = useContributeToGoal();

  const [showForm,       setShowForm]       = useState(false);
  const [editing,        setEditing]        = useState<Goal | undefined>();
  const [contributing,   setContributing]   = useState<Goal | undefined>();
  const [deletingGoal,   setDeletingGoal]   = useState<Goal | undefined>();
  const [saveError,      setSaveError]      = useState<string>("");

  const debtList = useMemo(
    () => debts.map((d) => ({ id: d.id, person_or_entity: d.person_or_entity, total_amount: d.total_amount })),
    [debts],
  );

  // Last completed savings-type goal date — for auto-chain banner
  const summary = useMemo(() => {
    const active          = goals.filter((g) => g.status !== "completed");
    const totalTarget     = goals.reduce((s, g) => s + g.target_amount, 0);
    const totalSaved      = goals.reduce((s, g) => s + g.computed_saved, 0);
    const monthlyCommit   = active.reduce((s, g) => s + g.monthly_contribution, 0);
    const completed       = goals.filter((g) => g.status === "completed").length;
    const overdue         = goals.filter((g) => g.status === "overdue").length;
    const overallProgress = totalTarget > 0 ? clamp((totalSaved / totalTarget) * 100) : 0;
    return { totalTarget, totalSaved, totalRemaining: Math.max(0, totalTarget - totalSaved), monthlyCommit, completed, overallProgress, overdue };
  }, [goals]);

  const forecastGoals = useMemo(
    () => goals
      .filter((g) => g.status !== "completed" && g.monthly_contribution > 0 && g.remaining > 0)
      .sort((a, b) => {
        const pa = Math.ceil(a.remaining / a.monthly_contribution);
        const pb = Math.ceil(b.remaining / b.monthly_contribution);
        return pa - pb;
      }),
    [goals],
  );

  function handleSubmit(data: GoalFormData) {
    setSaveError("");
    const close = () => { setShowForm(false); setEditing(undefined); setSaveError(""); };
    const onError = (e: Error) => setSaveError(e.message);
    if (editing) {
      updateGoal.mutate({ id: editing.id, data }, { onSuccess: close, onError });
    } else {
      createGoal.mutate(data, { onSuccess: close, onError });
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingGoal) return;
    const id = deletingGoal.id;
    try {
      await deleteGoal.mutateAsync(id);
    } finally {
      setDeletingGoal(undefined);
    }
  }

  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-400/10">
          <Target className="h-4 w-4 text-indigo-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-black t1">{t("goals.title")}</h1>
          <p className="mt-0.5 text-xs font-medium t3">{t("goals.subtitle")}</p>
        </div>
        <button
          onClick={() => { setEditing(undefined); setShowForm(true); }}
          className="flex shrink-0 items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-[#0B0F17] rounded-xl text-sm font-semibold transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          {t("goals.new_goal")}
        </button>
      </div>

      {/* ── Overall banner ───────────────────────────────── */}
      {goals.length > 0 && (
        <div
          className="relative overflow-hidden rounded-[1.5rem] border border-[hsl(var(--border))] p-5"
          style={{ background: "linear-gradient(135deg, #10202A 0%, #132218 48%, #231E12 100%)" }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/45 mb-2">
            {t("goals.overall_progress")}
          </p>
          <div className="flex items-end gap-4 mb-4">
            <p className="text-4xl font-black text-white tabular-nums">{summary.overallProgress}%</p>
            <p className="mb-1 text-sm text-white/55">
              {format(summary.totalSaved)} / {format(summary.totalTarget)}
            </p>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-emerald-300 to-amber-300 transition-all"
              style={{ width: `${summary.overallProgress}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
            <p className="text-xs text-white/40">
              {t("goals.monthly_commitment_label")}:
              <span className="font-bold text-white/70 ms-1">{format(summary.monthlyCommit)}</span>
            </p>
            <div className="flex items-center gap-3">
              {summary.overdue > 0 && (
                <span className="text-[10px] font-bold text-rose-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {summary.overdue} {t("goals.status_overdue").toLowerCase()}
                </span>
              )}
              <span className="text-xs text-white/40">
                {summary.completed}/{goals.length} {t("goals.completed").toLowerCase()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Goals section ────────────────────────────────── */}
      <section>
        <SectionHeader title={t("goals.title")} />
        {isLoading ? (
          <div className="card overflow-hidden">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="px-4 py-3.5 border-b border-[hsl(var(--border-2))] last:border-0 animate-pulse space-y-2">
                <div className="flex gap-3 items-center">
                  <div className="w-7 h-7 rounded-lg bg-[hsl(var(--bg-input))] shrink-0" />
                  <div className="h-3.5 bg-[hsl(var(--bg-input))] rounded flex-1" />
                  <div className="h-3.5 bg-[hsl(var(--bg-input))] rounded w-10 shrink-0" />
                </div>
                <div className="h-2 bg-[hsl(var(--bg-input))] rounded-full" />
              </div>
            ))}
          </div>
        ) : goals.length === 0 ? (
          <div className="card py-12 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/10">
              <Target className="h-5 w-5 text-amber-400" />
            </div>
            <p className="font-bold t1 text-sm">{t("goals.empty_title")}</p>
            <p className="text-xs t3 max-w-xs mx-auto">{t("goals.empty_body")}</p>
            <button
              onClick={() => { setEditing(undefined); setShowForm(true); }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-[#0B0F17] rounded-xl text-sm font-semibold transition-all"
            >
              <Plus className="w-4 h-4" />
              {t("goals.new_goal")}
            </button>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <AnimatePresence initial={false}>
              {goals.map((goal) => (
                <GoalRow
                  key={goal.id}
                  goal={goal}
                  onEdit={() => { setEditing(goal); setShowForm(true); }}
                  onDelete={() => setDeletingGoal(goal)}
                  onContribute={() => setContributing(goal)}
                  format={format}
                  t={t}
                  dir={dir}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* ── Savings section ──────────────────────────────── */}
      {/* ── Forecast section ─────────────────────────────── */}
      {forecastGoals.length > 0 && (
        <section>
          <SectionHeader title={t("goals.forecast_title")} />
          <div className="card overflow-hidden">
            {forecastGoals.map((goal) => (
              <ForecastRow key={goal.id} goal={goal} format={format} t={t} />
            ))}
          </div>
        </section>
      )}

      {/* ── Modals ───────────────────────────────────────── */}
      <AnimatePresence>
        {showForm && (
          <GoalFormModal
            key="goal-form"
            initial={editing}
            onClose={() => { setShowForm(false); setEditing(undefined); }}
            onSubmit={handleSubmit}
            saving={createGoal.isPending || updateGoal.isPending}
            saveError={saveError}
            debts={debtList}
          />
        )}
        {contributing && (
          <ContributeModal
            key="contribute-modal"
            goal={contributing}
            onClose={() => setContributing(undefined)}
            onSubmit={(amount) => contribute.mutate({ id: contributing.id, amount })}
            format={format}
          />
        )}
        {deletingGoal && (
          <ConfirmModal
            key="delete-goal"
            message={t("goals.delete_confirm", { title: deletingGoal.title })}
            onConfirm={handleDeleteConfirm}
            onCancel={() => setDeletingGoal(undefined)}
            loading={deleteGoal.isPending}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
