"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Globe, LogOut, Menu, Moon, Settings, Sun, User, Wallet } from "lucide-react";
import GlobalSearch from "@/components/search/GlobalSearch";
import NotificationBell from "@/components/notifications/NotificationBell";
import { useGuest } from "@/contexts/GuestContext";
import { createClient } from "@/lib/supabase/client";
import { getNavItem } from "@/lib/routes";
import { LOCALES, type Locale, useTranslation } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isGuest } = useGuest();
  const { t, locale, setLocale } = useTranslation();
  const { theme, toggleTheme } = useTheme();

  const [showUser, setShowUser] = useState(false);
  const [showLang, setShowLang] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    if (isGuest) {
      setUserEmail(null);
      return;
    }
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => setUserEmail(user?.email ?? null));
  }, [isGuest]);

  const page = useMemo(() => getNavItem(pathname), [pathname]);
  const currentLocale = LOCALES.find((item) => item.code === locale);
  const userInitial = (userEmail?.[0] ?? "S").toUpperCase();

  function closeMenus() {
    setShowUser(false);
    setShowLang(false);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    const { setAuthToken } = await import("@/lib/auth/token-store");
    setAuthToken(null);
    window.location.replace("/login");
  }

  const menuClass =
    "modern-surface absolute end-0 top-full mt-2 z-50 min-w-[190px] overflow-hidden rounded-2xl p-1";
  const itemClass =
    "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-[hsl(var(--text-2))] transition-colors hover:bg-[hsl(var(--bg-input))] hover:text-[hsl(var(--text-1))]";

  return (
    <header className="relative z-30 shrink-0 px-3 sm:px-4 lg:px-6 pt-3">
      <div className="modern-surface flex h-[60px] items-center gap-2 rounded-2xl px-2.5 sm:px-3">
        {/* Mobile: compact logo + page title */}
        <div className="flex sm:hidden items-center gap-2 shrink-0 ps-0.5">
          <Link href="/dashboard" className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 shrink-0">
            <Wallet className="h-4 w-4 text-white" />
          </Link>
          {page && pathname !== "/dashboard" && (
            <span className="text-[13px] font-bold t1 truncate max-w-[90px]">{t(page.title)}</span>
          )}
        </div>

        {/* SM–LG: logo only */}
        <Link href="/dashboard" className="hidden sm:flex lg:hidden items-center gap-2 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-violet-500">
            <Wallet className="h-4 w-4 text-white" />
          </div>
        </Link>

        <div className="hidden xl:flex min-w-[180px] flex-col px-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--text-3))]">
            Spendix
          </span>
          <span className="truncate text-sm font-bold text-[hsl(var(--text-1))]">
            {page ? t(page.title) : t("dashboard.title")}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <GlobalSearch />
        </div>

        <div className="ms-auto flex shrink-0 items-center gap-1.5">
          <button
            onClick={toggleTheme}
            className="icon-button hidden sm:flex"
            title={theme === "dark" ? t("topbar.switch_light") : t("topbar.switch_dark")}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <div className="relative hidden sm:block">
            <button
              onClick={() => { setShowLang((value) => !value); setShowUser(false); }}
              className="icon-button gap-1.5 px-3"
            >
              <Globe className="h-4 w-4" />
              <span className="hidden text-xs font-bold md:inline">{currentLocale?.badge}</span>
            </button>
            {showLang && (
              <div className={menuClass}>
                {LOCALES.map((item) => (
                  <button
                    key={item.code}
                    onClick={() => { void setLocale(item.code as Locale); closeMenus(); }}
                    className={`${itemClass} ${locale === item.code ? "bg-cyan-400/10 text-cyan-300" : ""}`}
                  >
                    <span className="w-7 text-xs font-bold">{item.badge}</span>
                    <span>{item.nativeLabel}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <NotificationBell />

          <div className="relative">
            <button
              onClick={() => { setShowUser((value) => !value); setShowLang(false); }}
              className="flex min-h-10 items-center gap-2 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--bg-input))] p-1.5 ps-2 transition-colors hover:border-cyan-400/30"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 text-xs font-bold text-white">
                {isGuest ? <User className="h-4 w-4" /> : userInitial}
              </div>
              <ChevronDown className="hidden h-3.5 w-3.5 text-[hsl(var(--text-3))] sm:block" />
            </button>

            {showUser && (
              <div className={`${menuClass} w-60`}>
                <div className="px-3 py-2">
                  <p className="text-xs text-[hsl(var(--text-3))]">
                    {isGuest ? t("topbar.guest_mode") : t("topbar.signed_in")}
                  </p>
                  {!isGuest && userEmail && (
                    <p className="mt-0.5 truncate text-sm font-semibold text-[hsl(var(--text-1))]">{userEmail}</p>
                  )}
                </div>

                <div className="sm:hidden border-y border-[hsl(var(--border))] py-1">
                  {LOCALES.map((item) => (
                    <button
                      key={item.code}
                      onClick={() => { void setLocale(item.code as Locale); closeMenus(); }}
                      className={`${itemClass} ${locale === item.code ? "bg-cyan-400/10 text-cyan-300" : ""}`}
                    >
                      <Globe className="h-4 w-4" />
                      <span className="w-7 text-xs font-bold">{item.badge}</span>
                      <span>{item.nativeLabel}</span>
                    </button>
                  ))}
                </div>

                <button onClick={() => { toggleTheme(); closeMenus(); }} className={`${itemClass} sm:hidden`}>
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  {theme === "dark" ? t("topbar.switch_light") : t("topbar.switch_dark")}
                </button>
                <Link href="/settings" onClick={closeMenus} className={itemClass}>
                  <Settings className="h-4 w-4" />
                  {t("nav.settings")}
                </Link>

                {isGuest ? (
                  <Link href="/login" onClick={closeMenus} className={`${itemClass} text-cyan-300`}>
                    <Menu className="h-4 w-4" />
                    {t("nav.sign_in")}
                  </Link>
                ) : (
                  <button onClick={handleSignOut} className={`${itemClass} text-rose-300`}>
                    <LogOut className="h-4 w-4" />
                    {t("nav.sign_out")}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {(showUser || showLang) && <div className="fixed inset-0 z-20" onClick={closeMenus} />}
    </header>
  );
}
