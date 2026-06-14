"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Plus, CheckCircle2, Clock, Send, XCircle,
  AlertTriangle, Loader2, MoreHorizontal, DollarSign,
} from "lucide-react";
import { getAuthToken } from "@/lib/auth/token-store";
import { useCurrency } from "@/lib/currency";

// ── Types ──────────────────────────────────────────────────────

interface Invoice {
  id: string;
  number: string;
  title: string;
  status: "draft" | "sent" | "viewed" | "paid" | "overdue" | "cancelled";
  issue_date: string;
  due_date?: string;
  total: number;
  currency: string;
  contact?: { id: string; name: string } | null;
  project?: { id: string; name: string } | null;
}

// ── Status config ──────────────────────────────────────────────

const STATUS_CONFIG = {
  draft:      { label: "مسودة",    color: "text-slate-400 bg-slate-400/10",   icon: FileText },
  sent:       { label: "مُرسَلة",  color: "text-blue-400 bg-blue-400/10",     icon: Send },
  viewed:     { label: "مُشاهَدة", color: "text-purple-400 bg-purple-400/10", icon: Clock },
  paid:       { label: "مدفوعة",   color: "text-emerald-400 bg-emerald-400/10", icon: CheckCircle2 },
  overdue:    { label: "متأخرة",   color: "text-red-400 bg-red-400/10",       icon: AlertTriangle },
  cancelled:  { label: "ملغاة",    color: "text-slate-500 bg-slate-500/10",   icon: XCircle },
} as const;

type StatusFilter = "all" | Invoice["status"];

// ── Fetch hook ─────────────────────────────────────────────────

function useInvoices(status?: string) {
  return useQuery({
    queryKey: ["invoices", status],
    queryFn: async () => {
      const token = getAuthToken();
      const url = status && status !== "all" ? `/api/invoices?status=${status}` : "/api/invoices";
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      return d.data as Invoice[];
    },
  });
}

// ── Invoice card ───────────────────────────────────────────────

function InvoiceRow({ invoice, onStatusChange }: {
  invoice: Invoice;
  onStatusChange: (id: string, status: Invoice["status"]) => void;
}) {
  const { format } = useCurrency();
  const [menuOpen, setMenuOpen] = useState(false);
  const cfg = STATUS_CONFIG[invoice.status];
  const StatusIcon = cfg.icon;

  const nextStatuses: { value: Invoice["status"]; label: string }[] = invoice.status === "draft"
    ? [{ value: "sent", label: "إرسال" }, { value: "cancelled", label: "إلغاء" }]
    : invoice.status === "sent"
    ? [{ value: "paid", label: "تحديد كمدفوعة" }, { value: "overdue", label: "متأخرة" }]
    : [];

  return (
    <div className="card p-4 flex items-center gap-4 hover:bg-[hsl(var(--bg-input))]/40 transition-colors">
      {/* Status icon */}
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cfg.color}`}>
        <StatusIcon className="w-4 h-4" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-xs font-bold text-[hsl(var(--text-3))]">{invoice.number}</p>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cfg.color}`}>
            {cfg.label}
          </span>
        </div>
        <p className="text-sm font-semibold t1 truncate">{invoice.title}</p>
        <p className="text-xs t3 truncate">
          {invoice.contact?.name ?? "—"}
          {invoice.due_date && ` · تستحق ${new Date(invoice.due_date).toLocaleDateString("ar-SA")}`}
        </p>
      </div>

      {/* Amount */}
      <div className="text-end shrink-0">
        <p className="text-base font-black t1">{format(invoice.total)}</p>
        <p className="text-xs t3">{invoice.issue_date}</p>
      </div>

      {/* Actions */}
      {nextStatuses.length > 0 && (
        <div className="relative shrink-0">
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="p-2 rounded-xl hover:bg-[hsl(var(--bg-input))] transition-colors"
          >
            <MoreHorizontal className="w-4 h-4 t3" />
          </button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute top-full end-0 mt-1 z-20 w-40 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--bg-card))] shadow-xl overflow-hidden"
                onMouseLeave={() => setMenuOpen(false)}
              >
                {nextStatuses.map(s => (
                  <button
                    key={s.value}
                    onClick={() => { onStatusChange(invoice.id, s.value); setMenuOpen(false); }}
                    className="w-full px-3 py-2.5 text-xs font-semibold t2 hover:bg-[hsl(var(--bg-input))] text-start transition-colors"
                  >
                    {s.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

// ── Create invoice quick form ──────────────────────────────────

function CreateInvoiceSheet({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title,       setTitle]      = useState("");
  const [amount,      setAmount]     = useState("");
  const [description, setDesc]       = useState("");
  const [loading,     setLoading]    = useState(false);

  async function submit() {
    if (!title.trim() || !amount) return;
    setLoading(true);
    const token = getAuthToken();
    await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title,
        issue_date: new Date().toISOString().split("T")[0],
        items: [{ description: description || title, quantity: 1, unit_price: parseFloat(amount) }],
      }),
    });
    setLoading(false);
    onCreated();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6"
      style={{ backgroundColor: "rgba(11,15,20,0.80)", backdropFilter: "blur(6px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 360, damping: 38 }}
        className="w-full sm:max-w-md card rounded-t-[1.75rem] sm:rounded-[1.5rem] p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <p className="text-base font-black t1">فاتورة جديدة</p>
          <button onClick={onClose} className="p-1.5 rounded-lg t3 hover:t1 transition-colors text-lg">✕</button>
        </div>

        <div className="space-y-3">
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="عنوان الفاتورة" className="input-field w-full text-sm" />
          <textarea value={description} onChange={e => setDesc(e.target.value)}
            placeholder="وصف الخدمة (اختياري)" rows={2}
            className="input-field w-full text-sm resize-none" />
          <input value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="المبلغ" type="number" min="0" className="input-field w-full text-sm" />
        </div>

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 rounded-xl border border-[hsl(var(--border))] py-3 text-sm font-semibold t2">
            إلغاء
          </button>
          <button onClick={submit} disabled={!title.trim() || !amount || loading}
            className="flex-1 rounded-xl py-3 text-sm font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-600 disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            إنشاء
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────

export default function InvoicesPage() {
  const { format } = useCurrency();
  const [filter,      setFilter]      = useState<StatusFilter>("all");
  const [showCreate,  setShowCreate]  = useState(false);
  const queryClient = useQueryClient();
  const { data: invoices = [], isLoading } = useInvoices(filter === "all" ? undefined : filter);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Invoice["status"] }) => {
      const token = getAuthToken();
      await fetch(`/api/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoices"] }),
  });

  const totalPaid    = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.total, 0);
  const totalPending = invoices.filter(i => ["draft","sent","viewed"].includes(i.status)).reduce((s, i) => s + i.total, 0);
  const totalOverdue = invoices.filter(i => i.status === "overdue").reduce((s, i) => s + i.total, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black t1">الفواتير</h1>
          <p className="text-xs t3 mt-0.5">{invoices.length} فاتورة</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-2.5 text-sm font-bold text-white"
        >
          <Plus className="w-4 h-4" />
          فاتورة جديدة
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "مدفوعة",   value: totalPaid,    color: "text-emerald-400", icon: CheckCircle2 },
          { label: "معلقة",    value: totalPending, color: "text-blue-400",    icon: Clock },
          { label: "متأخرة",   value: totalOverdue, color: "text-red-400",     icon: AlertTriangle },
        ].map(kpi => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="card p-3 text-center">
              <Icon className={`w-4 h-4 mx-auto mb-1 ${kpi.color}`} />
              <p className={`text-base font-black ${kpi.color}`}>{format(kpi.value)}</p>
              <p className="text-[10px] t3">{kpi.label}</p>
            </div>
          );
        })}
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {(["all", "draft", "sent", "paid", "overdue"] as StatusFilter[]).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold shrink-0 transition-all ${
              filter === s
                ? "bg-cyan-400/10 border border-cyan-400/30 text-cyan-400"
                : "border border-[hsl(var(--border))] t3 hover:t2"
            }`}
          >
            {s === "all" ? "الكل" : STATUS_CONFIG[s]?.label ?? s}
          </button>
        ))}
      </div>

      {/* Invoice list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="card p-12 text-center">
          <DollarSign className="w-10 h-10 t3 mx-auto mb-3" />
          <p className="text-sm font-bold t1 mb-1">لا توجد فواتير</p>
          <p className="text-xs t3">أنشئ فاتورتك الأولى لتتبع إيراداتك</p>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map(invoice => (
            <InvoiceRow
              key={invoice.id}
              invoice={invoice}
              onStatusChange={(id, status) => updateStatus.mutate({ id, status })}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {showCreate && (
          <CreateInvoiceSheet
            onClose={() => setShowCreate(false)}
            onCreated={() => queryClient.invalidateQueries({ queryKey: ["invoices"] })}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
