"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, LockKeyhole, LogIn, LogOut, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useGuest } from "@/contexts/GuestContext";
import { getRoomForNavItem, useRoomLocks } from "@/contexts/RoomLockContext";
import { useSidebar } from "@/contexts/SidebarContext";
import { useTranslation } from "@/lib/i18n";
import { ROUTES, SIDEBAR_ITEMS } from "@/lib/routes";
import { useNotifications } from "@/lib/query/hooks";
import { useGoalCount } from "@/hooks/useGoalCount";

const GROUPS: { key: "primary" | "finance" | "ai" | "system"; labelKey?: string }[] = [
  { key: "primary" },
  { key: "finance", labelKey: "nav.finance" },
  { key: "ai", labelKey: "nav.ai_section" },
  { key: "system", labelKey: "nav.system" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isGuest } = useGuest();
  const { isRoomLocked, isRoomUnlocked } = useRoomLocks();
  const { collapsed, toggle } = useSidebar();
  const { t } = useTranslation();
  const { data: notifData } = useNotifications(!isGuest);
  const unreadCount = notifData?.unreadCount ?? 0;
  const goalCount   = useGoalCount();

  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    if (isGuest) {
      setUserEmail(null);
      return;
    }
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => setUserEmail(user?.email ?? null));
  }, [isGuest]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    const { setAuthToken } = await import("@/lib/auth/token-store");
    setAuthToken(null);
    window.location.replace("/login");
  }

  const userInitial = (userEmail?.[0] ?? "G").toUpperCase();

  return (
    <aside
      className={cn(
        "relative z-20 flex h-screen shrink-0 flex-col p-3 transition-all duration-300",
        collapsed ? "w-[76px]" : "w-[272px]"
      )}
    >
      <div className="modern-surface flex min-h-0 flex-1 flex-col rounded-[24px]">
        <div className={cn("flex h-[68px] shrink-0 items-center border-b border-[hsl(var(--border))]", collapsed ? "justify-center" : "px-4")}>
          <Link href={ROUTES.dashboard} className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-violet-500 shadow-lg shadow-cyan-950/30">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-base font-black tracking-tight text-white">Spendix</p>
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--text-3))]">
                  Finance OS
                </p>
              </div>
            )}
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-4">
          <div className="space-y-5">
            {GROUPS.map(({ key, labelKey }) => {
              const items = SIDEBAR_ITEMS.filter((item) => item.group === key);
              if (!items.length) return null;

              return (
                <div key={key}>
                  {labelKey && !collapsed && (
                    <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-3))]">
                      {t(labelKey)}
                    </p>
                  )}
                  {labelKey && collapsed && <div className="mx-3 mb-2 h-px bg-[hsl(var(--border))]" />}

                  <div className="space-y-1">
                    {items.map((item) => {
                      const active = pathname === item.href || pathname.startsWith(item.href + "/");
                      const isNotifications = item.href === ROUTES.notifications;
                      const isGoals = item.href === ROUTES.goals;
                      const room = getRoomForNavItem(item);
                      const locked = isRoomLocked(room) && !isRoomUnlocked(room);

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          prefetch
                          title={collapsed ? t(item.title) : undefined}
                          className={cn(
                            "group relative flex min-h-[44px] items-center gap-3 rounded-2xl px-3 text-sm font-semibold transition-all",
                            active
                              ? "bg-cyan-400/10 text-cyan-300 shadow-[0_0_0_1px_rgba(34,211,238,0.18)_inset]"
                              : "text-[hsl(var(--text-3))] hover:bg-[hsl(var(--bg-input))] hover:text-[hsl(var(--text-1))]",
                            collapsed && "justify-center px-0"
                          )}
                        >
                          {active && !collapsed && <span className="absolute inset-y-2 start-0 w-1 rounded-full bg-cyan-300" />}
                          <span className="h-4 w-4 shrink-0 flex items-center justify-center [&>svg]:h-full [&>svg]:w-full">
                            {item.icon}
                          </span>
                          {!collapsed && <span className="min-w-0 flex-1 truncate">{t(item.title)}</span>}

                          {locked && (
                            <LockKeyhole
                              className={cn(
                                "h-3.5 w-3.5 shrink-0 text-amber-300",
                                collapsed && "absolute end-1 top-1"
                              )}
                            />
                          )}

                          {isNotifications && unreadCount > 0 && (
                            <span className={cn(
                              "flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-400 px-1 text-[9px] font-black text-white",
                              collapsed && "absolute end-1 top-1"
                            )}>
                              {unreadCount > 99 ? "99+" : unreadCount}
                            </span>
                          )}
                          {isGoals && goalCount > 0 && (
                            <span className={cn(
                              "flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-amber-400 px-1 text-[9px] font-black text-[#0B0F14]",
                              collapsed && "absolute end-1 top-1"
                            )}>
                              {goalCount > 99 ? "99+" : goalCount}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-[hsl(var(--border))] p-2">
          {!collapsed && (
            <div className="mb-1 flex items-center gap-3 rounded-2xl bg-[hsl(var(--bg-input))] px-3 py-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 text-sm font-black text-white">
                {userInitial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-[hsl(var(--text-1))]">
                  {isGuest ? t("topbar.guest_mode") : userEmail ?? "-"}
                </p>
                <p className="text-[10px] text-[hsl(var(--text-3))]">Spendix</p>
              </div>
            </div>
          )}

          {isGuest ? (
            <Link
              href="/login"
              title={collapsed ? t("nav.sign_in") : undefined}
              className={cn("flex min-h-[42px] items-center gap-3 rounded-2xl px-3 text-sm font-semibold text-cyan-300 hover:bg-cyan-400/10", collapsed && "justify-center px-0")}
            >
              <LogIn className="h-4 w-4 shrink-0" />
              {!collapsed && t("nav.sign_in")}
            </Link>
          ) : (
            <button
              onClick={handleSignOut}
              title={collapsed ? t("nav.sign_out") : undefined}
              className={cn("flex min-h-[42px] w-full items-center gap-3 rounded-2xl px-3 text-sm font-semibold text-[hsl(var(--text-3))] hover:bg-rose-400/10 hover:text-rose-300", collapsed && "justify-center px-0")}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!collapsed && t("nav.sign_out")}
            </button>
          )}

          <button
            onClick={toggle}
            className={cn("mt-1 flex min-h-[38px] w-full items-center gap-3 rounded-2xl px-3 text-xs font-semibold text-[hsl(var(--text-3))] hover:bg-[hsl(var(--bg-input))] hover:text-[hsl(var(--text-1))]", collapsed && "justify-center px-0")}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /><span>{t("nav.collapse")}</span></>}
          </button>
        </div>
      </div>
    </aside>
  );
}
