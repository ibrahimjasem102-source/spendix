"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Bell,
  Check,
  ChevronRight,
  Download,
  Globe,
  KeyRound,
  Loader2,
  LockKeyhole,
  LogIn,
  LogOut,
  Moon,
  Palette,
  Shield,
  Sparkles,
  Sun,
  Trash2,
  User,
  WalletCards,
} from "lucide-react";
import { useGuest } from "@/contexts/GuestContext";
import { ROOM_DEFINITIONS, useRoomLocks } from "@/contexts/RoomLockContext";
import { useCurrency, CURRENCIES, type Currency } from "@/lib/currency";
import { useTranslation, LOCALES, type Locale } from "@/lib/i18n";
import { fadeIn, spring, tapTransition } from "@/lib/motion";
import { createClient } from "@/lib/supabase/client";
import { migrateGuestData } from "@/lib/guest/migrate";
import { useTheme } from "@/lib/theme";
import { safeFetch } from "@/lib/fetch-safe";

function Toggle({ checked, onChange, disabled = false }: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      whileTap={{ scale: disabled ? 1 : 0.94 }}
      transition={tapTransition}
      disabled={disabled}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
        checked ? "bg-cyan-400" : "border border-[hsl(var(--border))] bg-[hsl(var(--bg-input))]"
      }`}
      aria-pressed={checked}
    >
      <span className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
        checked
          ? "translate-x-[22px] rtl:translate-x-[4px]"
          : "translate-x-1 rtl:translate-x-[22px]"
      }`} />
    </motion.button>
  );
}

function SectionShell({
  title,
  description,
  icon: Icon,
  children,
  tone = "cyan",
}: {
  title: string;
  description?: string;
  icon: React.ElementType;
  children: React.ReactNode;
  tone?: "cyan" | "emerald" | "violet" | "amber" | "rose" | "slate";
}) {
  const tones = {
    cyan: "bg-cyan-400/10 text-cyan-300",
    emerald: "bg-emerald-400/10 text-emerald-300",
    violet: "bg-violet-400/10 text-violet-300",
    amber: "bg-amber-400/10 text-amber-300",
    rose: "bg-rose-400/10 text-rose-300",
    slate: "bg-slate-400/10 text-slate-300",
  };

  return (
    <motion.section
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      transition={spring}
      className="space-y-2"
    >
      <div className="flex items-center gap-2 px-1.5">
        <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] t3">{title}</p>
          {description && <p className="mt-0.5 line-clamp-1 text-[11px] leading-tight t3">{description}</p>}
        </div>
      </div>
      <div className="card overflow-hidden p-2.5">{children}</div>
    </motion.section>
  );
}

function SettingLine({ label, hint, children }: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[48px] items-center justify-between gap-3 border-b border-[hsl(var(--border-2))] px-1.5 py-2 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold t1">{label}</p>
        {hint && <p className="mt-0.5 line-clamp-1 text-[11px] leading-tight t3">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone: "cyan" | "emerald" | "violet" | "amber";
}) {
  const tones = {
    cyan: "bg-cyan-400/10 text-cyan-300",
    emerald: "bg-emerald-400/10 text-emerald-300",
    violet: "bg-violet-400/10 text-violet-300",
    amber: "bg-amber-400/10 text-amber-300",
  };

  return (
    <div className="min-w-0 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--bg-card))] p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
        <p className="min-w-0 truncate text-[10px] font-bold uppercase tracking-[0.13em] t3">{label}</p>
      </div>
      <p className="truncate text-sm font-black t1">{value}</p>
    </div>
  );
}

function ChoiceButton({
  selected,
  onClick,
  title,
  subtitle,
  prefix,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
  prefix?: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      transition={tapTransition}
      className={`flex min-h-[48px] items-center gap-2.5 rounded-xl border px-3 py-2 text-start transition-all ${
        selected
          ? "border-cyan-400/40 bg-cyan-400/10"
          : "border-[hsl(var(--border-2))] bg-[hsl(var(--bg-card-2))] hover:border-[hsl(var(--border))]"
      }`}
    >
      {prefix && <div className="shrink-0">{prefix}</div>}
      <div className="min-w-0 flex-1">
        <p className={`truncate text-[13px] font-bold ${selected ? "text-cyan-300" : "t1"}`}>{title}</p>
        {subtitle && <p className="truncate text-[11px] t3">{subtitle}</p>}
      </div>
      {selected && <Check className="h-4 w-4 shrink-0 text-cyan-300" />}
    </motion.button>
  );
}

function PanelButton({
  selected,
  onClick,
  icon: Icon,
  title,
  value,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ElementType;
  title: string;
  value?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-12 shrink-0 items-center gap-2 rounded-2xl border px-3 text-start transition-all ${
        selected
          ? "border-cyan-400/35 bg-cyan-400/10 text-cyan-300"
          : "border-[hsl(var(--border))] bg-[hsl(var(--bg-card))] t2"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="min-w-0">
        <span className="block truncate text-xs font-black">{title}</span>
        {value && <span className="block truncate text-[10px] opacity-70">{value}</span>}
      </span>
    </button>
  );
}

type ProfileState = { name: string; email: string };
type NotificationState = {
  budget: boolean;
  weekly: boolean;
  ai_alerts: boolean;
  email: boolean;
  debt_reminders: boolean;
};
type AIState = { enabled: boolean; auto: boolean; model: "claude-haiku" | "claude-sonnet" };
type SettingsPanel = "account" | "preferences" | "automation" | "security";

export default function SettingsPage() {
  const { t, locale, setLocale } = useTranslation();
  const { currency, setCurrency } = useCurrency();
  const { theme, setTheme } = useTheme();
  const { isGuest } = useGuest();
  const { config: roomConfig, hasPin, setPin, clearPin, setRoomLocked, lockAllRooms } = useRoomLocks();

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleteStep, setDeleteStep] = useState<"idle" | "export" | "confirm">("idle");
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [hasGuestData, setHasGuestData] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [profile, setProfile] = useState<ProfileState>({ name: "", email: "" });
  const [notifs, setNotifs] = useState<NotificationState>(() => {
    if (typeof window === "undefined") return { budget: true, weekly: true, ai_alerts: false, email: false, debt_reminders: true };
    try { return JSON.parse(localStorage.getItem("spendix_notifs") ?? "null") ?? { budget: true, weekly: true, ai_alerts: false, email: false, debt_reminders: true }; } catch { return { budget: true, weekly: true, ai_alerts: false, email: false, debt_reminders: true }; }
  });
  const [ai, setAI] = useState<AIState>(() => {
    if (typeof window === "undefined") return { enabled: true, auto: false, model: "claude-haiku" };
    try { return JSON.parse(localStorage.getItem("spendix_ai_settings") ?? "null") ?? { enabled: true, auto: false, model: "claude-haiku" }; } catch { return { enabled: true, auto: false, model: "claude-haiku" }; }
  });
  const [activePanel, setActivePanel] = useState<SettingsPanel>("account");
  const [roomPin,     setRoomPin]     = useState("");
  const [pinSaved,    setPinSaved]    = useState(false);
  const [pinError,    setPinError]    = useState("");
  // Password change
  const [showPwChange,  setShowPwChange]  = useState(false);
  const [newPassword,   setNewPassword]   = useState("");
  const [pwChangeMsg,   setPwChangeMsg]   = useState<{ ok: boolean; text: string } | null>(null);
  const [changingPw,    setChangingPw]    = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const email = user.email ?? "";
      setUserEmail(email);
      setProfile({ name: user.user_metadata?.full_name ?? "", email });

      // Load preferences from Supabase
      const { data: prefs } = await supabase
        .from("profile_settings")
        .select("preferences")
        .eq("user_id", user.id)
        .maybeSingle();

      if (prefs?.preferences) {
        const p = prefs.preferences as Record<string, unknown>;
        if (p.notifs)      setNotifs(p.notifs as NotificationState);
        if (p.ai_settings) setAI(p.ai_settings as AIState);
      }
    });
  }, []);

  useEffect(() => {
    const keys = [
      "spendix_guest_transactions", "spendix_guest_goals", "spendix_guest_budgets",
      "spendix_guest_debts", "spendix_guest_investments", "spendix_guest_work_sessions",
    ];
    const has = keys.some((k) => {
      try { return JSON.parse(localStorage.getItem(k) ?? "[]").length > 0; } catch { return false; }
    });
    setHasGuestData(has);
  }, []);

  const initials = useMemo(() => {
    const source = profile.name.trim() || userEmail || "S";
    return source.slice(0, 2).toUpperCase();
  }, [profile.name, userEmail]);

  const currentLocale = LOCALES.find((item) => item.code === locale);
  const currentCurrency = CURRENCIES.find((item) => item.code === currency);
  const lockedRoomsCount = ROOM_DEFINITIONS.filter((room) => roomConfig.rooms[room.id]).length;
  const enabledNotifications = Object.values(notifs).filter(Boolean).length;
  const panels: Array<{ id: SettingsPanel; title: string; value: string; icon: React.ElementType }> = [
    {
      id: "account",
      title: t("settings.profile"),
      value: isGuest ? t("topbar.guest_mode") : userEmail || "-",
      icon: User,
    },
    {
      id: "preferences",
      title: t("settings.appearance"),
      value: `${currentLocale?.badge ?? locale} · ${currency}`,
      icon: Palette,
    },
    {
      id: "automation",
      title: t("settings.notifications"),
      value: `${enabledNotifications}/5`,
      icon: Bell,
    },
    {
      id: "security",
      title: t("settings.security"),
      value: `${lockedRoomsCount}/${ROOM_DEFINITIONS.length}`,
      icon: Shield,
    },
  ];

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    const { signedOut } = await import("@/lib/auth/session-manager");
    signedOut();
    window.location.replace("/login");
  }

  async function handleImportGuest() {
    setImporting(true);
    try {
      await migrateGuestData({ saveSettings: false });
      setHasGuestData(false);
      setImportDone(true);
      setTimeout(() => setImportDone(false), 3000);
    } finally {
      setImporting(false);
    }
  }

  async function handleExport(type: "transactions" | "goals" | "debts") {
    setExporting(true);
    try {
      const res = await fetch(`/api/export?type=${type}`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `spendix-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    const res = await fetch("/api/auth/account", { method: "DELETE" });
    if (!res.ok) { setDeleting(false); setDeleteStep("idle"); return; }
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.replace("/login");
  }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const fullName = profile.name.trim();
      if (fullName) {
        await supabase.auth.updateUser({ data: { full_name: fullName } });
      }
      await supabase.from("profile_settings").upsert({
        user_id:    user.id,
        full_name:  fullName || null,
        language:   locale,
        currency,
        theme,
        preferences: { notifs, ai_settings: ai },
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    }
    // Also keep localStorage as offline fallback
    try {
      localStorage.setItem("spendix_notifs",      JSON.stringify(notifs));
      localStorage.setItem("spendix_ai_settings", JSON.stringify(ai));
    } catch {}
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handlePasswordChange() {
    if (!newPassword || newPassword.length < 6) {
      setPwChangeMsg({ ok: false, text: t("auth.password_min") });
      return;
    }
    setChangingPw(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPw(false);
    if (error) {
      setPwChangeMsg({ ok: false, text: error.message });
    } else {
      setPwChangeMsg({ ok: true, text: t("settings.password_changed") });
      setNewPassword("");
      setShowPwChange(false);
      setTimeout(() => setPwChangeMsg(null), 3000);
    }
  }

  function handleRoomPinSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!setPin(roomPin)) {
      setPinError(t("rooms.pin_length_error"));
      return;
    }
    setRoomPin("");
    setPinError("");
    setPinSaved(true);
    setTimeout(() => setPinSaved(false), 1800);
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-20 -mx-3 border-b border-[hsl(var(--border-2))] bg-[hsl(var(--bg))]/92 px-3 py-2.5 backdrop-blur-xl sm:-mx-5 sm:px-5 lg:-mx-7 lg:px-7 xl:-mx-8 xl:px-8">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-black t1">{t("settings.title")}</h1>
            <p className="mt-0.5 truncate text-[11px] t3">{t("settings.subtitle")}</p>
          </div>
          <motion.button
            type="button"
            onClick={handleSave}
            disabled={saving}
            whileTap={{ scale: 0.96 }}
            transition={tapTransition}
            className={`inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold transition-all disabled:opacity-50 ${
              saved
                ? "border border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                : "bg-cyan-400 text-[#071018]"
            }`}
          >
            {saved ? <Check className="h-3.5 w-3.5" /> : saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {saved ? t("settings.saved") : saving ? t("common.loading") : t("settings.save")}
          </motion.button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300">
            {isGuest ? <User className="h-5 w-5" /> : <span className="text-sm font-black">{initials}</span>}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold t1">{profile.name || t("settings.profile")}</p>
            <p className="mt-0.5 truncate text-xs t3">{isGuest ? t("topbar.guest_mode") : userEmail || profile.email || "-"}</p>
          </div>
          <div className="hidden grid-cols-3 gap-1.5 sm:grid">
            {[
              { label: t("settings.language"), value: currentLocale?.badge ?? locale },
              { label: t("settings.currency"), value: currentCurrency?.symbol ?? currency },
              { label: t("settings.security"), value: `${lockedRoomsCount}/${ROOM_DEFINITIONS.length}` },
            ].map((item) => (
              <div key={item.label} className="min-w-16 rounded-xl bg-[hsl(var(--bg-input))] px-2.5 py-1.5 text-center">
                <p className="text-[9px] t3">{item.label}</p>
                <p className="text-xs font-black t1">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isGuest && (
        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-3">
          <div className="flex items-center gap-3">
            <User className="h-4 w-4 shrink-0 text-cyan-300" />
            <p className="min-w-0 flex-1 text-xs leading-relaxed t2">{t("guest_banner.message")}</p>
            <Link href="/login" className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-cyan-400 px-3 text-xs font-bold text-[#071018]">
              <LogIn className="h-3.5 w-3.5" />
              {t("nav.sign_in")}
            </Link>
          </div>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {panels.map((panel) => (
          <PanelButton
            key={panel.id}
            selected={activePanel === panel.id}
            onClick={() => setActivePanel(panel.id)}
            icon={panel.icon}
            title={panel.title}
            value={panel.value}
          />
        ))}
      </div>

      <motion.div
        key={activePanel}
        variants={fadeIn}
        initial="hidden"
        animate="visible"
        transition={spring}
        className="space-y-4"
      >
        {activePanel === "account" && (
          <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            <SectionShell icon={User} title={t("settings.profile")} description={isGuest ? t("topbar.guest_mode") : userEmail} tone="cyan">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold t3">{t("settings.full_name")}</span>
                  <input
                    value={profile.name}
                    onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))}
                    className="field"
                    disabled={isGuest}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold t3">{t("settings.email")}</span>
                  <input
                    value={profile.email}
                    readOnly
                    className="field opacity-60 cursor-not-allowed"
                  />
                </label>
              </div>
              {!isGuest && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {/* Password change */}
                  <button
                    type="button"
                    onClick={() => setShowPwChange((v) => !v)}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-3 text-xs font-bold text-cyan-300"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    {t("settings.change_password")}
                  </button>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-rose-400/25 bg-rose-400/10 px-3 text-xs font-bold text-rose-300 disabled:opacity-50"
                  >
                    {signingOut ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
                    {t("nav.sign_out")}
                  </button>
                </div>
              )}

              {/* Password change form */}
              {showPwChange && !isGuest && (
                <div className="mt-3 space-y-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-3">
                  <p className="text-xs font-semibold text-cyan-300">{t("settings.change_password")}</p>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={t("auth.password_min")}
                      minLength={6}
                      className="field flex-1 text-sm"
                    />
                    <button
                      type="button"
                      onClick={handlePasswordChange}
                      disabled={changingPw || newPassword.length < 6}
                      className="min-h-10 rounded-xl bg-cyan-400 px-4 text-xs font-bold text-[#071018] disabled:opacity-50"
                    >
                      {changingPw ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("common.save")}
                    </button>
                  </div>
                  {pwChangeMsg && (
                    <p className={`text-xs ${pwChangeMsg.ok ? "text-emerald-400" : "text-rose-400"}`}>
                      {pwChangeMsg.text}
                    </p>
                  )}
                </div>
              )}
            </SectionShell>

            {!isGuest && hasGuestData && (
              <SectionShell icon={LogIn} title={t("settings.import_guest_title")} description={t("settings.import_guest_hint")} tone="cyan">
                {importDone ? (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2.5 text-sm font-semibold text-emerald-300">
                    <Check className="h-4 w-4" />
                    {t("settings.import_guest_done")}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleImportGuest}
                    disabled={importing}
                    className="flex min-h-10 w-full items-center gap-3 rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-3 text-sm font-semibold text-cyan-300 transition-all disabled:opacity-50"
                  >
                    {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                    {t("settings.import_guest_btn")}
                  </button>
                )}
              </SectionShell>
            )}
          </div>
        )}

        {activePanel === "preferences" && (
          <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            <SectionShell icon={Globe} title={t("settings.language")} description={t("settings.language_hint")} tone="cyan">
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                {LOCALES.map((item) => (
                  <ChoiceButton
                    key={item.code}
                    selected={locale === item.code}
                    onClick={() => void setLocale(item.code as Locale)}
                    title={item.nativeLabel}
                    subtitle={item.label}
                    prefix={<span className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-400/10 text-xs font-black text-cyan-300">{item.badge}</span>}
                  />
                ))}
              </div>
            </SectionShell>

            <div className="space-y-4">
              <SectionShell icon={WalletCards} title={t("settings.currency")} description={t("settings.currency_hint")} tone="emerald">
                <div className="grid gap-2 sm:grid-cols-2">
                  {CURRENCIES.map((item) => (
                    <ChoiceButton
                      key={item.code}
                      selected={currency === item.code}
                      onClick={() => setCurrency(item.code as Currency)}
                      title={item.code}
                      subtitle={t(item.labelKey)}
                      prefix={<span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-400/10 text-sm font-black text-emerald-300">{item.symbol}</span>}
                    />
                  ))}
                </div>
              </SectionShell>

              <SectionShell icon={Palette} title={t("settings.appearance")} tone="violet">
                <div className="grid grid-cols-2 gap-2">
                  <ChoiceButton
                    selected={theme === "dark"}
                    onClick={() => setTheme("dark")}
                    title={t("settings.dark_mode")}
                    prefix={<span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-400/10 text-violet-300"><Moon className="h-4 w-4" /></span>}
                  />
                  <ChoiceButton
                    selected={theme === "light"}
                    onClick={() => setTheme("light")}
                    title={t("settings.light_mode")}
                    prefix={<span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-400/10 text-amber-300"><Sun className="h-4 w-4" /></span>}
                  />
                </div>
              </SectionShell>
            </div>
          </div>
        )}

        {activePanel === "automation" && (
          <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            <SectionShell icon={Bell} title={t("settings.notifications")} description={t("settings.notifications_hint")} tone="amber">
              <div className="mb-2 flex items-center justify-between rounded-xl bg-[hsl(var(--bg-card-2))] px-3 py-2">
                <span className="text-xs font-semibold t2">{t("settings.notifications")}</span>
                <span className="rounded-lg bg-amber-400/10 px-2 py-1 text-xs font-bold text-amber-300">{enabledNotifications}/5</span>
              </div>
              <SettingLine label={t("settings.budget_alerts")} hint={t("settings.budget_alerts_hint")}>
                <Toggle checked={notifs.budget} onChange={(value) => setNotifs((current) => ({ ...current, budget: value }))} />
              </SettingLine>
              <SettingLine label={t("settings.debt_reminders")} hint={t("settings.debt_reminders_hint")}>
                <Toggle checked={notifs.debt_reminders} onChange={(value) => setNotifs((current) => ({ ...current, debt_reminders: value }))} />
              </SettingLine>
              <SettingLine label={t("settings.weekly_summary")} hint={t("settings.weekly_summary_hint")}>
                <Toggle checked={notifs.weekly} onChange={(value) => setNotifs((current) => ({ ...current, weekly: value }))} />
              </SettingLine>
              <SettingLine label={t("settings.ai_alerts")} hint={t("settings.ai_alerts_hint")}>
                <Toggle checked={notifs.ai_alerts} onChange={(value) => setNotifs((current) => ({ ...current, ai_alerts: value }))} />
              </SettingLine>
              <SettingLine label={t("settings.email_notifications")} hint={t("settings.email_notifications_hint")}>
                <Toggle checked={notifs.email} onChange={(value) => setNotifs((current) => ({ ...current, email: value }))} />
              </SettingLine>
            </SectionShell>

            <SectionShell icon={Sparkles} title={t("settings.ai")} description={t("settings.ai_hint")} tone="violet">
              <SettingLine label={t("settings.enable_ai")} hint={t("settings.enable_ai_hint")}>
                <Toggle checked={ai.enabled} onChange={(value) => setAI((current) => ({ ...current, enabled: value }))} />
              </SettingLine>
              <SettingLine label={t("settings.auto_refresh")} hint={t("settings.auto_refresh_hint")}>
                <Toggle checked={ai.auto} onChange={(value) => setAI((current) => ({ ...current, auto: value }))} />
              </SettingLine>
              <div className="pt-2">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide t3">{t("settings.ai_model")}</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  <ChoiceButton
                    selected={ai.model === "claude-haiku"}
                    onClick={() => setAI((current) => ({ ...current, model: "claude-haiku" }))}
                    title="Claude Haiku"
                    subtitle={t("settings.model_fast")}
                  />
                  <ChoiceButton
                    selected={ai.model === "claude-sonnet"}
                    onClick={() => setAI((current) => ({ ...current, model: "claude-sonnet" }))}
                    title="Claude Sonnet"
                    subtitle={t("settings.model_balanced")}
                  />
                </div>
              </div>
            </SectionShell>
          </div>
        )}

        {activePanel === "security" && (
          <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            <SectionShell icon={Shield} title={t("settings.security")} description={t("rooms.settings_hint")} tone="slate">
              <form onSubmit={handleRoomPinSubmit} className="mb-3 rounded-xl border border-[hsl(var(--border-2))] bg-[hsl(var(--bg-card-2))] p-3">
                <div className="mb-2 flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-cyan-400/10 text-cyan-300">
                    <KeyRound className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold t1">{t("rooms.pin_title")}</p>
                    <p className="line-clamp-1 text-xs t3">{hasPin ? t("rooms.pin_active") : t("rooms.pin_inactive")}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={roomPin}
                    onChange={(event) => {
                      setRoomPin(event.target.value);
                      if (pinError) setPinError("");
                    }}
                    type="password"
                    inputMode="numeric"
                    autoComplete="new-password"
                    className="field flex-1"
                    placeholder={t("rooms.new_pin_placeholder")}
                  />
                  <button type="submit" className="min-h-10 rounded-xl bg-cyan-400 px-4 text-sm font-bold text-[#071018]">
                    {pinSaved ? t("common.saved") : t("rooms.save_pin")}
                  </button>
                </div>
                {pinError && <p className="mt-2 text-xs text-rose-300">{pinError}</p>}
              </form>

              <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
                {ROOM_DEFINITIONS.map((room) => (
                  <SettingLine key={room.id} label={t(room.labelKey)} hint={t(room.descriptionKey)}>
                    <Toggle checked={roomConfig.rooms[room.id]} onChange={(value) => setRoomLocked(room.id, value)} />
                  </SettingLine>
                ))}
              </div>

              {!hasPin && (
                <p className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs leading-relaxed text-amber-200">
                  {t("rooms.pin_required_hint")}
                </p>
              )}

              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                <button
                  type="button"
                  onClick={lockAllRooms}
                  disabled={!hasPin}
                  className="flex min-h-10 items-center gap-3 rounded-xl border border-[hsl(var(--border-2))] bg-[hsl(var(--bg-card-2))] px-3 text-sm font-semibold t1 transition-all disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <LockKeyhole className="h-4 w-4 text-amber-300" />
                  <span className="flex-1 text-start">{t("rooms.lock_now")}</span>
                  <ChevronRight className="h-4 w-4 t3" />
                </button>
                <button
                  type="button"
                  onClick={clearPin}
                  className="flex min-h-10 items-center gap-3 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 text-sm font-semibold text-rose-300 transition-all"
                >
                  <Shield className="h-4 w-4" />
                  <span className="flex-1 text-start">{t("rooms.disable_all")}</span>
                  <ChevronRight className="h-4 w-4 opacity-70" />
                </button>
              </div>
            </SectionShell>

            <div className="space-y-4">
              {!isGuest && (
                <SectionShell icon={Download} title={t("settings.export_title")} description={t("settings.export_hint")} tone="emerald">
                  <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                    {(["transactions", "goals", "debts"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleExport(type)}
                        disabled={exporting}
                        className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 text-xs font-semibold text-emerald-300 transition-all disabled:opacity-50"
                      >
                        {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        {t(`settings.export_${type}`)}
                      </button>
                    ))}
                  </div>
                </SectionShell>
              )}

              {!isGuest && (
                <SectionShell icon={Trash2} title={t("settings.danger_zone")} description={t("settings.danger_zone_hint")} tone="rose">
                  {deleteStep === "idle" && (
                    <button
                      type="button"
                      onClick={() => setDeleteStep("export")}
                      className="flex min-h-10 w-full items-center gap-3 rounded-xl border border-rose-400/25 bg-rose-400/10 px-3 text-sm font-semibold text-rose-300 transition-all"
                    >
                      <Trash2 className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-start">{t("settings.delete_account")}</span>
                    </button>
                  )}

                  {deleteStep === "export" && (
                    <div className="space-y-3 rounded-xl border border-amber-400/30 bg-amber-400/8 p-3">
                      <p className="text-sm font-semibold text-amber-300">{t("settings.delete_export_first")}</p>
                      <p className="text-xs text-amber-300/70">{t("settings.delete_export_hint")}</p>
                      <div className="flex gap-2">
                        <a
                          href="/api/export?type=backup"
                          download
                          className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-3 text-xs font-bold text-white"
                          onClick={() => setTimeout(() => setDeleteStep("confirm"), 1500)}
                        >
                          <Download className="h-3.5 w-3.5" />
                          {t("settings.delete_export_btn")}
                        </a>
                        <button
                          type="button"
                          onClick={() => setDeleteStep("confirm")}
                          className="min-h-10 rounded-xl border border-rose-400/30 px-3 text-xs font-semibold text-rose-300"
                        >
                          {t("settings.delete_skip_export")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteStep("idle")}
                          className="min-h-10 rounded-xl border border-[hsl(var(--border))] px-3 text-xs font-semibold t2"
                        >
                          {t("common.cancel")}
                        </button>
                      </div>
                    </div>
                  )}

                  {deleteStep === "confirm" && (
                    <div className="space-y-3 rounded-xl border border-rose-400/30 bg-rose-400/10 p-3">
                      <p className="text-sm font-semibold text-rose-300">{t("settings.delete_confirm_text")}</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleDeleteAccount}
                          disabled={deleting}
                          className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-rose-500 px-3 text-xs font-bold text-white disabled:opacity-50"
                        >
                          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          {t("settings.delete_confirm_btn")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteStep("idle")}
                          className="min-h-10 rounded-xl border border-[hsl(var(--border))] px-4 text-xs font-semibold t2"
                        >
                          {t("common.cancel")}
                        </button>
                      </div>
                    </div>
                  )}
                </SectionShell>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
