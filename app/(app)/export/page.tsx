"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Download, FileText, Target, Landmark, TrendingUp,
  Briefcase, Shield, CheckCircle2, Loader2,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useGuest } from "@/contexts/GuestContext";
import { safeFetch } from "@/lib/fetch-safe";
import { spring, tapTransition } from "@/lib/motion";

// ── Export items ───────────────────────────────────────────────

interface ExportItem {
  type: string;
  labelKey: string;
  descKey: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  format: "csv" | "json";
}

const EXPORTS: ExportItem[] = [
  {
    type: "transactions",
    labelKey: "nav.transactions",
    descKey:  "export.desc_transactions",
    icon: FileText,
    color: "text-cyan-400",
    bg:    "bg-cyan-400/10",
    format: "csv",
  },
  {
    type: "goals",
    labelKey: "nav.goals",
    descKey:  "export.desc_goals",
    icon: Target,
    color: "text-amber-400",
    bg:    "bg-amber-400/10",
    format: "csv",
  },
  {
    type: "debts",
    labelKey: "nav.debts",
    descKey:  "export.desc_debts",
    icon: Landmark,
    color: "text-rose-400",
    bg:    "bg-rose-400/10",
    format: "csv",
  },
  {
    type: "investments",
    labelKey: "nav.investments",
    descKey:  "export.desc_investments",
    icon: TrendingUp,
    color: "text-purple-400",
    bg:    "bg-purple-400/10",
    format: "csv",
  },
  {
    type: "work",
    labelKey: "nav.work",
    descKey:  "export.desc_work",
    icon: Briefcase,
    color: "text-emerald-400",
    bg:    "bg-emerald-400/10",
    format: "csv",
  },
  {
    type: "backup",
    labelKey: "export.backup",
    descKey:  "export.desc_backup",
    icon: Shield,
    color: "text-sky-400",
    bg:    "bg-sky-400/10",
    format: "json",
  },
];

// ── Page ───────────────────────────────────────────────────────

export default function ExportPage() {
  const { t }     = useTranslation();
  const { isGuest } = useGuest();
  const [loading, setLoading] = useState<string | null>(null);
  const [done,    setDone]    = useState<string | null>(null);

  async function handleExport(item: ExportItem) {
    if (isGuest) return;
    setLoading(item.type);
    setDone(null);
    try {
      const res = await safeFetch(`/api/export?type=${item.type}`);
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const ext  = item.format === "json" ? "json" : "csv";
      const date = new Date().toISOString().slice(0, 10);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `spendix-${item.type}-${date}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      setDone(item.type);
      setTimeout(() => setDone(null), 3000);
    } catch {
      // silent - user will see nothing changed
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/10">
          <Download className="h-4 w-4 text-cyan-400" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-black t1">{t("export.title")}</h1>
          <p className="mt-0.5 text-xs font-medium t3">{t("export.subtitle")}</p>
        </div>
      </div>

      {isGuest && (
        <div className="card p-4 border-amber-400/20 bg-amber-400/5">
          <p className="text-sm text-amber-300 font-semibold">{t("export.guest_notice")}</p>
          <p className="text-xs text-amber-300/70 mt-1">{t("export.guest_hint")}</p>
        </div>
      )}

      {/* Info banner */}
      {!isGuest && (
        <div className="rounded-[1.25rem] border border-cyan-400/15 bg-cyan-400/5 px-4 py-3">
          <p className="text-xs text-cyan-300/80">{t("export.info")}</p>
        </div>
      )}

      {/* Export items */}
      <div className="space-y-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide t3 px-1">{t("export.section_data")}</p>
        {EXPORTS.map((item) => {
          const Icon    = item.icon;
          const isLoad  = loading === item.type;
          const isDone  = done    === item.type;
          const isBig   = item.type === "backup";

          return (
            <motion.button
              key={item.type}
              type="button"
              onClick={() => handleExport(item)}
              disabled={isGuest || !!loading}
              whileTap={{ scale: 0.98 }}
              transition={tapTransition}
              className={`w-full card p-4 flex items-center gap-3 text-start transition-all disabled:opacity-40 ${
                isBig ? "border-sky-400/20 bg-sky-400/5" : ""
              }`}
            >
              {/* Icon */}
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${item.bg}`}>
                <Icon className={`w-4 h-4 ${item.color}`} />
              </div>

              {/* Label */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold t1 ${isBig ? "text-sky-300" : ""}`}>{t(item.labelKey)}</p>
                <p className="text-xs t3 mt-0.5">{t(item.descKey)}</p>
              </div>

              {/* Badge */}
              <div className={`shrink-0 flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full ${item.bg} ${item.color}`}>
                {item.format.toUpperCase()}
              </div>

              {/* Action */}
              <div className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-[hsl(var(--bg-input))]">
                {isLoad ? (
                  <Loader2 className="w-4 h-4 animate-spin t3" />
                ) : isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Download className="w-4 h-4 t3" />
                )}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Help text */}
      <div className="card p-4 space-y-2">
        <p className="text-xs font-semibold t2">{t("export.help_title")}</p>
        <p className="text-xs t3 leading-relaxed">{t("export.help_body")}</p>
      </div>
    </div>
  );
}
