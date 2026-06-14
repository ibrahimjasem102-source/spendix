"use client";

import { use, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Phone, Mail, FileText,
  ArrowUpRight, ArrowDownRight, Pencil,
  Bookmark, Receipt, ExternalLink, AlertTriangle,
  CheckCircle2, Clock, DollarSign,
} from "lucide-react";
import { useContactSummary, useDebts } from "@/lib/query/hooks";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import DebtTimeline from "@/components/debts/DebtTimeline";
import type { Debt, DebtStatus } from "@/types";

// ── Helpers ────────────────────────────────────────────────────

function ContactAvatar({ name, size = "lg" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  const sizeMap = { sm: "h-9 w-9 text-sm", md: "h-12 w-12 text-base", lg: "h-16 w-16 text-xl" };
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-2xl font-bold bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 text-cyan-300 ${sizeMap[size]}`}>
      {initials || "?"}
    </div>
  );
}

const STATUS_CFG: Record<DebtStatus, { color: string; bg: string; bar: string }> = {
  active:         { color: "text-cyan-400",    bg: "bg-cyan-400/10",    bar: "#06B6D4" },
  partially_paid: { color: "text-amber-400",   bg: "bg-amber-400/10",   bar: "#F59E0B" },
  paid:           { color: "text-emerald-400", bg: "bg-emerald-400/10", bar: "#10B981" },
  overdue:        { color: "text-rose-400",    bg: "bg-rose-400/10",    bar: "#F43F5E" },
};

// ── Stat card ──────────────────────────────────────────────────

function StatCard({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div className="card p-3.5">
      <p className="text-[10px] t3 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-base font-black tabular-nums ${color}`}>{value}</p>
      {sub && <p className="text-[10px] t3 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Debt card with full timeline ───────────────────────────────

function DebtCard({
  debt,
  format,
  locale,
}: {
  debt: Debt;
  format: (n: number) => string;
  locale: string;
}) {
  const [open, setOpen] = useState(false);
  const cfg = STATUS_CFG[debt.status as DebtStatus] ?? STATUS_CFG.active;
  const total     = Number(debt.total_amount);
  const paid      = Number(debt.paid_amount ?? 0);
  const remaining = Number(debt.remaining_amount ?? (total - paid));
  const pct       = total > 0 ? Math.min((paid / total) * 100, 100) : 0;
  const isReceivable = debt.debt_type === "receivable";

  return (
    <div className={`card overflow-hidden ${debt.status === "overdue" ? "border-rose-400/25" : ""}`}>
      {/* Progress accent */}
      <div className="h-0.5" style={{
        background: `linear-gradient(90deg, ${cfg.bar} 0%, ${cfg.bar} ${pct}%, hsl(var(--bg-input)) ${pct}%)`,
      }} />

      {/* Header row */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-3 w-full px-4 py-3.5 text-start hover:bg-[hsl(var(--bg-input))] transition-colors"
      >
        {/* Direction icon */}
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
          {isReceivable
            ? <ArrowDownRight className={`w-4 h-4 ${cfg.color}`} />
            : <ArrowUpRight   className={`w-4 h-4 ${cfg.color}`} />}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${cfg.bg} ${cfg.color}`}>
              {debt.status.replace("_", " ")}
            </span>
            <span className="text-[9px] t3 uppercase">
              {isReceivable ? "receivable" : "payable"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-[hsl(var(--bg-input))] rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cfg.bar }} />
            </div>
            <span className={`text-[10px] font-bold ${cfg.color}`}>{pct.toFixed(0)}%</span>
          </div>
        </div>

        {/* Amount */}
        <div className="text-end shrink-0">
          <p className="text-sm font-bold t1 tabular-nums">{format(remaining)}</p>
          <p className="text-[10px] t3">remaining</p>
        </div>
      </button>

      {/* Expanded: timeline */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-4 pb-4 pt-2 border-t border-[hsl(var(--border-2))]">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { label: "Total",     val: format(total),     color: "t1"               },
                  { label: "Paid",      val: format(paid),      color: "text-emerald-400"  },
                  { label: "Remaining", val: format(remaining), color: isReceivable ? "text-emerald-400" : "text-rose-400" },
                ].map((s) => (
                  <div key={s.label} className="bg-[hsl(var(--bg-input))] rounded-xl p-2 text-center">
                    <p className="text-[9px] t3 uppercase">{s.label}</p>
                    <p className={`text-xs font-bold mt-0.5 tabular-nums ${s.color}`}>{s.val}</p>
                  </div>
                ))}
              </div>

              {/* Due date */}
              {debt.due_date && (
                <p className={`text-xs flex items-center gap-1.5 mb-3 ${debt.status === "overdue" ? "text-rose-400" : "t3"}`}>
                  <Clock className="w-3 h-3 shrink-0" />
                  Due {new Date(`${debt.due_date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </p>
              )}

              {/* Timeline */}
              <p className="text-[10px] font-bold t3 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Receipt className="w-3 h-3" />
                Timeline
              </p>
              <DebtTimeline debt={debt} format={format} locale={locale} isReceivable={isReceivable} />

              {/* Notes */}
              {debt.notes && (
                <p className="text-xs t3 italic mt-3 pt-3 border-t border-[hsl(var(--border-2))]">{debt.notes}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Payment history (flat list across all contact debts) ───────

interface Payment {
  id: string;
  debtId: string;
  amount: number;
  date: string;
  notes: string | null;
  debtType: string;
}

function PaymentHistory({
  payments,
  format,
  locale,
}: {
  payments: Payment[];
  format: (n: number) => string;
  locale: string;
}) {
  const dateLocale = locale === "ar" ? "ar-SA" : locale === "de" ? "de-DE" : "en-US";
  if (payments.length === 0) return null;

  return (
    <div className="card overflow-hidden">
      {payments.map((p, i) => {
        const isReceivable = p.debtType === "receivable";
        return (
          <div
            key={p.id}
            className={`flex items-center gap-3 px-4 py-3 ${i < payments.length - 1 ? "border-b border-[hsl(var(--border-2))]" : ""}`}
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isReceivable ? "bg-emerald-400/10" : "bg-rose-400/10"}`}>
              <DollarSign className={`w-3.5 h-3.5 ${isReceivable ? "text-emerald-400" : "text-rose-400"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs t3">
                {new Date(`${p.date}T00:00:00`).toLocaleDateString(dateLocale, { day: "numeric", month: "short", year: "numeric" })}
              </p>
              {p.notes && <p className="text-[10px] t3 italic truncate">{p.notes}</p>}
            </div>
            <span className={`text-sm font-bold tabular-nums shrink-0 ${isReceivable ? "text-emerald-400" : "text-rose-400"}`}>
              {isReceivable ? "+" : "−"}{format(p.amount)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────

export default function ContactProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id }     = use(params);
  const router     = useRouter();
  const { locale } = useTranslation();
  const { format } = useCurrency();

  const { data, isLoading, isError, refetch } = useContactSummary(id, true);
  const { data: debtsResult }                 = useDebts(true);

  // Debts for this specific contact — includes per-debt payment arrays
  const contactDebts: Debt[] = useMemo(() =>
    (debtsResult?.debts ?? []).filter((d) => d.contact_id === id),
    [debtsResult, id],
  );

  // Flat sorted payment history across all contact debts
  const allPayments: Payment[] = useMemo(() => {
    const list: Payment[] = [];
    for (const d of contactDebts) {
      for (const p of (d.payments ?? [])) {
        list.push({
          id:       p.id,
          debtId:   d.id,
          amount:   Number(p.amount),
          date:     p.payment_date,
          notes:    p.notes ?? null,
          debtType: d.debt_type,
        });
      }
    }
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [contactDebts]);

  if (isLoading) return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => router.back()} className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--bg-3))]">
          <ArrowLeft className="h-4 w-4 t2" />
        </button>
        <div className="h-5 w-32 rounded-lg bg-[hsl(var(--bg-3))] animate-pulse" />
      </div>
      <LoadingState rows={5} />
    </div>
  );

  if (isError || !data?.contact) return (
    <div className="space-y-4">
      <button onClick={() => router.back()} className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--bg-3))]">
        <ArrowLeft className="h-4 w-4 t2" />
      </button>
      <ErrorState type="network" onRetry={refetch} />
    </div>
  );

  const contact    = data.contact as { id: string; name: string; type: string; phone?: string | null; email?: string | null; notes?: string | null };
  const netBalance = (data.netBalance as number) ?? 0;
  const totalPaid  = contactDebts.reduce((s, d) => s + Number(d.paid_amount), 0);
  const activeDebt = contactDebts.filter((d) => d.status !== "paid");
  const paidDebts  = contactDebts.filter((d) => d.status === "paid");

  const balancePositive = netBalance > 0;
  const balanceNegative = netBalance < 0;

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-4 pb-8">

      {/* ── Back + title ───────────────────────────────────────── */}
      <motion.div variants={staggerItem} className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--bg-3))] t2 hover:t1 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-base font-bold t1 truncate">{contact.name}</h1>
      </motion.div>

      {/* ── Contact card ────────────────────────────────────────── */}
      <motion.div variants={staggerItem} className="card p-5">
        <div className="flex items-start gap-4">
          <ContactAvatar name={contact.name} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-xl font-black t1 leading-tight">{contact.name}</h2>
                <p className="text-xs t3 capitalize mt-0.5">{contact.type}</p>
              </div>
              <div className={`text-end shrink-0`}>
                {balancePositive && (
                  <p className="text-sm font-bold text-emerald-400 tabular-nums">+{format(netBalance)}</p>
                )}
                {balanceNegative && (
                  <p className="text-sm font-bold text-rose-400 tabular-nums">−{format(Math.abs(netBalance))}</p>
                )}
                {!balancePositive && !balanceNegative && (
                  <p className="text-xs text-emerald-400 font-semibold">Settled</p>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1.5 mt-3">
              {contact.phone && (
                <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-xs t3 hover:t2 transition-colors">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  {contact.phone}
                </a>
              )}
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-xs t3 hover:t2 transition-colors">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  {contact.email}
                </a>
              )}
            </div>
          </div>
        </div>
        {contact.notes && (
          <div className="mt-4 p-3 rounded-xl bg-[hsl(var(--bg-3))] flex items-start gap-2">
            <FileText className="h-3.5 w-3.5 t3 shrink-0 mt-0.5" />
            <p className="text-xs t3 leading-relaxed">{contact.notes}</p>
          </div>
        )}
      </motion.div>

      {/* ── Financial summary ────────────────────────────────────── */}
      <motion.div variants={staggerItem}>
        <p className="text-[10px] font-bold t3 uppercase tracking-[0.15em] mb-2 px-1">Summary</p>
        <div className="grid grid-cols-2 gap-2">
          <div className={`card col-span-2 p-4 ${balancePositive ? "border-emerald-400/20 bg-emerald-400/5" : balanceNegative ? "border-rose-400/20 bg-rose-400/5" : ""}`}>
            <p className="text-[10px] t3 uppercase tracking-wide mb-1">Net Balance</p>
            <p className={`text-2xl font-black tabular-nums ${balancePositive ? "text-emerald-400" : balanceNegative ? "text-rose-400" : "t3"}`}>
              {balancePositive ? "+" : balanceNegative ? "−" : ""}{format(Math.abs(netBalance))}
            </p>
            <p className="text-[11px] t3 mt-0.5">
              {balancePositive ? "They owe you" : balanceNegative ? "You owe them" : "No outstanding balance"}
            </p>
          </div>
          <StatCard label="You owe" value={format((data.totalPayable as number) ?? 0)} color="text-rose-400" />
          <StatCard label="Owe you" value={format((data.totalReceivable as number) ?? 0)} color="text-emerald-400" />
          <StatCard label="Total paid" value={format(totalPaid)} color="text-cyan-400" sub={`${allPayments.length} payment${allPayments.length !== 1 ? "s" : ""}`} />
          <StatCard label="Debts" value={String(contactDebts.length)} color="t1" sub={`${activeDebt.length} active · ${paidDebts.length} settled`} />
        </div>
      </motion.div>

      {/* ── Debt Timeline ────────────────────────────────────────── */}
      {contactDebts.length > 0 && (
        <motion.div variants={staggerItem}>
          <p className="text-[10px] font-bold t3 uppercase tracking-[0.15em] mb-2 px-1 flex items-center gap-1.5">
            <Bookmark className="w-3 h-3" />
            Debt Timeline
          </p>
          <div className="space-y-2">
            {/* Active / overdue first */}
            {activeDebt.map((d) => (
              <DebtCard key={d.id} debt={d} format={format} locale={locale} />
            ))}
            {/* Paid debts collapsible */}
            {paidDebts.length > 0 && (
              <div>
                <p className="text-[10px] t3 px-1 mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  {paidDebts.length} settled debt{paidDebts.length !== 1 ? "s" : ""}
                </p>
                {paidDebts.map((d) => (
                  <DebtCard key={d.id} debt={d} format={format} locale={locale} />
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Payment History ──────────────────────────────────────── */}
      {allPayments.length > 0 && (
        <motion.div variants={staggerItem}>
          <p className="text-[10px] font-bold t3 uppercase tracking-[0.15em] mb-2 px-1 flex items-center gap-1.5">
            <Receipt className="w-3 h-3" />
            Payment History <span className="font-normal opacity-60">({allPayments.length})</span>
          </p>
          <PaymentHistory payments={allPayments} format={format} locale={locale} />

          {/* Ledger connection note */}
          <div className="mt-2 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[hsl(var(--bg-input))]">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <p className="text-[10px] t3 flex-1">
              All payments are recorded in your ledger
            </p>
            <a
              href="/ledger"
              className="text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-0.5 shrink-0 transition-colors"
            >
              View <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </motion.div>
      )}

      {/* ── Warning: overdue debts ───────────────────────────────── */}
      {contactDebts.some((d) => d.status === "overdue") && (
        <motion.div variants={staggerItem}>
          <div className="flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-400/5 p-3.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-rose-400">Overdue debt</p>
              <p className="text-xs t3 mt-0.5">
                {contactDebts.filter((d) => d.status === "overdue").length} debt(s) with this contact are overdue.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Empty state ──────────────────────────────────────────── */}
      {contactDebts.length === 0 && (
        <motion.div variants={staggerItem} className="card py-10 text-center">
          <Bookmark className="w-8 h-8 t3 opacity-20 mx-auto mb-3" />
          <p className="text-sm font-semibold t2">No debts with this contact</p>
          <a href="/debts" className="text-xs text-cyan-400 hover:underline mt-2 block">
            Add a debt →
          </a>
        </motion.div>
      )}

      {/* ── Footer link to debts ─────────────────────────────────── */}
      <motion.div variants={staggerItem} className="pb-4 flex justify-center">
        <a
          href="/debts"
          className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          View all debts
        </a>
      </motion.div>
    </motion.div>
  );
}
