"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Crown, Loader2, Shield, Sparkles, Zap, ExternalLink } from "lucide-react";
import { PLANS, type PlanId } from "@/lib/plans";
import { usePlan } from "@/contexts/PlanContext";
import { getAuthToken } from "@/lib/auth/token-store";

const PLAN_ICONS: Record<PlanId, React.ElementType> = {
  free:  Sparkles,
  plus:  Zap,
  pro:   Crown,
  elite: Shield,
};

const FEATURES_AR: { key: string; label: string; plans: PlanId[] }[] = [
  { key: "accounts",     label: "حسابات مالية غير محدودة",     plans: ["plus","pro","elite"] },
  { key: "transactions", label: "معاملات غير محدودة",           plans: ["plus","pro","elite"] },
  { key: "goals",        label: "أهداف مالية غير محدودة",       plans: ["plus","pro","elite"] },
  { key: "budgets",      label: "ميزانيات غير محدودة",           plans: ["plus","pro","elite"] },
  { key: "export",       label: "تصدير PDF و Excel",             plans: ["plus","pro","elite"] },
  { key: "tags",         label: "تصنيفات (Tags) متقدمة",         plans: ["plus","pro","elite"] },
  { key: "recurring",    label: "معاملات متكررة",                plans: ["plus","pro","elite"] },
  { key: "debts",        label: "تتبع الديون والمستحقات",        plans: ["plus","pro","elite"] },
  { key: "contacts",     label: "دليل العملاء والجهات",           plans: ["plus","pro","elite"] },
  { key: "investments",  label: "تتبع المحافظ الاستثمارية",       plans: ["pro","elite"] },
  { key: "analytics",    label: "تحليلات متقدمة + توقع التدفق",  plans: ["pro","elite"] },
  { key: "ai",           label: "مساعد مالي بالذكاء الاصطناعي", plans: ["pro","elite"] },
  { key: "networth",     label: "تقرير صافي الأصول",              plans: ["pro","elite"] },
  { key: "household",    label: "حسابات عائلية مشتركة",           plans: ["elite"] },
  { key: "work",         label: "تتبع ساعات العمل والدخل",        plans: ["elite"] },
  { key: "beta",         label: "ميزات Beta قبل الجميع",          plans: ["elite"] },
];

export default function PlansPage() {
  const { plan: currentPlan, hasStripe, isLoading: planLoading, refetch, syncFromStripe } = usePlan();
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const params = useSearchParams();

  useEffect(() => {
    if (params.get("success") === "1") {
      setSyncing(true);
      syncFromStripe().finally(() => setSyncing(false));
    }
  }, [params, syncFromStripe]);

  async function handleSubscribe(planId: PlanId) {
    if (planId === "free" || planId === currentPlan) return;
    setLoadingPlan(planId);
    try {
      const token = getAuthToken();
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error ?? "حدث خطأ، حاول مرة أخرى");
      }
    } catch {
      alert("فشل الاتصال بالخادم، تحقق من اتصالك");
    } finally {
      setLoadingPlan(null);
    }
  }

  async function handlePortal() {
    setPortalLoading(true);
    try {
      const token = getAuthToken();
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-2 py-4">
        <h1 className="text-2xl font-black t1">خطط Spendix</h1>
        <p className="text-sm t3">اختر الخطة المناسبة لاحتياجاتك المالية</p>
        {params.get("success") === "1" && (
          <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-400/10 border border-emerald-400/20 px-4 py-2 text-sm font-semibold text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            {syncing ? "جاري تحديث الاشتراك..." : "تم الاشتراك بنجاح!"}
          </div>
        )}
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {PLANS.map((plan) => {
          const Icon = PLAN_ICONS[plan.id];
          const isCurrent = currentPlan === plan.id;
          const isLoading = loadingPlan === plan.id;

          return (
            <div
              key={plan.id}
              className={`relative rounded-[1.5rem] border p-5 flex flex-col transition-all ${
                plan.recommended
                  ? "border-blue-500/50 bg-gradient-to-b from-blue-500/5 to-transparent"
                  : "border-[hsl(var(--border))] bg-[hsl(var(--bg-card))]"
              } ${isCurrent ? "ring-2 ring-cyan-400/50" : ""}`}
            >
              {plan.recommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-500 px-3 py-0.5 text-[10px] font-bold text-white">
                  الأكثر شيوعاً
                </div>
              )}

              <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${plan.colorClass}`}>
                <Icon className="h-5 w-5 text-white" />
              </div>

              <p className="text-xs font-bold uppercase tracking-wider t3 mb-1">
                {plan.id === "free" ? "مجاني" : plan.id === "plus" ? "Plus" : plan.id === "pro" ? "Pro" : "Elite"}
              </p>
              <p className="text-3xl font-black t1 mb-1">
                {plan.price === 0 ? "مجاناً" : `$${plan.price}`}
              </p>
              {plan.price > 0 && <p className="text-xs t3 mb-4">/ شهرياً</p>}
              {plan.price === 0 && <p className="text-xs t3 mb-4">للأبد</p>}

              {/* Limits summary */}
              <div className="space-y-1 mb-5 flex-1">
                {plan.id === "free" && (
                  <>
                    <p className="text-xs t3">• حساب مالي واحد</p>
                    <p className="text-xs t3">• 30 معاملة/شهر</p>
                    <p className="text-xs t3">• هدفان ماليان</p>
                    <p className="text-xs t3">• ميزانية واحدة</p>
                  </>
                )}
                {plan.id === "plus" && (
                  <>
                    <p className="text-xs t3">• حسابات ومعاملات غير محدودة</p>
                    <p className="text-xs t3">• تصدير PDF وExcel</p>
                    <p className="text-xs t3">• تتبع الديون والاشتراكات</p>
                    <p className="text-xs text-slate-400">✗ ذكاء اصطناعي</p>
                    <p className="text-xs text-slate-400">✗ استثمارات</p>
                  </>
                )}
                {plan.id === "pro" && (
                  <>
                    <p className="text-xs t3">• كل مميزات Plus</p>
                    <p className="text-xs t3">• مساعد ذكاء اصطناعي</p>
                    <p className="text-xs t3">• تحليلات متقدمة</p>
                    <p className="text-xs t3">• تتبع الاستثمارات</p>
                    <p className="text-xs text-slate-400">✗ حسابات عائلية</p>
                  </>
                )}
                {plan.id === "elite" && (
                  <>
                    <p className="text-xs t3">• كل مميزات Pro</p>
                    <p className="text-xs t3">• حسابات عائلية مشتركة</p>
                    <p className="text-xs t3">• تتبع ساعات العمل</p>
                    <p className="text-xs t3">• وصول Beta مبكر</p>
                    <p className="text-xs t3">• دعم VIP</p>
                  </>
                )}
              </div>

              {isCurrent ? (
                <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 py-2 text-center text-xs font-bold text-cyan-400">
                  خطتك الحالية ✓
                </div>
              ) : plan.id === "free" ? (
                <div className="rounded-xl border border-[hsl(var(--border))] py-2 text-center text-xs font-semibold t3">
                  مجاني دائماً
                </div>
              ) : (
                <button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={isLoading || planLoading !== null}
                  className={`w-full rounded-xl py-2.5 text-sm font-bold text-white bg-gradient-to-r ${plan.colorClass} disabled:opacity-60 flex items-center justify-center gap-2`}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  اشترك الآن
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Feature comparison table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-[hsl(var(--border))]">
          <h2 className="text-sm font-bold t1">مقارنة المميزات</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[hsl(var(--border-2))]">
                <th className="px-4 py-2.5 text-start t3 font-semibold w-1/2">الميزة</th>
                {PLANS.map((p) => (
                  <th key={p.id} className={`px-2 py-2.5 text-center font-bold ${currentPlan === p.id ? "text-cyan-400" : "t2"}`}>
                    {p.id === "free" ? "مجاني" : p.id.charAt(0).toUpperCase() + p.id.slice(1)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURES_AR.map((f, i) => (
                <tr key={f.key} className={`border-b border-[hsl(var(--border-2))] last:border-0 ${i % 2 === 0 ? "" : "bg-[hsl(var(--bg-input))]/30"}`}>
                  <td className="px-4 py-2.5 t2 font-medium">{f.label}</td>
                  {PLANS.map((p) => (
                    <td key={p.id} className="px-2 py-2.5 text-center">
                      {f.plans.includes(p.id)
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mx-auto" />
                        : <span className="text-[hsl(var(--text-3))]">—</span>
                      }
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manage billing */}
      {hasStripe && (
        <div className="card p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold t1">إدارة الاشتراك</p>
            <p className="text-xs t3 mt-0.5">تعديل طريقة الدفع أو إلغاء الاشتراك</p>
          </div>
          <button
            onClick={handlePortal}
            disabled={portalLoading}
            className="flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] px-4 py-2 text-sm font-semibold t2 hover:bg-[hsl(var(--bg-input))] transition-colors disabled:opacity-60"
          >
            {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
            إدارة الفاتورة
          </button>
        </div>
      )}
    </div>
  );
}
