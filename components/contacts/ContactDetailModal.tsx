"use client";

import { useState, useEffect } from "react";
import {
  X, User, Building2, Landmark, HelpCircle,
  Phone, Mail, FileText, TrendingUp, TrendingDown,
  CheckCircle, AlertTriangle, Clock, Loader2,
} from "lucide-react";
import { FinancialContact, ContactSummary, Debt, DebtStatus, ContactType } from "@/types";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";

interface Props {
  contactId: string;
  onClose: () => void;
}

const TYPE_ICONS: Record<ContactType, React.ElementType> = {
  person: User, company: Building2, bank: Landmark, other: HelpCircle,
};

const STATUS_CONFIG: Record<DebtStatus, { icon: React.ElementType; color: string; bg: string }> = {
  active:         { icon: Clock,         color: "text-cyan-400",    bg: "bg-cyan-400/10"    },
  partially_paid: { icon: TrendingUp,    color: "text-amber-400",   bg: "bg-amber-400/10"   },
  paid:           { icon: CheckCircle,   color: "text-emerald-400", bg: "bg-emerald-400/10" },
  overdue:        { icon: AlertTriangle, color: "text-rose-400",    bg: "bg-rose-400/10"    },
};

const HEALTH_CONFIG = {
  healthy: { color: "text-cyan-400", bg: "bg-cyan-400/10", border: "border-cyan-400/20", icon: CheckCircle },
  attention_needed: { color: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/20", icon: Clock },
  high_risk: { color: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/20", icon: AlertTriangle },
  overdue: { color: "text-rose-400", bg: "bg-rose-400/10", border: "border-rose-400/20", icon: AlertTriangle },
  settled: { color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20", icon: CheckCircle },
};

export default function ContactDetailModal({ contactId, onClose }: Props) {
  const { t, formatDate } = useTranslation();
  const { format }        = useCurrency();

  const [loading, setLoading]     = useState(true);
  const [summary, setSummary]     = useState<ContactSummary | null>(null);
  const [error, setError]         = useState("");

  useEffect(() => {
    fetch(`/api/contacts/${contactId}/summary`)
      .then((r) => r.json())
      .then((data) => { setSummary(data); setLoading(false); })
      .catch(() => { setError(t("contacts.fetch_error")); setLoading(false); });
  }, [contactId, t]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
        <div className="modal-card w-full max-w-lg p-8 flex items-center justify-center gap-3 t3">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>{t("common.loading")}</span>
        </div>
      </div>
    );
  }

  if (!summary || error) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
        <div className="modal-card w-full max-w-lg p-8 text-center">
          <p className="text-sm text-rose-400 mb-3">{error || t("common.unknown_error")}</p>
          <button onClick={onClose} className="text-sm text-cyan-400 hover:underline">{t("common.cancel")}</button>
        </div>
      </div>
    );
  }

  const { contact, debts, totalPayable, totalReceivable, totalPaid, totalRemaining, netBalance,
    activeDebts, paidDebts, overdueDebts, lastPaymentDate } = summary;

  const TypeIcon = TYPE_ICONS[contact.type];
  const health = summary.health ?? "settled";
  const healthConfig = HEALTH_CONFIG[health];
  const HealthIcon = healthConfig.icon;
  const truthText = summary.truthKey
    ? t(summary.truthKey, {
        amount: format(Math.abs(netBalance)),
        count: activeDebts,
        overdue: overdueDebts,
        totalDebts: summary.totalDebts ?? debts.length,
        ...(summary.truthParams ?? {}),
      })
    : netBalance > 0
      ? t("contacts.they_owe", { amount: format(Math.abs(netBalance)) })
      : netBalance < 0
        ? t("contacts.i_owe", { amount: format(Math.abs(netBalance)) })
        : t("contacts.no_balance");

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[70] p-4">
      <div className="modal-card w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-[hsl(var(--border))] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400/20 to-purple-500/20 border border-white/10 flex items-center justify-center">
              <TypeIcon className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-base font-bold t1">{contact.name}</h2>
              <p className="text-xs t3">{t(`contacts.types.${contact.type}`)}</p>
            </div>
          </div>
          <div className={`hidden sm:flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border ${healthConfig.bg} ${healthConfig.color} ${healthConfig.border}`}>
            <HealthIcon className="w-3 h-3" />
            {t(`relationship.health.${health}`)}
          </div>
          <button onClick={onClose} className="t3 hover:t1 transition-colors p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Contact info */}
          {(contact.phone || contact.email || contact.notes) && (
            <div className="card-2 p-4 space-y-2">
              {contact.phone && (
                <div className="flex items-center gap-2 text-sm t2">
                  <Phone className="w-3.5 h-3.5 shrink-0 t3" />
                  <span>{contact.phone}</span>
                </div>
              )}
              {contact.email && (
                <div className="flex items-center gap-2 text-sm t2">
                  <Mail className="w-3.5 h-3.5 shrink-0 t3" />
                  <span>{contact.email}</span>
                </div>
              )}
              {contact.notes && (
                <div className="flex items-start gap-2 text-sm t2">
                  <FileText className="w-3.5 h-3.5 shrink-0 t3 mt-0.5" />
                  <span>{contact.notes}</span>
                </div>
              )}
            </div>
          )}

          {/* Net balance statement */}
          <div className={`rounded-2xl p-4 ${
            netBalance > 0 ? "bg-emerald-400/5 border border-emerald-400/20" :
            netBalance < 0 ? "bg-rose-400/5 border border-rose-400/20" :
            "bg-[hsl(var(--bg-input))] border border-[hsl(var(--border))]"
            }`}>
            <div className="flex items-start justify-between gap-3">
              <p className={`text-sm font-semibold ${
              netBalance > 0 ? "text-emerald-400" :
              netBalance < 0 ? "text-rose-400" : "t2"
              }`}>
                {truthText}
              </p>
              <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg border ${healthConfig.bg} ${healthConfig.color} ${healthConfig.border}`}>
                <HealthIcon className="w-3 h-3" />
                {t(`relationship.health.${health}`)}
              </span>
            </div>
          </div>

          {/* Financial truth */}
          <div className="card-2 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-xs font-semibold t3 uppercase tracking-wide">{t("relationship.financial_truth")}</h3>
                <p className="text-sm font-semibold t1 mt-1">{truthText}</p>
              </div>
              <div className={`p-2 rounded-xl ${healthConfig.bg}`}>
                <HealthIcon className={`w-4 h-4 ${healthConfig.color}`} />
              </div>
            </div>
            <p className="text-xs t2 leading-relaxed">{t(`relationship.health_description.${health}`)}</p>
            <div className="grid grid-cols-3 gap-2 mt-4">
              {[
                { label: t("relationship.recovery_rate"), value: `${Math.round(summary.recoveryRate ?? 0)}%`, color: "text-emerald-400" },
                { label: t("relationship.payment_velocity"), value: format(summary.paymentVelocity ?? 0), color: "text-cyan-400" },
                { label: t("relationship.risk_level"), value: t(`relationship.health.${health}`), color: healthConfig.color },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-[hsl(var(--bg-input))] px-3 py-2">
                  <p className="text-[10px] t3">{item.label}</p>
                  <p className={`text-xs font-bold mt-1 ${item.color}`}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: t("contacts.payable_to"),    value: format(totalPayable),    color: "text-rose-400",    icon: TrendingDown },
              { label: t("contacts.receivable_from"), value: format(totalReceivable), color: "text-emerald-400", icon: TrendingUp   },
              { label: t("contacts.total_paid"),    value: format(totalPaid),      color: "text-cyan-400",    icon: CheckCircle  },
              { label: t("contacts.total_remaining"), value: format(totalRemaining), color: "text-amber-400",   icon: Clock        },
            ].map((s) => (
              <div key={s.label} className="card-2 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <s.icon className={`w-3 h-3 ${s.color}`} />
                  <p className="text-[10px] t3 uppercase tracking-wide">{s.label}</p>
                </div>
                <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 px-1">
            {[
              { label: t("contacts.active_debts"),  value: activeDebts,  color: "text-cyan-400"    },
              { label: t("contacts.overdue_debts"), value: overdueDebts, color: "text-rose-400"    },
              { label: t("contacts.paid_debts"),    value: paidDebts,    color: "text-emerald-400" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] t3">{s.label}</p>
              </div>
            ))}
            {lastPaymentDate && (
              <div className="ms-auto text-end">
                <p className="text-xs t3">{t("contacts.last_payment")}</p>
                <p className="text-xs font-medium t1">{formatDate(lastPaymentDate)}</p>
              </div>
            )}
          </div>

          {/* Smart insights */}
          {summary.insights && summary.insights.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold t3 uppercase tracking-wide mb-3">{t("relationship.ai_insights")}</h3>
              <div className="space-y-2">
                {summary.insights.map((insight) => {
                  const tone =
                    insight.tone === "positive" ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" :
                    insight.tone === "risk" ? "text-rose-400 bg-rose-400/10 border-rose-400/20" :
                    insight.tone === "warning" ? "text-amber-400 bg-amber-400/10 border-amber-400/20" :
                    "text-cyan-400 bg-cyan-400/10 border-cyan-400/20";
                  return (
                    <div key={insight.key} className={`rounded-xl border px-3 py-2 ${tone}`}>
                      <p className="text-xs font-medium">{t(insight.key, insight.params)}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Relationship analytics */}
          <div>
            <h3 className="text-xs font-semibold t3 uppercase tracking-wide mb-3">{t("relationship.analytics")}</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: t("relationship.total_debts"), value: String(summary.totalDebts ?? debts.length) },
                { label: t("relationship.average_payment_days"), value: `${summary.averagePaymentDays ?? 0}` },
                { label: t("relationship.largest_debt"), value: format(summary.largestDebt ?? 0) },
                { label: t("relationship.repayment_rate"), value: `${Math.round(summary.repaymentRate ?? 0)}%` },
              ].map((item) => (
                <div key={item.label} className="card-2 p-3">
                  <p className="text-[10px] t3 uppercase tracking-wide">{item.label}</p>
                  <p className="text-sm font-bold t1 mt-1">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Financial timeline */}
          {summary.timeline && summary.timeline.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold t3 uppercase tracking-wide mb-3">{t("relationship.timeline.title")}</h3>
              <div className="relative space-y-2">
                {summary.timeline.slice(0, 8).map((event) => {
                  const eventColor =
                    event.type === "payment" ? "bg-cyan-400" :
                    event.type === "settled" ? "bg-emerald-400" :
                    event.type === "overdue" ? "bg-rose-400" :
                    event.debtType === "receivable" ? "bg-emerald-400" : "bg-rose-400";
                  return (
                    <div key={event.id} className="flex gap-3">
                      <div className="flex flex-col items-center pt-1">
                        <span className={`w-2.5 h-2.5 rounded-full ${eventColor}`} />
                        <span className="w-px flex-1 bg-[hsl(var(--border))] mt-1" />
                      </div>
                      <div className="flex-1 card-2 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold t1">{t(event.titleKey)}</p>
                          <span className="text-[10px] t3">{formatDate(event.date)}</span>
                        </div>
                        <p className="text-xs t2 mt-1">{t(event.descriptionKey, event.params)}</p>
                        {event.amount > 0 && <p className="text-xs font-bold t1 mt-1">{format(event.amount)}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Debt list */}
          <div>
            <h3 className="text-xs font-semibold t3 uppercase tracking-wide mb-3">{t("contacts.debt_timeline")}</h3>
            {debts.length === 0 ? (
              <div className="empty-state py-6">
                <p className="empty-state-title">{t("contacts.no_debts")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(debts as Debt[]).map((debt) => {
                  const cfg  = STATUS_CONFIG[debt.status];
                  const paid = Number(debt.paid_amount);
                  const total = Number(debt.total_amount);
                  const remaining = debt.remaining_amount ?? Math.max(total - paid, 0);
                  const pct  = debt.progress ?? (total > 0 ? (paid / total) * 100 : 0);
                  return (
                    <div key={debt.id} className="card-2 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`p-1 rounded-lg shrink-0 ${cfg.bg}`}>
                            <cfg.icon className={`w-3 h-3 ${cfg.color}`} />
                          </div>
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md ${
                            debt.debt_type === "payable" ? "bg-rose-400/10 text-rose-400" : "bg-emerald-400/10 text-emerald-400"
                          }`}>
                            {t(`debts.${debt.debt_type}`)}
                          </span>
                        </div>
                        <div className="text-end">
                          <p className="text-xs font-semibold t1">{format(remaining)}</p>
                          <p className="text-[10px] t3">{t("debts.remaining")}</p>
                        </div>
                      </div>
                      <div className="h-1 bg-[hsl(var(--bg-input))] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: cfg.color.replace("text-", "#").length > 7 ? "#F59E0B" : "#F59E0B",
                            background: debt.status === "paid" ? "#10B981" : debt.status === "overdue" ? "#F43F5E" : "#F59E0B" }} />
                      </div>
                      {debt.due_date && (
                        <p className="text-[10px] t3 mt-1">{t("debts.due", { date: formatDate(debt.due_date) })}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
