"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Crown, Loader2, Shield, Sparkles, Zap, ExternalLink, Gift } from "lucide-react";
import { PLANS, type PlanId } from "@/lib/plans";
import { usePlan } from "@/contexts/PlanContext";
import { getAuthToken } from "@/lib/auth/token-store";
import { useToast } from "@/hooks/useToast";
import ToastList from "@/components/ui/Toast";
import { ReferralCard } from "@/components/referral/ReferralCard";
import { SupportModal } from "@/components/support/SupportModal";
import { analytics } from "@/lib/analytics/events";
import type { BillingInterval } from "@/lib/stripe-prices";

const PLAN_ICONS: Record<PlanId, React.ElementType> = {
  free:  Sparkles,
  plus:  Zap,
  pro:   Crown,
  elite: Shield,
};

const PLAN_LABELS: Record<PlanId, string> = {
  free:  "مجاني",
  plus:  "Plus",
  pro:   "Pro",
  elite: "Elite",
};

const FEATURES: { key: string; label: string; plans: PlanId[] }[] = [
  { key: "accounts",     label: "حسابات مالية غير محدودة",      plans: ["plus","pro","elite"] },
  { key: "transactions", label: "معاملات غير محدودة",            plans: ["plus","pro","elite"] },
  { key: "goals",        label: "أهداف مالية غير محدودة",        plans: ["plus","pro","elite"] },
  { key: "budgets",      label: "ميزانيات غير محدودة",           plans: ["plus","pro","elite"] },
  { key: "export",       label: "تصدير PDF و Excel",             plans: ["plus","pro","elite"] },
  { key: "tags",         label: "تصنيفات (Tags) متقدمة",         plans: ["plus","pro","elite"] },
  { key: "recurring",    label: "معاملات متكررة",                plans: ["plus","pro","elite"] },
  { key: "debts",        label: "تتبع الديون والمستحقات",        plans: ["plus","pro","elite"] },
  { key: "contacts",     label: "دليل العملاء والجهات",          plans: ["plus","pro","elite"] },
  { key: "investments",  label: "تتبع المحافظ الاستثمارية",      plans: ["pro","elite"] },
  { key: "analytics",    label: "تحليلات متقدمة + توقع التدفق",  plans: ["pro","elite"] },
  { key: "ai",           label: "مساعد مالي بالذكاء الاصطناعي", plans: ["pro","elite"] },
  { key: "networth",     label: "تقرير صافي الأصول",             plans: ["pro","elite"] },
  { key: "household",    label: "حسابات عائلية مشتركة",          plans: ["elite"] },
  { key: "work",         label: "تتبع ساعات العمل والدخل",       plans: ["elite"] },
  { key: "beta",         label: "ميزات Beta قبل الجميع",         plans: ["elite"] },
];

const PLAN_BULLETS: Record<PlanId, { text: string; included: boolean }[]> = {
  free: [
    { text: "حساب مالي واحد", included: true },
    { text: "30 معاملة/شهر", included: true },
    { text: "هدفان ماليان", included: true },
    { text: "ميزانية واحدة", included: true },
    { text: "ذكاء اصطناعي", included: false },
    { text: "مزامنة سحابية", included: false },
  ],
  plus: [
    { text: "حسابات ومعاملات غير محدودة", included: true },
    { text: "تصدير PDF وExcel", included: true },
    { text: "تتبع الديون والاشتراكات", included: true },
    { text: "مزامنة سحابية كاملة", included: true },
    { text: "ذكاء اصطناعي", included: false },
    { text: "استثمارات", included: false },
  ],
  pro: [
    { text: "كل مميزات Plus", included: true },
    { text: "مساعد ذكاء اصطناعي", included: true },
    { text: "تحليلات متقدمة", included: true },
    { text: "تتبع الاستثمارات", included: true },
    { text: "تقارير مالية", included: true },
    { text: "حسابات عائلية", included: false },
  ],
  elite: [
    { text: "كل مميزات Pro", included: true },
    { text: "حسابات عائلية مشتركة", included: true },
    { text: "تتبع ساعات العمل", included: true },
    { text: "وصول Beta مبكر", included: true },
    { text: "دعم VIP", included: true },
    { text: "رؤى AI متميزة", included: true },
  ],
};

function PlansPageInner() {
  const { plan: currentPlan, hasStripe, isLoading: planLoading, syncFromStripe } = usePlan();
  const [loadingPlan,   setLoadingPlan]   = useState<PlanId | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [syncing,       setSyncing]       = useState(false);
  const [interval,      setInterval]      = useState<BillingInterval>("monthly");
  const [showSupport,   setShowSupport]   = useState(false);
  const params = useSearchParams();
  const { toasts, addToast, dismiss } = useToast();

  useEffect(() => {
    if (params.get("success") === "1") {
      setSyncing(true);
      syncFromStripe().finally(() => setSyncing(false));
    }
  }, [params, syncFromStripe]);

  async function handleSubscribe(planId: PlanId) {
    if (planId === "free" || planId === currentPlan) return;
    analytics.upgradeClicked(planId, currentPlan);
    setLoadingPlan(planId);
    try {
      const token = getAuthToken();
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: planId, interval }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        addToast(data.error ?? "حدث خطأ، حاول مرة أخرى", "error");
      }
    } catch {
      addToast("فشل الاتصال بالخادم، تحقق من اتصالك", "error");
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
    <>
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="text-center space-y-3 py-4">
        <h1 className="text-2xl font-black t1">خطط Spendix</h1>
        <p className="text-sm t3">اختر الخطة المناسبة لاحتياجاتك المالية</p>

        {params.get("success") === "1" && (
          <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-400/10 border border-emerald-400/20 px-4 py-2 text-sm font-semibold text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            {syncing ? "جاري تحديث الاشتراك..." : "تم الاشتراك بنجاح!"}
          </div>
        )}

        {/* Billing interval toggle */}
        <div className="inline-flex items-center gap-1 rounded-xl bg-[hsl(var(--bg-input))] border border-[hsl(var(--border))] p-1">
          <button
            onClick={() => setInterval("monthly")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              interval === "monthly" ? "bg-[hsl(var(--bg-card))] t1 shadow-sm" : "t3"
            }`}
          >
            شهري
          </button>
          <button
            onClick={() => setInterval("yearly")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              interval === "yearly" ? "bg-[hsl(var(--bg-card))] t1 shadow-sm" : "t3"
            }`}
          >
            سنوي
            <span className="rounded-full bg-emerald-400/20 px-1.5 py-0.5 text-[9px] font-black text-emerald-400">
              وفّر 20%
            </span>
          </button>
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {PLANS.map((plan) => {
          const Icon      = PLAN_ICONS[plan.id];
          const isCurrent = currentPlan === plan.id;
          const isLoading = loadingPlan === plan.id;
          const bullets   = PLAN_BULLETS[plan.id];

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

              <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${plan.colorClass}`}>
                <Icon className="h-5 w-5 text-white" />
              </div>

              <p className="text-xs font-bold uppercase tracking-wider t3 mb-1">
                {PLAN_LABELS[plan.id]}
              </p>

              {/* Price */}
              {plan.price === 0 ? (
                <>
                  <p className="text-3xl font-black t1 mb-1">مجاناً</p>
                  <p className="text-xs t3 mb-4">للأبد</p>
                </>
              ) : interval === "yearly" ? (
                <>
                  <p className="text-3xl font-black t1 mb-1">
                    ${(plan.price * 12 * 0.8).toFixed(2)}
                  </p>
                  <div className="flex items-center gap-1.5 mb-4">
                    <p className="text-xs t3">/ سنوياً</p>
                    <span className="text-[9px] line-through t3">${(plan.price * 12).toFixed(2)}</span>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-3xl font-black t1 mb-1">${plan.price}</p>
                  <p className="text-xs t3 mb-4">/ شهرياً</p>
                </>
              )}

              {/* Feature bullets */}
              <div className="space-y-1.5 mb-5 flex-1">
                {bullets.map((b, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {b.included
                      ? <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                      : <span className="w-3 h-3 flex items-center justify-center text-[hsl(var(--text-3))] shrink-0 text-xs">✗</span>
                    }
                    <span className={`text-xs ${b.included ? "t2" : "t3"}`}>{b.text}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
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
          <h2 className="text-sm font-bold t1">مقارنة الميزات</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[hsl(var(--border-2))]">
                <th className="px-4 py-2.5 text-start t3 font-semibold w-1/2">الميزة</th>
                {PLANS.map((p) => (
                  <th key={p.id} className={`px-2 py-2.5 text-center font-bold ${currentPlan === p.id ? "text-cyan-400" : "t2"}`}>
                    {PLAN_LABELS[p.id]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((f, i) => (
                <tr key={f.key} className={`border-b border-[hsl(var(--border-2))] last:border-0 ${i % 2 === 0 ? "" : "bg-[hsl(var(--bg-input))]/30"}`}>
                  <td className="px-4 py-2.5 t2 font-medium">{f.label}</td>
                  {PLANS.map((p) => (
                    <td key={p.id} className="px-2 py-2.5 text-center">
                      {f.plans.includes(p.id)
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mx-auto" />
                        : <span className="t3">—</span>
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

      {/* Referral Program */}
      <ReferralCard />

      {/* Support */}
      <div className="card p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-400/10 flex items-center justify-center shrink-0">
            <Gift className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <p className="text-sm font-bold t1">مشكلة أو اقتراح؟</p>
            <p className="text-xs t3 mt-0.5">تواصل مع فريق Spendix مباشرة</p>
          </div>
        </div>
        <button
          onClick={() => setShowSupport(true)}
          className="rounded-xl border border-[hsl(var(--border))] px-4 py-2 text-xs font-semibold t2 hover:bg-[hsl(var(--bg-input))] transition-colors shrink-0"
        >
          تواصل معنا
        </button>
      </div>

      {showSupport && <SupportModal onClose={() => setShowSupport(false)} />}
    </div>
    <ToastList toasts={toasts} dismiss={dismiss} />
    </>
  );
}

export default function PlansPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>}>
      <PlansPageInner />
    </Suspense>
  );
}
