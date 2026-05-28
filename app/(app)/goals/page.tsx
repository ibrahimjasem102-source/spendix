"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock, Car, CheckCircle2, GraduationCap,
  Home, Pencil, PiggyBank, Plane, Plus, ShieldAlert,
  Sparkles, Target, Trash2, Wallet,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { on } from "@/lib/events";
import { useGlobalActions } from "@/contexts/GlobalActionsContext";
import { safeFetch } from "@/lib/fetch-safe";
import GoalFormModal, {
  type FinancialGoal, type GoalFormData, type GoalCategory,
  GOAL_CATEGORIES, toInputDate,
} from "@/components/goals/GoalFormModal";

const STORAGE_KEY = "spendix_financial_goals";

// ── Category config ───────────────────────────────────────────
const CAT: Record<GoalCategory, { icon: React.ElementType; ring: string; color: string; bg: string }> = {
  emergency: { icon: ShieldAlert,    ring: "#f87171", color: "text-rose-400",   bg: "bg-rose-400/10"   },
  home:      { icon: Home,           ring: "#fbbf24", color: "text-amber-400",  bg: "bg-amber-400/10"  },
  travel:    { icon: Plane,          ring: "#22d3ee", color: "text-cyan-400",   bg: "bg-cyan-400/10"   },
  education: { icon: GraduationCap,  ring: "#a78bfa", color: "text-purple-400", bg: "bg-purple-400/10" },
  car:       { icon: Car,            ring: "#60a5fa", color: "text-blue-400",   bg: "bg-blue-400/10"   },
  other:     { icon: Sparkles,       ring: "#9ca3af", color: "text-gray-400",   bg: "bg-gray-400/10"   },
};

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `goal-${Date.now()}`;
}

function clampPct(v: number) { return Math.max(0, Math.min(100, Math.round(v))); }
function progressOf(g: FinancialGoal) { return g.targetAmount > 0 ? clampPct((g.savedAmount / g.targetAmount) * 100) : 0; }
function remainingOf(g: FinancialGoal) { return Math.max(0, g.targetAmount - g.savedAmount); }
function daysUntil(date: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(`${date}T00:00:00`).getTime() - today.getTime()) / 86_400_000);
}
function statusOf(g: FinancialGoal) {
  if (remainingOf(g) <= 0) return "completed_status";
  const d = daysUntil(g.dueDate);
  if (d < 0) return "overdue";
  if (d <= 60) return "due_soon";
  return "on_track";
}

function normalizeGoal(v: unknown): FinancialGoal | null {
  if (!v || typeof v !== "object") return null;
  const g = v as Partial<FinancialGoal>;
  if (!g.id || !g.title || !g.dueDate) return null;
  return {
    id:                  String(g.id),
    title:               String(g.title),
    targetAmount:        Number(g.targetAmount) || 0,
    savedAmount:         Number(g.savedAmount) || 0,
    monthlyContribution: Number(g.monthlyContribution) || 0,
    dueDate:             String(g.dueDate),
    category:            GOAL_CATEGORIES.includes(g.category as GoalCategory) ? g.category as GoalCategory : "other",
  };
}

const INITIAL_GOALS: FinancialGoal[] = [
  { id: "goal-emergency", title: "Emergency fund",  targetAmount: 5000,  savedAmount: 1850, monthlyContribution: 350, dueDate: toInputDate(addMonths(new Date(), 8)),  category: "emergency" },
  { id: "goal-travel",    title: "Summer trip",     targetAmount: 1800,  savedAmount: 720,  monthlyContribution: 180, dueDate: toInputDate(addMonths(new Date(), 5)),  category: "travel"    },
  { id: "goal-home",      title: "Home deposit",    targetAmount: 12000, savedAmount: 3200, monthlyContribution: 500, dueDate: toInputDate(addMonths(new Date(), 18)), category: "home"      },
];

// ── Circular progress ring ────────────────────────────────────
function Ring({ pct, ring, size = 64, stroke = 5 }: { pct: number; ring: string; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={ring} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.6s ease" }} />
    </svg>
  );
}

export default function GoalsPage() {
  const { t, formatDate, formatNumber } = useTranslation();
  const { format } = useCurrency();
  const { openModal } = useGlobalActions();

  const [goals, setGoals]     = useState<FinancialGoal[]>(INITIAL_GOALS);
  const [hydrated, setHydrated] = useState(false);
  const [editing, setEditing] = useState<FinancialGoal | undefined>();
  const [showForm, setShowForm] = useState(false);

  // Load from localStorage
  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown[];
        if (Array.isArray(parsed)) {
          const restored = parsed.map(normalizeGoal).filter(Boolean) as FinancialGoal[];
          if (restored.length > 0) { setGoals(restored); return; }
        }
      }
    } catch {}
  }

  useEffect(() => { loadFromStorage(); setHydrated(true); }, []);

  // Persist on change
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
  }, [goals, hydrated]);

  // Listen for goals added from FAB
  useEffect(() => on("spendix:goal-added", () => loadFromStorage()), []);

  const summary = useMemo(() => {
    const totalTarget      = goals.reduce((s, g) => s + g.targetAmount, 0);
    const totalSaved       = goals.reduce((s, g) => s + g.savedAmount, 0);
    const monthlyCommitment = goals.reduce((s, g) => s + g.monthlyContribution, 0);
    const completed        = goals.filter((g) => remainingOf(g) <= 0).length;
    const overallProgress  = totalTarget > 0 ? clampPct((totalSaved / totalTarget) * 100) : 0;
    const nextGoal         = [...goals].filter((g) => remainingOf(g) > 0)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
    return { totalTarget, totalSaved, totalRemaining: Math.max(0, totalTarget - totalSaved), monthlyCommitment, completed, overallProgress, nextGoal };
  }, [goals]);

  function postNotification(title: string, message: string, type: string, priority = "normal") {
    void safeFetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, message, type, source: "goal", priority, action_url: "/goals" }),
    }).catch(() => {});
  }

  function handleSubmit(data: GoalFormData) {
    if (editing) {
      setGoals((cur) => cur.map((g) => g.id === editing.id ? { ...g, ...data } : g));
    } else {
      setGoals((cur) => [{ id: createId(), ...data }, ...cur]);
      postNotification(
        `هدف مالي جديد 🎯`,
        `تم إنشاء هدف "${data.title}" بمبلغ ${data.targetAmount.toFixed(2)}. ابدأ بالادخار لتحقيقه!`,
        "goal",
        "normal",
      );
    }
    setShowForm(false);
    setEditing(undefined);
  }

  function handleDelete(id: string) { setGoals((cur) => cur.filter((g) => g.id !== id)); }

  function addContribution(goal: FinancialGoal) {
    const amount = Math.min(remainingOf(goal), Math.max(goal.monthlyContribution, 0));
    if (amount <= 0) return;
    const newSaved = goal.savedAmount + amount;
    const nowComplete = newSaved >= goal.targetAmount;
    setGoals((cur) => cur.map((g) => g.id === goal.id ? { ...g, savedAmount: newSaved } : g));
    if (nowComplete) {
      postNotification(
        `هدف "${goal.title}" مكتمل! 🎉`,
        `تهانينا! لقد حققت هدفك المالي بالكامل. حدد هدفاً جديداً لمواصلة النمو.`,
        "goal",
        "high",
      );
    }
  }

  const kpis = [
    { label: t("goals.total_saved"),    value: format(summary.totalSaved),       icon: PiggyBank,   color: "text-emerald-400", bg: "bg-emerald-400/10" },
    { label: t("goals.total_target"),   value: format(summary.totalTarget),      icon: Target,      color: "text-cyan-400",    bg: "bg-cyan-400/10"    },
    { label: t("goals.remaining"),      value: format(summary.totalRemaining),   icon: Wallet,      color: "text-amber-400",   bg: "bg-amber-400/10"   },
    { label: t("goals.completed"),      value: `${summary.completed}/${goals.length}`, icon: CheckCircle2, color: "text-purple-400", bg: "bg-purple-400/10" },
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
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-400 px-4 py-2.5 text-sm font-semibold text-[#0B0F17] transition-all pressable shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          {t("goals.new_goal")}
        </button>
      </div>

      {/* Overall progress banner */}
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
                <p className="mt-1 text-sm text-white/60">{formatDate(summary.nextGoal.dueDate)}</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-amber-300 transition-all"
                    style={{ width: `${progressOf(summary.nextGoal)}%` }} />
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

      {/* Goals grid */}
      {goals.length === 0 ? (
        <div className="card py-16 text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/10">
            <Target className="h-6 w-6 text-amber-400" />
          </div>
          <p className="font-bold t1">{t("goals.empty_title")}</p>
          <p className="text-sm t3 max-w-xs mx-auto">{t("goals.empty_body")}</p>
          <button
            onClick={() => openModal("goal")}
            className="mx-auto mt-2 flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-400 px-4 py-2.5 text-sm font-semibold text-[#0B0F17]"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("goals.new_goal")}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {goals.map((goal) => {
            const pct       = progressOf(goal);
            const remaining = remainingOf(goal);
            const days      = daysUntil(goal.dueDate);
            const monthsLeft        = Math.max(0, Math.ceil(days / 30));
            const requiredMonthly   = monthsLeft > 0 ? remaining / monthsLeft : remaining;
            const projectedMonths   = goal.monthlyContribution > 0 ? Math.ceil(remaining / goal.monthlyContribution) : null;
            const status   = statusOf(goal);
            const cfg      = CAT[goal.category];
            const CatIcon  = cfg.icon;

            const statusStyle =
              status === "completed_status" ? "text-emerald-300 bg-emerald-400/10 border-emerald-400/20" :
              status === "overdue"          ? "text-rose-300   bg-rose-400/10   border-rose-400/20"      :
              status === "due_soon"         ? "text-amber-300  bg-amber-400/10  border-amber-400/20"     :
                                              "text-cyan-300   bg-cyan-400/10   border-cyan-400/20";

            return (
              <article key={goal.id} className="card p-5 flex flex-col gap-4">
                {/* Top row: ring + info + actions */}
                <div className="flex items-start gap-4">
                  {/* Ring with icon inside */}
                  <div className="relative shrink-0" style={{ width: 64, height: 64 }}>
                    <Ring pct={pct} ring={cfg.ring} size={64} stroke={5} />
                    <div className={`absolute inset-0 flex items-center justify-center rounded-full ${cfg.bg}`}
                      style={{ margin: 7 }}>
                      <CatIcon className={`h-4 w-4 ${cfg.color}`} />
                    </div>
                  </div>

                  {/* Title + badges */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusStyle}`}>
                        {t(`goals.${status}`)}
                      </span>
                      <span className={`rounded-lg px-2 py-0.5 text-[10px] font-semibold ${cfg.bg} ${cfg.color}`}>
                        {t(`goals.categories.${goal.category}`)}
                      </span>
                    </div>
                    <h2 className="text-base font-bold t1 truncate">{goal.title}</h2>
                    <p className="mt-0.5 text-xs t3 flex items-center gap-1">
                      <CalendarClock className="h-3 w-3" />
                      {formatDate(goal.dueDate)}
                      {days >= 0 && <span className="t3">· {days}d</span>}
                    </p>
                  </div>

                  {/* Edit / Delete */}
                  <div className="flex shrink-0 items-center gap-1">
                    <button onClick={() => { setEditing(goal); setShowForm(true); }}
                      className="icon-button" aria-label={t("common.edit")}>
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDelete(goal.id)}
                      className="icon-button text-rose-300 hover:bg-rose-400/10"
                      aria-label={t("common.delete")}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progress bar + pct */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold t3">{t("goals.progress")}</span>
                    <span className="text-sm font-bold t1 number-display">{pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[hsl(var(--bg-input))]">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${cfg.ring}99, ${cfg.ring})` }} />
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-[10px] t3 number-display">{format(goal.savedAmount)}</span>
                    <span className="text-[10px] t3 number-display">{format(goal.targetAmount)}</span>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl border border-[hsl(var(--border-2))] bg-[hsl(var(--bg-input))] p-3">
                    <p className="text-[10px] font-semibold t3">{t("goals.remaining")}</p>
                    <p className="mt-1 text-sm font-bold text-amber-300 number-display">{format(remaining)}</p>
                  </div>
                  <div className="rounded-2xl border border-[hsl(var(--border-2))] bg-[hsl(var(--bg-input))] p-3">
                    <p className="text-[10px] font-semibold t3">{t("goals.monthly_need")}</p>
                    <p className="mt-1 text-sm font-bold text-cyan-300 number-display">{format(requiredMonthly)}</p>
                  </div>
                </div>

                {/* Footer: projection + contribute */}
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs t3 leading-tight">
                    {projectedMonths === null
                      ? t("goals.no_contribution")
                      : t("goals.projected_months", { count: formatNumber(projectedMonths) })}
                  </p>
                  <button
                    onClick={() => addContribution(goal)}
                    disabled={remaining <= 0 || goal.monthlyContribution <= 0}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all shrink-0 ${cfg.bg} ${cfg.color} hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30`}
                  >
                    <Plus className="h-3 w-3" />
                    {format(Math.min(remaining, goal.monthlyContribution))}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {showForm && (
        <GoalFormModal
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(undefined); }}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
