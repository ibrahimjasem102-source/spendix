"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  CalendarDays, Users, Bell, BookOpen, Tag, User,
  Settings, ChevronRight, Download, RefreshCcw, Shield,
  TrendingUp, Home, CreditCard, LayoutGrid, MoreHorizontal,
  Heart, Activity, Wallet, Star,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useNotifications } from "@/lib/query/hooks";
import { staggerContainer, staggerItem } from "@/lib/motion";

// ── Section definitions ─────────────────────────────────────────────────────

const SECTIONS = [
  {
    groupKey:  "more.group_finance",
    iconColor: "text-emerald-400",
    iconBg:    "bg-emerald-400/10",
    icon:      TrendingUp,
    items: [
      { href: "/net-worth",  icon: TrendingUp,  labelKey: "nav.net_worth",  descKey: "more.desc_net_worth",  color: "text-emerald-400", bg: "bg-emerald-400/10" },
      { href: "/calendar",   icon: CalendarDays,labelKey: "nav.calendar",   descKey: "more.desc_calendar",   color: "text-cyan-400",    bg: "bg-cyan-400/10"    },
      { href: "/recurring",  icon: RefreshCcw,  labelKey: "nav.recurring",  descKey: "more.desc_recurring",  color: "text-purple-400",  bg: "bg-purple-400/10"  },
      { href: "/ledger",     icon: BookOpen,    labelKey: "nav.ledger",     descKey: "more.desc_ledger",     color: "text-indigo-400",  bg: "bg-indigo-400/10"  },
      { href: "/categories", icon: LayoutGrid,  labelKey: "nav.categories", descKey: "more.desc_categories", color: "text-blue-400",    bg: "bg-blue-400/10"    },
      { href: "/tags",       icon: Tag,         labelKey: "nav.tags",       descKey: "more.desc_tags",       color: "text-pink-400",    bg: "bg-pink-400/10"    },
      { href: "/export",     icon: Download,    labelKey: "nav.export",     descKey: "more.desc_export",     color: "text-slate-400",   bg: "bg-slate-400/10"   },
    ],
  },
  {
    groupKey:  "more.group_subscriptions",
    iconColor: "text-violet-400",
    iconBg:    "bg-violet-400/10",
    icon:      CreditCard,
    items: [
      { href: "/subscriptions", icon: CreditCard, labelKey: "nav.subscriptions", descKey: "more.desc_subscriptions", color: "text-violet-400", bg: "bg-violet-400/10" },
      { href: "/plans",         icon: Star,       labelKey: "nav.plans",         descKey: "more.desc_settings",      color: "text-cyan-400",   bg: "bg-cyan-400/10"   },
    ],
  },
  {
    groupKey:  "more.group_family",
    iconColor: "text-rose-400",
    iconBg:    "bg-rose-400/10",
    icon:      Heart,
    items: [
      { href: "/family",    icon: Heart, labelKey: "nav.family",    descKey: "more.desc_household",  color: "text-rose-400",  bg: "bg-rose-400/10"  },
      { href: "/household", icon: Home,  labelKey: "nav.household", descKey: "more.desc_household",  color: "text-amber-400", bg: "bg-amber-400/10" },
      { href: "/contacts",  icon: Users, labelKey: "nav.contacts",  descKey: "more.desc_contacts",   color: "text-teal-400",  bg: "bg-teal-400/10"  },
    ],
  },
  {
    groupKey:  "more.group_account",
    iconColor: "text-gray-400",
    iconBg:    "bg-gray-400/10",
    icon:      User,
    items: [
      { href: "/profile",       icon: User, labelKey: "nav.profile",       descKey: "more.desc_profile",       color: "text-gray-400",  bg: "bg-gray-400/10",  badge: false },
      { href: "/notifications", icon: Bell, labelKey: "nav.notifications", descKey: "more.desc_notifications", color: "text-amber-400", bg: "bg-amber-400/10", badge: true  },
    ],
  },
  {
    groupKey:  "more.group_system",
    iconColor: "text-slate-400",
    iconBg:    "bg-slate-400/10",
    icon:      Settings,
    items: [
      { href: "/settings",   icon: Settings,  labelKey: "nav.settings",   descKey: "more.desc_settings",   color: "text-gray-400",    bg: "bg-gray-400/10"    },
      { href: "/privacy",    icon: Shield,    labelKey: "nav.privacy",    descKey: "more.desc_privacy",    color: "text-emerald-400", bg: "bg-emerald-400/10" },
      { href: "/diagnostic", icon: Activity,  labelKey: "nav.diagnostic", descKey: "more.desc_diagnostic", color: "text-cyan-400",    bg: "bg-cyan-400/10"    },
    ],
  },
] as const;

// ── Nav row ─────────────────────────────────────────────────────────────────

function NavRow({
  href, icon: Icon, labelKey, descKey, color, bg,
  badge, unread, isActive,
}: {
  href: string;
  icon: React.ElementType;
  labelKey: string;
  descKey: string;
  color: string;
  bg: string;
  badge?: boolean;
  unread?: number;
  isActive: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Link
      href={href}
      className={`flex items-center gap-3.5 px-4 py-3.5 transition-colors border-b border-[hsl(var(--border-2))] last:border-0 ${
        isActive ? "bg-[hsl(var(--bg-input))]" : "hover:bg-[hsl(var(--bg-input))]"
      }`}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
        <Icon className={color} style={{ width: 16, height: 16 }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold t1 leading-tight">{t(labelKey)}</p>
        <p className="text-[11px] t3 mt-0.5 leading-tight">{t(descKey)}</p>
      </div>
      {badge && unread && unread > 0 ? (
        <span className="text-[10px] font-bold bg-rose-500 text-white px-1.5 py-0.5 rounded-full min-w-[18px] text-center shrink-0">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
      {isActive
        ? <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
        : <ChevronRight className="w-3.5 h-3.5 t3 shrink-0" />}
    </Link>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function MorePage() {
  const { t }    = useTranslation();
  const pathname = usePathname();
  const { data: notifData } = useNotifications(true);
  const unread = notifData?.unreadCount ?? 0;

  return (
    <div className="space-y-5 pb-6">

      {/* Header */}
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--bg-3))]">
          <MoreHorizontal className="h-4 w-4 t3" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-black t1">{t("nav.more")}</h1>
          <p className="mt-0.5 text-xs t3">{t("more.subtitle")}</p>
        </div>
      </div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="space-y-4"
      >
        {SECTIONS.map((group) => (
          <motion.section key={group.groupKey} variants={staggerItem}>
            <div className="flex items-center gap-2 mb-2 px-1">
              <div className={`flex h-5 w-5 items-center justify-center rounded-lg ${group.iconBg}`}>
                <group.icon className={`h-3 w-3 ${group.iconColor}`} />
              </div>
              <p className="text-[10px] font-black t3 uppercase tracking-[0.15em]">
                {t(group.groupKey)}
              </p>
            </div>
            <div className="card overflow-hidden">
              {group.items.map((item) => (
                <NavRow
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  labelKey={item.labelKey}
                  descKey={item.descKey}
                  color={item.color}
                  bg={item.bg}
                  badge={"badge" in item ? item.badge : false}
                  unread={unread}
                  isActive={pathname === item.href}
                />
              ))}
            </div>
          </motion.section>
        ))}
      </motion.div>
    </div>
  );
}
