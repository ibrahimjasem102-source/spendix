"use client";

import { useMemo } from "react";
import type { Debt } from "@/types";

interface Props {
  debt: Debt;
  format: (n: number) => string;
  locale?: string;
  isReceivable?: boolean;
}

type EvtType = "created" | "payment" | "settled" | "outstanding";

interface Evt {
  id: string;
  type: EvtType;
  date: string;
  paidAmount?: number;
  remaining: number;
  notes?: string | null;
}

export default function DebtTimeline({ debt, format, locale = "en", isReceivable }: Props) {
  const events = useMemo<Evt[]>(() => {
    const total = Number(debt.total_amount);
    const payments = [...(debt.payments ?? [])].sort(
      (a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime(),
    );

    const evts: Evt[] = [
      { id: `created-${debt.id}`, type: "created", date: debt.created_at, remaining: total },
    ];

    let cumPaid = 0;
    for (const p of payments) {
      cumPaid += Number(p.amount);
      evts.push({
        id: p.id,
        type: "payment",
        date: p.payment_date,
        paidAmount: Number(p.amount),
        remaining: Math.max(0, total - cumPaid),
        notes: p.notes,
      });
    }

    if (debt.status === "paid") {
      evts.push({ id: `settled-${debt.id}`, type: "settled", date: debt.updated_at, remaining: 0 });
    } else {
      const rem = Number(debt.remaining_amount ?? (total - Number(debt.paid_amount)));
      evts.push({ id: `outstanding-${debt.id}`, type: "outstanding", date: "", remaining: rem });
    }

    return evts;
  }, [debt]);

  const dateLocale = locale === "ar" ? "ar-SA" : locale === "de" ? "de-DE" : locale === "fr" ? "fr-FR" : locale === "es" ? "es-ES" : "en-US";

  function fmtDate(d: string) {
    if (!d) return "";
    try {
      const parsed = d.includes("T") ? new Date(d) : new Date(`${d}T00:00:00`);
      return parsed.toLocaleDateString(dateLocale, { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return d;
    }
  }

  return (
    <div className="relative ps-4">
      {/* Vertical connector line */}
      <div className="absolute start-[5px] top-2.5 bottom-2.5 w-px bg-[hsl(var(--border-2))]" />

      {events.map((evt, idx) => {
        const isLast = idx === events.length - 1;

        let dotColor = "";
        let labelColor = "";
        let label = "";
        let isOutline = false;
        let rightText: React.ReactNode = null;
        let rightSub: React.ReactNode = null;

        const paySign = isReceivable ? "+" : "−";
        const payColor = isReceivable ? "text-emerald-400" : "text-rose-400";

        switch (evt.type) {
          case "created":
            dotColor  = "bg-cyan-400";
            labelColor = "text-cyan-400";
            label     = "Created";
            rightText = <span className="text-xs font-bold t1 tabular-nums">{format(evt.remaining)}</span>;
            break;
          case "payment":
            dotColor  = "bg-emerald-400";
            labelColor = "text-emerald-400";
            label     = "Payment";
            rightText = <span className={`text-xs font-bold tabular-nums ${payColor}`}>{paySign}{format(evt.paidAmount!)}</span>;
            rightSub  = <span className="text-[10px] t3 tabular-nums">{format(evt.remaining)} left</span>;
            break;
          case "settled":
            dotColor  = "bg-emerald-400";
            labelColor = "text-emerald-400";
            label     = "Settled";
            rightText = <span className="text-xs font-bold text-emerald-400">Paid off</span>;
            break;
          case "outstanding":
            isOutline  = true;
            labelColor = "text-amber-400";
            label      = "Outstanding";
            rightText  = <span className="text-xs font-bold text-amber-400 tabular-nums">{format(evt.remaining)}</span>;
            break;
        }

        return (
          <div key={evt.id} className={`relative flex items-start gap-3 ${isLast ? "" : "pb-3"}`}>
            {/* Dot */}
            <div
              className={`relative z-10 mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                isOutline
                  ? "border-2 border-amber-400 bg-transparent"
                  : `${dotColor} border-2 border-[hsl(var(--bg-card))]`
              }`}
            />

            {/* Content */}
            <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={`text-xs font-semibold leading-tight ${labelColor}`}>{label}</p>
                {evt.date && (
                  <p className="text-[10px] t3 mt-0.5">{fmtDate(evt.date)}</p>
                )}
                {evt.notes && (
                  <p className="text-[10px] t3 italic truncate mt-0.5 max-w-[160px]">{evt.notes}</p>
                )}
              </div>
              <div className="flex flex-col items-end shrink-0">
                {rightText}
                {rightSub}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
