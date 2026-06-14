"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Plus, Trash2, ToggleLeft, ToggleRight, Loader2,
  BellRing, Target, Receipt, Webhook, CheckCircle2, XCircle,
} from "lucide-react";
import { getAuthToken } from "@/lib/auth/token-store";
import type { TriggerType, ActionType } from "@/lib/automation/types";

interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  trigger_type: TriggerType;
  action_type: ActionType;
  trigger_config: Record<string, unknown>;
  action_config: Record<string, unknown>;
  created_at: string;
  logs?: { id: string; triggered_at: string; success: boolean }[];
}

const TRIGGER_LABELS: Record<TriggerType, string> = {
  on_transaction:     "عند إضافة معاملة",
  on_salary:          "عند استلام الراتب",
  on_budget_exceeded: "عند تجاوز الميزانية",
  on_balance_low:     "عند انخفاض الرصيد",
  on_debt_paid:       "عند سداد دين",
  on_goal_reached:    "عند تحقيق هدف",
  schedule:           "جدولة دورية",
};

const ACTION_LABELS: Record<ActionType, { label: string; icon: typeof BellRing }> = {
  notify:             { label: "إرسال إشعار",       icon: BellRing },
  allocate_to_goal:   { label: "تخصيص لهدف",        icon: Target },
  create_transaction: { label: "إنشاء معاملة",       icon: Receipt },
  send_webhook:       { label: "إرسال Webhook",      icon: Webhook },
};

function useRules() {
  return useQuery({
    queryKey: ["automation-rules"],
    queryFn: async () => {
      const token = getAuthToken();
      const res = await fetch("/api/automation/rules", { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      return d.data as AutomationRule[];
    },
  });
}

// ── Create rule form ───────────────────────────────────────────

const TRIGGER_OPTIONS: TriggerType[] = [
  "on_transaction","on_salary","on_budget_exceeded",
  "on_balance_low","on_debt_paid","on_goal_reached","schedule",
];
const ACTION_OPTIONS: ActionType[] = [
  "notify","allocate_to_goal","create_transaction","send_webhook",
];

function CreateRuleSheet({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name,    setName]    = useState("");
  const [desc,    setDesc]    = useState("");
  const [trigger, setTrigger] = useState<TriggerType>("on_transaction");
  const [action,  setAction]  = useState<ActionType>("notify");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  async function submit() {
    if (!name.trim()) return;
    setLoading(true); setError("");
    const token = getAuthToken();

    const trigger_config: Record<string, unknown> = {};
    const action_config: Record<string, unknown> =
      action === "notify" ? { message: message || name } : {};

    const res = await fetch("/api/automation/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, description: desc || undefined, trigger_type: trigger, trigger_config, action_type: action, action_config }),
    });
    const d = await res.json();
    setLoading(false);
    if (!d.ok) { setError(d.error ?? "فشل الإنشاء"); return; }
    onCreated(); onClose();
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
        className="w-full sm:max-w-md card rounded-t-[1.75rem] sm:rounded-[1.5rem] p-6 space-y-4 max-h-[90dvh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <p className="text-base font-black t1">قاعدة أتمتة جديدة</p>
          <button onClick={onClose} className="p-1.5 rounded-lg t3 hover:t1 transition-colors text-lg">✕</button>
        </div>

        <div className="space-y-3">
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="اسم القاعدة" className="input-field w-full text-sm" />
          <textarea value={desc} onChange={e => setDesc(e.target.value)}
            placeholder="وصف (اختياري)" rows={2}
            className="input-field w-full text-sm resize-none" />

          <div className="space-y-1">
            <label className="text-[10px] t3 font-semibold uppercase tracking-wider">الإشارة</label>
            <select value={trigger} onChange={e => setTrigger(e.target.value as TriggerType)}
              className="input-field w-full text-sm">
              {TRIGGER_OPTIONS.map(t => (
                <option key={t} value={t}>{TRIGGER_LABELS[t]}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] t3 font-semibold uppercase tracking-wider">الإجراء</label>
            <select value={action} onChange={e => setAction(e.target.value as ActionType)}
              className="input-field w-full text-sm">
              {ACTION_OPTIONS.map(a => (
                <option key={a} value={a}>{ACTION_LABELS[a].label}</option>
              ))}
            </select>
          </div>

          {action === "notify" && (
            <input value={message} onChange={e => setMessage(e.target.value)}
              placeholder="نص الإشعار (اختياري)" className="input-field w-full text-sm" />
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 rounded-xl border border-[hsl(var(--border))] py-3 text-sm font-semibold t2">
            إلغاء
          </button>
          <button onClick={submit} disabled={!name.trim() || loading}
            className="flex-1 rounded-xl py-3 text-sm font-bold text-white bg-gradient-to-r from-amber-500 to-orange-600 disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            إنشاء
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Rule card ──────────────────────────────────────────────────

function RuleCard({ rule, onToggle, onDelete }: {
  rule: AutomationRule;
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const ActionIcon = ACTION_LABELS[rule.action_type].icon;
  const lastLogs   = rule.logs?.slice(0, 3) ?? [];

  return (
    <div className={`card p-4 space-y-3 transition-opacity ${rule.is_active ? "" : "opacity-60"}`}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-400/10 flex items-center justify-center shrink-0">
          <ActionIcon className="w-4 h-4 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold t1 truncate">{rule.name}</p>
          <p className="text-xs t3 truncate">
            {TRIGGER_LABELS[rule.trigger_type]} → {ACTION_LABELS[rule.action_type].label}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => onToggle(rule.id, !rule.is_active)}
            className="text-cyan-400 hover:text-cyan-300 transition-colors">
            {rule.is_active
              ? <ToggleRight className="w-6 h-6" />
              : <ToggleLeft  className="w-6 h-6 text-slate-500" />}
          </button>
          <button onClick={() => onDelete(rule.id)}
            className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {rule.description && (
        <p className="text-xs t3 line-clamp-2">{rule.description}</p>
      )}

      {lastLogs.length > 0 && (
        <div className="flex items-center gap-1.5">
          <p className="text-[10px] t3">آخر تفعيل:</p>
          {lastLogs.map(log => (
            <span key={log.id} title={new Date(log.triggered_at).toLocaleDateString("ar-SA")}>
              {log.success
                ? <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                : <XCircle     className="w-3 h-3 text-red-400" />}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────

export default function AutomationPage() {
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();
  const { data: rules = [], isLoading } = useRules();

  const toggleRule = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const token = getAuthToken();
      await fetch(`/api/automation/rules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_active: active }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["automation-rules"] }),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const token = getAuthToken();
      await fetch(`/api/automation/rules/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["automation-rules"] }),
  });

  const activeCount = rules.filter(r => r.is_active).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black t1">الأتمتة</h1>
          <p className="text-xs t3 mt-0.5">{activeCount} نشط · {rules.length} إجمالي</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2.5 text-sm font-bold text-white">
          <Plus className="w-4 h-4" /> قاعدة جديدة
        </button>
      </div>

      <div className="card p-4 border border-amber-400/20 bg-amber-400/5">
        <div className="flex items-start gap-3">
          <Zap className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs t2 leading-relaxed">
            قواعد الأتمتة تعمل تلقائياً عند حدوث الإشارة المحددة. الحد الأقصى 20 قاعدة.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>
      ) : rules.length === 0 ? (
        <div className="card p-12 text-center">
          <Zap className="w-10 h-10 t3 mx-auto mb-3" />
          <p className="text-sm font-bold t1 mb-1">لا توجد قواعد</p>
          <p className="text-xs t3">أنشئ قاعدة لأتمتة عملياتك المالية</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map(rule => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onToggle={(id, active) => toggleRule.mutate({ id, active })}
              onDelete={id => deleteRule.mutate(id)}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {showCreate && (
          <CreateRuleSheet
            onClose={() => setShowCreate(false)}
            onCreated={() => queryClient.invalidateQueries({ queryKey: ["automation-rules"] })}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
