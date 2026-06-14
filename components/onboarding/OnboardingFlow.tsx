"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  CheckCircle2, ArrowRight, DollarSign, PiggyBank, Target, Wallet, Loader2
} from "lucide-react";
import { getAuthToken } from "@/lib/auth/token-store";
import { analytics } from "@/lib/analytics/events";

const CURRENCIES = [
  { code: "USD", symbol: "$",  name: "US Dollar" },
  { code: "EUR", symbol: "€",  name: "Euro" },
  { code: "GBP", symbol: "£",  name: "British Pound" },
  { code: "SAR", symbol: "ر.س", name: "Saudi Riyal" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham" },
  { code: "KWD", symbol: "د.ك", name: "Kuwaiti Dinar" },
  { code: "QAR", symbol: "ر.ق", name: "Qatari Riyal" },
  { code: "EGP", symbol: "ج.م", name: "Egyptian Pound" },
];

interface StepProps {
  onNext: (data?: Record<string, string>) => void;
  loading?: boolean;
}

function StepWelcome({ onNext }: StepProps) {
  return (
    <div className="text-center space-y-6">
      <div className="w-20 h-20 rounded-[1.5rem] bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center mx-auto shadow-lg shadow-cyan-500/20">
        <Wallet className="w-10 h-10 text-white" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-black t1">مرحباً بك في Spendix</h1>
        <p className="text-sm t3 leading-relaxed max-w-xs mx-auto">
          تطبيقك الذكي لإدارة أموالك. سنساعدك على إعداد حسابك في دقيقتين فقط.
        </p>
      </div>
      <button
        onClick={() => onNext()}
        className="w-full rounded-xl py-3.5 text-sm font-bold text-white bg-gradient-to-r from-cyan-500 to-blue-600 flex items-center justify-center gap-2"
      >
        ابدأ الآن <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function StepCurrency({ onNext }: StepProps) {
  const [selected, setSelected] = useState("USD");

  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <div className="w-12 h-12 rounded-xl bg-emerald-400/10 flex items-center justify-center mx-auto mb-3">
          <DollarSign className="w-6 h-6 text-emerald-400" />
        </div>
        <h2 className="text-lg font-black t1">اختر عملتك الأساسية</h2>
        <p className="text-xs t3">يمكن تغييرها لاحقاً من الإعدادات</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {CURRENCIES.map(c => (
          <button
            key={c.code}
            onClick={() => setSelected(c.code)}
            className={`flex items-center gap-3 rounded-xl p-3 border text-start transition-all ${
              selected === c.code
                ? "border-cyan-400/50 bg-cyan-400/10"
                : "border-[hsl(var(--border))] hover:bg-[hsl(var(--bg-input))]"
            }`}
          >
            <span className="text-lg font-black" style={{ minWidth: 24, textAlign: "center" }}>{c.symbol}</span>
            <span className="text-xs font-semibold t1">{c.code}</span>
            {selected === c.code && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 ms-auto" />}
          </button>
        ))}
      </div>

      <button
        onClick={() => onNext({ currency: selected })}
        className="w-full rounded-xl py-3 text-sm font-bold text-white bg-gradient-to-r from-cyan-500 to-blue-600 flex items-center justify-center gap-2"
      >
        التالي <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function StepCreateAccount({ onNext, loading }: StepProps) {
  const [name,    setName]    = useState("");
  const [balance, setBalance] = useState("");

  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <div className="w-12 h-12 rounded-xl bg-blue-400/10 flex items-center justify-center mx-auto mb-3">
          <Wallet className="w-6 h-6 text-blue-400" />
        </div>
        <h2 className="text-lg font-black t1">أنشئ حسابك الأول</h2>
        <p className="text-xs t3">أضف حسابك البنكي أو محفظتك</p>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] font-semibold t3 uppercase tracking-wider">اسم الحساب</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="مثال: حساب الراتب"
            className="input-field w-full text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold t3 uppercase tracking-wider">الرصيد الحالي</label>
          <input
            value={balance}
            onChange={e => setBalance(e.target.value)}
            placeholder="0.00"
            type="number"
            min="0"
            className="input-field w-full text-sm"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => onNext()}
          className="flex-1 rounded-xl py-3 text-sm font-semibold t2 border border-[hsl(var(--border))] hover:bg-[hsl(var(--bg-input))] transition-colors"
        >
          تخطي
        </button>
        <button
          onClick={() => onNext({ accountName: name, accountBalance: balance })}
          disabled={!name.trim() || loading}
          className="flex-1 rounded-xl py-3 text-sm font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-600 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          إنشاء <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function StepCreateBudget({ onNext }: StepProps) {
  const [amount, setAmount] = useState("");

  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <div className="w-12 h-12 rounded-xl bg-amber-400/10 flex items-center justify-center mx-auto mb-3">
          <PiggyBank className="w-6 h-6 text-amber-400" />
        </div>
        <h2 className="text-lg font-black t1">حدّد ميزانيتك الشهرية</h2>
        <p className="text-xs t3">ستساعدك في تتبع إنفاقك</p>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-semibold t3 uppercase tracking-wider">الميزانية الشهرية</label>
        <input
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="مثال: 3000"
          type="number"
          min="0"
          className="input-field w-full text-sm"
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => onNext()}
          className="flex-1 rounded-xl py-3 text-sm font-semibold t2 border border-[hsl(var(--border))] hover:bg-[hsl(var(--bg-input))] transition-colors"
        >
          تخطي
        </button>
        <button
          onClick={() => onNext({ budgetAmount: amount })}
          className="flex-1 rounded-xl py-3 text-sm font-bold text-white bg-gradient-to-r from-amber-500 to-orange-600 flex items-center justify-center gap-2"
        >
          التالي <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function StepCreateGoal({ onNext }: StepProps) {
  const [name,   setName]   = useState("");
  const [target, setTarget] = useState("");

  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <div className="w-12 h-12 rounded-xl bg-purple-400/10 flex items-center justify-center mx-auto mb-3">
          <Target className="w-6 h-6 text-purple-400" />
        </div>
        <h2 className="text-lg font-black t1">ضع هدفاً مالياً</h2>
        <p className="text-xs t3">ادخار لإجازة، سيارة، أو صندوق طوارئ</p>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] font-semibold t3 uppercase tracking-wider">اسم الهدف</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="مثال: صندوق الطوارئ"
            className="input-field w-full text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold t3 uppercase tracking-wider">المبلغ المستهدف</label>
          <input
            value={target}
            onChange={e => setTarget(e.target.value)}
            placeholder="0.00"
            type="number"
            min="0"
            className="input-field w-full text-sm"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => onNext()}
          className="flex-1 rounded-xl py-3 text-sm font-semibold t2 border border-[hsl(var(--border))] hover:bg-[hsl(var(--bg-input))] transition-colors"
        >
          تخطي
        </button>
        <button
          onClick={() => onNext({ goalName: name, goalTarget: target })}
          className="flex-1 rounded-xl py-3 text-sm font-bold text-white bg-gradient-to-r from-purple-500 to-violet-600 flex items-center justify-center gap-2"
        >
          إنهاء <CheckCircle2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Main Onboarding Flow ───────────────────────────────────────

const STEPS = ["welcome", "currency", "account", "budget", "goal"] as const;
type Step = typeof STEPS[number];

const STEP_LABELS: Record<Step, string> = {
  welcome:  "مرحباً",
  currency: "العملة",
  account:  "الحساب",
  budget:   "الميزانية",
  goal:     "الهدف",
};

export function OnboardingFlow() {
  const router = useRouter();
  const [step,    setStep]    = useState<Step>("welcome");
  const [loading, setLoading] = useState(false);
  const [collectedData, setCollectedData] = useState<Record<string, string>>({});

  const stepIndex = STEPS.indexOf(step);

  async function markStepComplete(stepName: Step, data?: Record<string, string>) {
    const token = getAuthToken();
    if (!token) return;

    const merged = { ...collectedData, ...data };
    setCollectedData(merged);

    analytics.onboardingStep(stepName);

    await fetch("/api/onboarding/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ step: stepName, data: merged }),
    }).catch(() => {});
  }

  async function handleNext(data?: Record<string, string>) {
    setLoading(true);
    await markStepComplete(step, data);
    setLoading(false);

    if (step === "goal") {
      // Final step — complete onboarding
      analytics.onboardingComplete();
      const token = getAuthToken();
      if (token) {
        await fetch("/api/onboarding/complete", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
      router.push("/dashboard");
      return;
    }

    const nextIndex = stepIndex + 1;
    if (nextIndex < STEPS.length) setStep(STEPS[nextIndex]);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[hsl(var(--bg))]">
      <div className="w-full max-w-sm space-y-6">
        {/* Progress dots */}
        {step !== "welcome" && (
          <div className="flex items-center justify-center gap-2">
            {STEPS.slice(1).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full transition-all ${
                  STEPS.indexOf(step) > i + 1
                    ? "bg-emerald-400"
                    : STEPS.indexOf(step) === i + 1
                    ? "w-6 bg-cyan-400"
                    : "bg-[hsl(var(--border))]"
                }`} />
              </div>
            ))}
          </div>
        )}

        {/* Step label */}
        {step !== "welcome" && (
          <p className="text-center text-[10px] font-bold t3 uppercase tracking-wider">
            {stepIndex} / {STEPS.length - 1} — {STEP_LABELS[step]}
          </p>
        )}

        {/* Step content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ x: 30, opacity: 0 }}
            animate={{ x: 0,  opacity: 1 }}
            exit={{    x: -30, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="card p-6"
          >
            {step === "welcome"  && <StepWelcome  onNext={handleNext} loading={loading} />}
            {step === "currency" && <StepCurrency onNext={handleNext} loading={loading} />}
            {step === "account"  && <StepCreateAccount onNext={handleNext} loading={loading} />}
            {step === "budget"   && <StepCreateBudget  onNext={handleNext} loading={loading} />}
            {step === "goal"     && <StepCreateGoal    onNext={handleNext} loading={loading} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
