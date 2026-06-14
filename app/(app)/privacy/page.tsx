"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Lock, Database, Eye, Trash2, Download, Server, User,
  ToggleLeft, ToggleRight, Loader2, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { getAuthToken } from "@/lib/auth/token-store";

interface ConsentSettings {
  analytics_consent: boolean;
  marketing_consent: boolean;
  crash_reporting:   boolean;
  data_sharing:      boolean;
}

// ── Consent toggle ─────────────────────────────────────────────

function ConsentRow({
  label, description, value, onChange, loading,
}: {
  label: string; description: string; value: boolean;
  onChange: (v: boolean) => void; loading?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-1">
        <p className="text-sm font-semibold t1">{label}</p>
        <p className="text-xs t3 leading-relaxed mt-0.5">{description}</p>
      </div>
      <button onClick={() => onChange(!value)} disabled={loading}
        className={`shrink-0 transition-colors ${loading ? "opacity-50" : ""}`}>
        {value
          ? <ToggleRight className="w-6 h-6 text-cyan-400" />
          : <ToggleLeft  className="w-6 h-6 t3" />}
      </button>
    </div>
  );
}

// ── GDPR delete confirmation dialog ───────────────────────────

function DeleteAccountDialog({ onClose }: { onClose: () => void }) {
  const [step,    setStep]    = useState<"warn" | "confirm" | "done" | "error">("warn");
  const [loading, setLoading] = useState(false);

  async function executeDelete() {
    setLoading(true);
    const token = getAuthToken();
    const res = await fetch("/api/gdpr/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ confirmation: "DELETE MY ACCOUNT" }),
    });
    const d = await res.json();
    setLoading(false);
    if (d.ok) { setStep("done"); setTimeout(() => { window.location.href = "/login"; }, 3000); }
    else setStep("error");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(11,15,20,0.85)", backdropFilter: "blur(8px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm card rounded-2xl p-6 space-y-4"
      >
        {step === "warn" && (
          <>
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-red-400/10 flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <p className="text-base font-black t1 mb-2">حذف الحساب نهائياً</p>
              <p className="text-xs t3 leading-relaxed">
                سيتم حذف جميع بياناتك المالية بشكل دائم ولا يمكن استعادتها.
                تشمل: المعاملات، الأهداف، الميزانيات، الديون، وجميع السجلات.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={onClose}
                className="flex-1 rounded-xl border border-[hsl(var(--border))] py-3 text-sm font-semibold t2">
                إلغاء
              </button>
              <button onClick={() => setStep("confirm")}
                className="flex-1 rounded-xl py-3 text-sm font-bold text-white bg-red-500">
                استمر
              </button>
            </div>
          </>
        )}

        {step === "confirm" && (
          <>
            <div className="text-center">
              <p className="text-sm font-bold t1 mb-2">تأكيد نهائي</p>
              <p className="text-xs t3">هذا الإجراء لا يمكن التراجع عنه</p>
            </div>
            <div className="flex gap-3">
              <button onClick={onClose}
                className="flex-1 rounded-xl border border-[hsl(var(--border))] py-3 text-sm font-semibold t2">
                إلغاء
              </button>
              <button onClick={executeDelete} disabled={loading}
                className="flex-1 rounded-xl py-3 text-sm font-bold text-white bg-red-500 flex items-center justify-center gap-2">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                حذف بياناتي
              </button>
            </div>
          </>
        )}

        {step === "done" && (
          <div className="text-center py-4">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <p className="text-sm font-bold t1">تم حذف حسابك</p>
            <p className="text-xs t3 mt-1">جارٍ التحويل...</p>
          </div>
        )}

        {step === "error" && (
          <div className="text-center py-4">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-sm font-bold t1 mb-2">حدث خطأ</p>
            <button onClick={onClose} className="text-xs t3 underline">إغلاق</button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────

export default function PrivacyPage() {
  const { t } = useTranslation();
  const [consent,      setConsent]      = useState<ConsentSettings | null>(null);
  const [consentLoad,  setConsentLoad]  = useState(false);
  const [savingKey,    setSavingKey]    = useState<string | null>(null);
  const [exportLoading, setExportLoad] = useState(false);
  const [showDelete,   setShowDelete]   = useState(false);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;
    fetch("/api/gdpr/consent", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.ok) setConsent(d.data); })
      .catch(() => {});
  }, []);

  async function updateConsent(key: keyof ConsentSettings, value: boolean) {
    if (!consent) return;
    setSavingKey(key);
    const updated = { ...consent, [key]: value };
    setConsent(updated);
    const token = getAuthToken();
    await fetch("/api/gdpr/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ [key]: value }),
    }).catch(() => {});
    setSavingKey(null);
  }

  async function downloadExport() {
    setExportLoad(true);
    const token = getAuthToken();
    const res = await fetch("/api/gdpr/export", { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `spendix-export-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportLoad(false);
  }

  const dataItems = [
    { icon: User,     title: t("privacy.item_account"),   desc: t("privacy.item_account_desc"),   color: "text-cyan-400",    bg: "bg-cyan-400/10" },
    { icon: Database, title: t("privacy.item_financial"),  desc: t("privacy.item_financial_desc"),  color: "text-emerald-400", bg: "bg-emerald-400/10" },
    { icon: Server,   title: t("privacy.item_storage"),   desc: t("privacy.item_storage_desc"),   color: "text-purple-400",  bg: "bg-purple-400/10" },
    { icon: Eye,      title: t("privacy.item_ai"),        desc: t("privacy.item_ai_desc"),        color: "text-amber-400",   bg: "bg-amber-400/10" },
  ];

  const protections = [
    t("privacy.protection_rls"),
    t("privacy.protection_https"),
    t("privacy.protection_auth"),
    t("privacy.protection_no_third_party"),
    t("privacy.protection_no_ads"),
    "تشفير البيانات أثناء النقل (TLS 1.3)",
    "جميع البيانات مخزنة في الاتحاد الأوروبي (Supabase EU)",
    "فحص أمني أسبوعي للنظام",
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10">
          <Shield className="h-4 w-4 text-emerald-400" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-black t1">{t("privacy.title")}</h1>
          <p className="mt-0.5 text-xs font-medium t3">{t("privacy.subtitle")}</p>
        </div>
      </div>

      {/* What we store */}
      <section className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide t3 px-1">{t("privacy.section_stored")}</p>
        <div className="space-y-2">
          {dataItems.map(item => (
            <div key={item.title} className="card p-4 flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${item.bg}`}>
                <item.icon className={`w-4 h-4 ${item.color}`} />
              </div>
              <div>
                <p className="text-sm font-semibold t1">{item.title}</p>
                <p className="text-xs t3 mt-0.5 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Protections */}
      <section className="card p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Lock className="w-4 h-4 text-emerald-400" />
          <p className="text-sm font-bold t1">{t("privacy.section_protections")}</p>
        </div>
        {protections.map((p, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <div className="w-4 h-4 rounded-full bg-emerald-400/15 flex items-center justify-center shrink-0 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </div>
            <p className="text-xs t2 leading-relaxed">{p}</p>
          </div>
        ))}
      </section>

      {/* Consent settings */}
      {consent && (
        <section className="card p-4 space-y-4">
          <p className="text-sm font-bold t1">إعدادات الموافقة (GDPR)</p>
          <ConsentRow
            label="تحليلات الاستخدام"
            description="تساعدنا على تحسين التطبيق بفهم كيفية استخدامه"
            value={consent.analytics_consent}
            onChange={v => updateConsent("analytics_consent", v)}
            loading={savingKey === "analytics_consent"}
          />
          <ConsentRow
            label="تقارير الأعطال"
            description="إرسال تقارير الأخطاء تلقائياً لمساعدتنا في إصلاح المشاكل"
            value={consent.crash_reporting}
            onChange={v => updateConsent("crash_reporting", v)}
            loading={savingKey === "crash_reporting"}
          />
          <ConsentRow
            label="الاتصالات التسويقية"
            description="تلقي نصائح وعروض ومحتوى مفيد عبر البريد الإلكتروني"
            value={consent.marketing_consent}
            onChange={v => updateConsent("marketing_consent", v)}
            loading={savingKey === "marketing_consent"}
          />
          <ConsentRow
            label="مشاركة البيانات مع شركاء"
            description="مشاركة بيانات مجهولة الهوية لتحسين نماذج الذكاء الاصطناعي"
            value={consent.data_sharing}
            onChange={v => updateConsent("data_sharing", v)}
            loading={savingKey === "data_sharing"}
          />
        </section>
      )}

      {/* Your rights */}
      <section className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide t3 px-1">{t("privacy.section_rights")}</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={downloadExport}
            disabled={exportLoading}
            className="card p-4 flex flex-col items-center gap-2 text-center hover:border-cyan-400/30 transition-colors disabled:opacity-50"
          >
            {exportLoading
              ? <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
              : <Download className="w-5 h-5 text-cyan-400" />}
            <p className="text-xs font-semibold t1">{t("privacy.right_export")}</p>
            <p className="text-[10px] t3">{t("privacy.right_export_desc")}</p>
          </button>
          <button
            onClick={() => setShowDelete(true)}
            className="card p-4 flex flex-col items-center gap-2 text-center hover:border-red-400/30 transition-colors"
          >
            <Trash2 className="w-5 h-5 text-red-400" />
            <p className="text-xs font-semibold t1">{t("privacy.right_delete")}</p>
            <p className="text-[10px] t3">{t("privacy.right_delete_desc")}</p>
          </button>
        </div>
      </section>

      {/* Data retention */}
      <section className="card p-4">
        <p className="text-sm font-bold t1 mb-2">{t("privacy.retention_title")}</p>
        <p className="text-xs t3 leading-relaxed">{t("privacy.retention_body")}</p>
      </section>

      <AnimatePresence>
        {showDelete && <DeleteAccountDialog onClose={() => setShowDelete(false)} />}
      </AnimatePresence>
    </div>
  );
}
