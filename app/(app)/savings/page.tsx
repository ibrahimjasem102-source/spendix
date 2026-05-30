"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDownCircle, ArrowUpCircle, Car, ChevronDown, ChevronRight,
  GraduationCap, Home, Pencil, PiggyBank, Plane,
  Plus, ShieldAlert, Sparkles, Trash2, X, BriefcaseBusiness,
  ArrowDownLeft, ArrowUpRight,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { useToast } from "@/hooks/useToast";
import ToastList from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { spring } from "@/lib/motion";
import {
  useSavingsPots, useSavingsTransactions,
  useCreateSavingsPot, useUpdateSavingsPot, useDeleteSavingsPot,
  useDepositToSavings, useWithdrawFromSavings,
} from "@/lib/query/hooks";
import type { SavingsCategory, SavingsPot, SavingsPotFormData, SavingsTxFormData } from "@/types";

// ── Category config ───────────────────────────────────────────

type CatCfg = { icon: React.ElementType; ring: string; color: string; bg: string };
const CAT: Record<SavingsCategory, CatCfg> = {
  emergency:  { icon: ShieldAlert,       ring: "#f87171", color: "text-rose-400",    bg: "bg-rose-400/10"    },
  travel:     { icon: Plane,             ring: "#22d3ee", color: "text-cyan-400",    bg: "bg-cyan-400/10"    },
  car:        { icon: Car,               ring: "#60a5fa", color: "text-blue-400",    bg: "bg-blue-400/10"    },
  home:       { icon: Home,              ring: "#fbbf24", color: "text-amber-400",   bg: "bg-amber-400/10"   },
  education:  { icon: GraduationCap,     ring: "#a78bfa", color: "text-purple-400",  bg: "bg-purple-400/10"  },
  retirement: { icon: BriefcaseBusiness, ring: "#34d399", color: "text-emerald-400", bg: "bg-emerald-400/10" },
  other:      { icon: Sparkles,          ring: "#9ca3af", color: "text-gray-400",    bg: "bg-gray-400/10"    },
};

const CATEGORIES: SavingsCategory[] = ["emergency","travel","car","home","education","retirement","other"];
const COLORS = ["#F59E0B","#3B82F6","#8B5CF6","#10B981","#06B6D4","#F97316","#EF4444","#6366F1","#A855F7","#34D399"];

function todayStr() { return new Date().toISOString().slice(0, 10); }

// ── Ring SVG ──────────────────────────────────────────────────

function RingSVG({ pct, color, size = 72 }: { pct: number; color: string; size?: number }) {
  const r   = (size - 8) / 2;
  const cir = 2 * Math.PI * r;
  const off = cir * (1 - Math.min(pct, 100) / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={6}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color}
        strokeWidth={6} strokeLinecap="round"
        strokeDasharray={cir} strokeDashoffset={off}
        style={{ transition: "stroke-dashoffset .6s ease" }}/>
    </svg>
  );
}

// ── Pot Form Modal ────────────────────────────────────────────

interface PotFormProps {
  initial?: SavingsPot;
  onSave: (data: SavingsPotFormData) => void;
  onClose: () => void;
  loading?: boolean;
}

function PotFormModal({ initial, onSave, onClose, loading }: PotFormProps) {
  const { t } = useTranslation();

  const [name,     setName]     = useState(initial?.name ?? "");
  const [category, setCategory] = useState<SavingsCategory>(initial?.category ?? "emergency");
  const [target,   setTarget]   = useState(initial?.target_amount?.toString() ?? "");
  const [color,    setColor]    = useState(initial?.color ?? COLORS[0]);
  const [notes,    setNotes]    = useState(initial?.notes ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      category,
      target_amount: target ? parseFloat(target) : null,
      color,
      notes: notes.trim() || null,
    });
  }

  const CatIcon = CAT[category].icon;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="relative w-full sm:max-w-md bg-[#111318] border border-white/10 rounded-t-2xl sm:rounded-2xl overflow-hidden"
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={spring}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/8">
          <h2 className="text-base font-semibold text-white">
            {initial ? t("savings.edit_pot") : t("savings.add_pot")}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/8 transition-colors text-gray-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">{t("savings.pot_name")}</label>
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder={t("savings.pot_name_placeholder")}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
              required
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">{t("savings.category")}</label>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map((cat) => {
                const Icon = CAT[cat].icon;
                const active = category === cat;
                return (
                  <button
                    key={cat} type="button"
                    onClick={() => setCategory(cat)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-xs transition-all ${
                      active
                        ? `${CAT[cat].bg} border-[${CAT[cat].ring}]/40 ${CAT[cat].color}`
                        : "bg-white/4 border-white/8 text-gray-500 hover:text-gray-300 hover:bg-white/8"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="truncate w-full text-center">
                      {t(`savings.categories.${cat}` as Parameters<typeof t>[0])}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">{t("savings.target_amount")}</label>
            <input
              type="number" min="0" step="0.01"
              value={target} onChange={(e) => setTarget(e.target.value)}
              placeholder={t("savings.target_amount_placeholder")}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">{t("savings.color")}</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c} type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-all ${color === c ? "ring-2 ring-white ring-offset-2 ring-offset-[#111318] scale-110" : "opacity-70 hover:opacity-100"}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">{t("savings.notes")}</label>
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder={t("savings.notes_placeholder")}
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 resize-none"
            />
          </div>

          {/* Preview */}
          <div className="flex items-center gap-3 p-3 bg-white/4 rounded-xl border border-white/8">
            <div className={`w-10 h-10 rounded-xl ${CAT[category].bg} flex items-center justify-center`}>
              <CatIcon className={`w-5 h-5 ${CAT[category].color}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-white">{name || "—"}</p>
              <p className="text-xs text-gray-500">{t(`savings.categories.${category}` as Parameters<typeof t>[0])}</p>
            </div>
            <div className="ml-auto w-4 h-4 rounded-full" style={{ background: color }} />
          </div>

          {/* Submit */}
          <button
            type="submit" disabled={loading || !name.trim()}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-semibold text-white transition-colors"
          >
            {loading ? "..." : initial ? t("common.save") : t("savings.add_pot")}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

// ── Tx Form Modal ─────────────────────────────────────────────

interface TxFormProps {
  pot: SavingsPot;
  mode: "deposit" | "withdraw";
  onSave: (data: SavingsTxFormData) => void;
  onClose: () => void;
  loading?: boolean;
}

function TxFormModal({ pot, mode, onSave, onClose, loading }: TxFormProps) {
  const { t } = useTranslation();
  const { format } = useCurrency();

  const [amount, setAmount] = useState("");
  const [note,   setNote]   = useState("");
  const [date,   setDate]   = useState(todayStr());

  const isDeposit = mode === "deposit";
  const Icon      = isDeposit ? ArrowDownCircle : ArrowUpCircle;
  const accent    = isDeposit ? "bg-emerald-600 hover:bg-emerald-500" : "bg-amber-600 hover:bg-amber-500";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    onSave({ amount: amt, note: note.trim() || null, date });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="relative w-full sm:max-w-sm bg-[#111318] border border-white/10 rounded-t-2xl sm:rounded-2xl overflow-hidden"
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={spring}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/8">
          <div className="flex items-center gap-2">
            <Icon className={`w-5 h-5 ${isDeposit ? "text-emerald-400" : "text-amber-400"}`} />
            <h2 className="text-base font-semibold text-white">
              {isDeposit ? t("savings.deposit_title", { name: pot.name }) : t("savings.withdraw_title", { name: pot.name })}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/8 text-gray-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {!isDeposit && (
            <div className="flex items-center justify-between px-3 py-2 bg-amber-400/10 border border-amber-400/20 rounded-xl">
              <span className="text-xs text-amber-300">{t("savings.balance")}</span>
              <span className="text-sm font-semibold text-amber-300">{format(pot.balance)}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">{t("savings.amount")}</label>
            <input
              type="number" min="0.01" step="0.01" required
              value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">{t("savings.note")}</label>
            <input
              value={note} onChange={(e) => setNote(e.target.value)}
              placeholder={t("savings.note_placeholder")}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">{t("savings.date")}</label>
            <input
              type="date" required
              value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
            />
          </div>

          <button
            type="submit" disabled={loading || !amount || parseFloat(amount) <= 0}
            className={`w-full py-2.5 rounded-xl ${accent} disabled:opacity-50 text-sm font-semibold text-white transition-colors`}
          >
            {loading ? "..." : isDeposit ? t("savings.deposit") : t("savings.withdraw")}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

// ── Transaction History Panel ─────────────────────────────────

function TxHistoryPanel({ pot, onClose }: { pot: SavingsPot; onClose: () => void }) {
  const { t, formatDate } = useTranslation();
  const { format }        = useCurrency();

  const { data: txs = [], isLoading } = useSavingsTransactions(pot.id);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="relative w-full sm:max-w-md bg-[#111318] border border-white/10 rounded-t-2xl sm:rounded-2xl overflow-hidden max-h-[80vh] flex flex-col"
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={spring}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/8 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-white">{pot.name}</h2>
            <p className="text-xs text-gray-500">{t("savings.tx_history")}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/8 text-gray-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-2">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500 text-sm">{t("common.loading")}</div>
          ) : txs.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">{t("savings.no_transactions")}</div>
          ) : (
            txs.map((tx) => (
              <div key={tx.id} className="flex items-center gap-3 p-3 bg-white/4 rounded-xl border border-white/6">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  tx.type === "deposit" ? "bg-emerald-400/10" : "bg-amber-400/10"
                }`}>
                  {tx.type === "deposit"
                    ? <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
                    : <ArrowUpRight  className="w-4 h-4 text-amber-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">
                    {tx.type === "deposit" ? t("savings.tx_deposit") : t("savings.tx_withdraw")}
                  </p>
                  {tx.note && <p className="text-xs text-gray-500 truncate">{tx.note}</p>}
                  <p className="text-xs text-gray-600">{formatDate(tx.date)}</p>
                </div>
                <span className={`text-sm font-semibold shrink-0 ${
                  tx.type === "deposit" ? "text-emerald-400" : "text-amber-400"
                }`}>
                  {tx.type === "deposit" ? "+" : "−"}{format(tx.amount)}
                </span>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── Pot Card ──────────────────────────────────────────────────

interface PotCardProps {
  pot: SavingsPot;
  onEdit: () => void;
  onDelete: () => void;
  onDeposit: () => void;
  onWithdraw: () => void;
  onHistory: () => void;
}

function PotCard({ pot, onEdit, onDelete, onDeposit, onWithdraw, onHistory }: PotCardProps) {
  const { t } = useTranslation();
  const { format } = useCurrency();

  const cfg         = CAT[pot.category];
  const Icon        = cfg.icon;
  const accentColor = pot.color ?? cfg.ring;
  const hasTarget   = pot.target_amount != null && pot.target_amount > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: .95 }}
      transition={spring}
      className="relative bg-[#0f1117] border border-white/8 rounded-2xl overflow-hidden group hover:border-white/12 transition-colors"
      style={{ borderTop: `2px solid ${accentColor}30` }}
    >
      {/* Color accent strip */}
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, ${accentColor}80, transparent)` }} />

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            {/* Icon + ring */}
            <div className="relative shrink-0">
              {hasTarget ? (
                <>
                  <RingSVG pct={pot.progress} color={accentColor} size={52} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Icon className={`w-5 h-5 ${cfg.color}`} />
                  </div>
                </>
              ) : (
                <div className={`w-12 h-12 rounded-xl ${cfg.bg} flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${cfg.color}`} />
                </div>
              )}
            </div>

            <div>
              <p className="font-semibold text-white text-sm leading-tight">{pot.name}</p>
              <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full mt-0.5 ${cfg.bg} ${cfg.color}`}>
                {t(`savings.categories.${pot.category}` as Parameters<typeof t>[0])}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-white/8 text-gray-500 hover:text-white transition-colors">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-rose-400/10 text-gray-500 hover:text-rose-400 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Balance */}
        <div className="mb-3">
          <p className="text-2xl font-bold text-white tracking-tight">{format(pot.balance)}</p>
          {hasTarget ? (
            <p className="text-xs text-gray-500 mt-0.5">
              {t("savings.of_target", { target: format(pot.target_amount!) })}
            </p>
          ) : (
            <p className="text-xs text-gray-600">{t("savings.no_target")}</p>
          )}
        </div>

        {/* Progress bar */}
        {hasTarget && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-gray-600">{t("savings.progress")}</span>
              <span className="text-[10px] font-medium" style={{ color: accentColor }}>{pot.progress}%</span>
            </div>
            <div className="h-1.5 bg-white/6 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: accentColor }}
                initial={{ width: 0 }}
                animate={{ width: `${pot.progress}%` }}
                transition={{ duration: .6, ease: "easeOut" }}
              />
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={onDeposit}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-400/10 hover:bg-emerald-400/20 border border-emerald-400/20 text-emerald-400 text-xs font-medium transition-colors"
          >
            <ArrowDownCircle className="w-3.5 h-3.5" />
            {t("savings.deposit")}
          </button>
          <button
            onClick={onWithdraw}
            disabled={pot.balance <= 0}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/20 text-amber-400 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowUpCircle className="w-3.5 h-3.5" />
            {t("savings.withdraw")}
          </button>
          <button
            onClick={onHistory}
            className="p-2 rounded-xl bg-white/4 hover:bg-white/8 border border-white/8 text-gray-400 hover:text-white transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

type TxMode = "deposit" | "withdraw";

export default function SavingsPage() {
  const { t }      = useTranslation();
  const { format } = useCurrency();
  const { toasts, addToast, dismiss } = useToast();

  const [showForm,    setShowForm]    = useState(false);
  const [editing,     setEditing]     = useState<SavingsPot | undefined>();
  const [confirmId,   setConfirmId]   = useState<string | null>(null);
  const [txPot,       setTxPot]       = useState<SavingsPot | null>(null);
  const [txMode,      setTxMode]      = useState<TxMode>("deposit");
  const [historyPot,  setHistoryPot]  = useState<SavingsPot | null>(null);
  const [filterCat,   setFilterCat]   = useState<SavingsCategory | "all">("all");

  const { data: pots = [], isLoading } = useSavingsPots();

  const createMut   = useCreateSavingsPot();
  const updateMut   = useUpdateSavingsPot();
  const deleteMut   = useDeleteSavingsPot();
  const depositMut  = useDepositToSavings();
  const withdrawMut = useWithdrawFromSavings();

  // Summary
  const summary = useMemo(() => {
    const totalBalance = pots.reduce((s, p) => s + p.balance, 0);
    const totalTarget  = pots.filter((p) => p.target_amount != null)
      .reduce((s, p) => s + (p.target_amount ?? 0), 0);
    const activePots   = pots.length;
    const overall      = totalTarget > 0
      ? Math.min(100, Math.round((totalBalance / totalTarget) * 100))
      : 0;
    return { totalBalance, totalTarget, activePots, overall };
  }, [pots]);

  const filtered = useMemo(() =>
    filterCat === "all" ? pots : pots.filter((p) => p.category === filterCat),
    [pots, filterCat]
  );

  // Handlers
  function handleCreateOrUpdate(data: SavingsPotFormData) {
    if (editing) {
      updateMut.mutate({ id: editing.id, data }, {
        onSuccess: () => { addToast(t("savings.updated"), "success"); setEditing(undefined); setShowForm(false); },
        onError:   () => addToast(t("common.unknown_error"), "error"),
      });
    } else {
      createMut.mutate(data, {
        onSuccess: () => { addToast(t("savings.created"), "success"); setShowForm(false); },
        onError:   () => addToast(t("common.unknown_error"), "error"),
      });
    }
  }

  function handleDelete(id: string) {
    deleteMut.mutate(id, {
      onSuccess: () => { addToast(t("savings.deleted"), "success"); setConfirmId(null); },
      onError:   () => addToast(t("common.unknown_error"), "error"),
    });
  }

  function handleTx(data: SavingsTxFormData) {
    if (!txPot) return;
    const mutFn = txMode === "deposit" ? depositMut : withdrawMut;
    mutFn.mutate({ potId: txPot.id, data }, {
      onSuccess: () => {
        addToast(txMode === "deposit" ? t("savings.deposited") : t("savings.withdrawn"), "success");
        setTxPot(null);
      },
      onError: (err: unknown) => {
        const msg = (err as { message?: string })?.message?.includes("Insufficient")
          ? t("savings.insufficient_balance")
          : t("common.unknown_error");
        addToast(msg, "error");
      },
    });
  }

  function openDeposit(pot: SavingsPot)  { setTxPot(pot); setTxMode("deposit");  }
  function openWithdraw(pot: SavingsPot) { setTxPot(pot); setTxMode("withdraw"); }
  function openHistory(pot: SavingsPot)  { setHistoryPot(pot); }

  return (
    <div className="min-h-screen bg-[#0a0b0f] text-white px-4 py-6 max-w-5xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <PiggyBank className="w-6 h-6 text-emerald-400" />
            {t("savings.title")}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{t("savings.subtitle")}</p>
        </div>
        <button
          onClick={() => { setEditing(undefined); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">{t("savings.add_pot")}</span>
        </button>
      </div>

      {/* ── Summary KPIs ── */}
      {pots.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: t("savings.summary_total"),    value: format(summary.totalBalance), color: "text-emerald-400" },
            { label: t("savings.summary_target"),   value: summary.totalTarget > 0 ? format(summary.totalTarget) : "—", color: "text-indigo-400" },
            { label: t("savings.summary_pots"),     value: String(summary.activePots), color: "text-cyan-400" },
            { label: t("savings.summary_progress"), value: summary.totalTarget > 0 ? `${summary.overall}%` : "—", color: "text-amber-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[#0f1117] border border-white/8 rounded-2xl p-4">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Overall progress bar */}
      {summary.totalTarget > 0 && (
        <div className="mb-6 px-4 py-3 bg-[#0f1117] border border-white/8 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500">{t("savings.summary_progress")}</span>
            <span className="text-xs font-semibold text-emerald-400">{summary.overall}%</span>
          </div>
          <div className="h-2 bg-white/6 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
              initial={{ width: 0 }}
              animate={{ width: `${summary.overall}%` }}
              transition={{ duration: .8, ease: "easeOut" }}
            />
          </div>
        </div>
      )}

      {/* ── Category filter ── */}
      {pots.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-6 scrollbar-hide">
          <button
            onClick={() => setFilterCat("all")}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              filterCat === "all"
                ? "bg-indigo-600 text-white"
                : "bg-white/6 text-gray-400 hover:text-white hover:bg-white/10"
            }`}
          >
            {t("common.all")}
          </button>
          {CATEGORIES.filter((cat) => pots.some((p) => p.category === cat)).map((cat) => {
            const Icon   = CAT[cat].icon;
            const active = filterCat === cat;
            return (
              <button
                key={cat}
                onClick={() => setFilterCat(cat)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                  active
                    ? `${CAT[cat].bg} ${CAT[cat].color} border border-current/20`
                    : "bg-white/6 text-gray-400 hover:text-white hover:bg-white/10"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t(`savings.categories.${cat}` as Parameters<typeof t>[0])}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Pots grid ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-gray-500">
          <PiggyBank className="w-8 h-8 animate-pulse" />
        </div>
      ) : pots.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-24 text-center gap-4"
        >
          <div className="w-20 h-20 rounded-2xl bg-emerald-400/10 flex items-center justify-center">
            <PiggyBank className="w-10 h-10 text-emerald-400" />
          </div>
          <div>
            <p className="text-white font-semibold">{t("savings.no_pots")}</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t("savings.add_pot")}
          </button>
        </motion.div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((pot) => (
              <PotCard
                key={pot.id}
                pot={pot}
                onEdit={() => { setEditing(pot); setShowForm(true); }}
                onDelete={() => setConfirmId(pot.id)}
                onDeposit={() => openDeposit(pot)}
                onWithdraw={() => openWithdraw(pot)}
                onHistory={() => openHistory(pot)}
              />
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* ── Modals ── */}
      <AnimatePresence>
        {showForm && (
          <PotFormModal
            key="pot-form"
            initial={editing}
            onSave={handleCreateOrUpdate}
            onClose={() => { setShowForm(false); setEditing(undefined); }}
            loading={createMut.isPending || updateMut.isPending}
          />
        )}
        {txPot && (
          <TxFormModal
            key="tx-form"
            pot={txPot}
            mode={txMode}
            onSave={handleTx}
            onClose={() => setTxPot(null)}
            loading={depositMut.isPending || withdrawMut.isPending}
          />
        )}
        {historyPot && (
          <TxHistoryPanel
            key="tx-history"
            pot={historyPot}
            onClose={() => setHistoryPot(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Delete confirm ── */}
      {confirmId && (
        <ConfirmModal
          title={t("savings.delete_pot")}
          message={t("savings.delete_confirm")}
          onConfirm={() => handleDelete(confirmId)}
          onCancel={() => setConfirmId(null)}
          loading={deleteMut.isPending}
        />
      )}

      <ToastList toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
