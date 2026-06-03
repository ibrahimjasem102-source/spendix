"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  BarChart3, TrendingUp, CalendarDays, Users, Bell,
  BookOpen, Tag, User, Settings, ChevronRight, Landmark, Home, Layers3, Download, RefreshCcw, Shield,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useNotifications } from "@/lib/query/hooks";
import { staggerContainer, staggerItem } from "@/lib/motion";

// ── Section groups ─────────────────────────────────────────────

const SECTIONS = [
  {
    groupKey: "nav.finance",
    items: [
      {
        href:     "/analytics",
        icon:     BarChart3,
        labelKey: "nav.analytics",
        descKey:  "more.desc_analytics",
        color:    "text-blue-400",
        bg:       "bg-blue-400/10",
      },
      {
        href:     "/investments",
        icon:     TrendingUp,
        labelKey: "nav.investments",
        descKey:  "more.desc_investments",
        color:    "text-purple-400",
        bg:       "bg-purple-400/10",
      },
      {
        href:     "/debts",
        icon:     Landmark,
        labelKey: "nav.debts",
        descKey:  "more.desc_debts",
        color:    "text-rose-400",
        bg:       "bg-rose-400/10",
      },
      {
        href:     "/calendar",
        icon:     CalendarDays,
        labelKey: "nav.calendar",
        descKey:  "more.desc_calendar",
        color:    "text-cyan-400",
        bg:       "bg-cyan-400/10",
      },
      {
        href:     "/contacts",
        icon:     Users,
        labelKey: "nav.contacts",
        descKey:  "more.desc_contacts",
        color:    "text-emerald-400",
        bg:       "bg-emerald-400/10",
      },
      {
        href:     "/household",
        icon:     Home,
        labelKey: "nav.household",
        descKey:  "more.desc_household",
        color:    "text-cyan-400",
        bg:       "bg-cyan-400/10",
      },
      {
        href:     "/ledger",
        icon:     BookOpen,
        labelKey: "nav.ledger",
        descKey:  "more.desc_ledger",
        color:    "text-indigo-400",
        bg:       "bg-indigo-400/10",
      },
      {
        href:     "/categories",
        icon:     Layers3,
        labelKey: "nav.categories",
        descKey:  "more.desc_categories",
        color:    "text-teal-400",
        bg:       "bg-teal-400/10",
      },
      {
        href:     "/tags",
        icon:     Tag,
        labelKey: "nav.tags",
        descKey:  "more.desc_tags",
        color:    "text-pink-400",
        bg:       "bg-pink-400/10",
      },
    ],
  },
  {
    groupKey: "nav.system",
    items: [
      {
        href:     "/notifications",
        icon:     Bell,
        labelKey: "nav.notifications",
        descKey:  "more.desc_notifications",
        color:    "text-amber-400",
        bg:       "bg-amber-400/10",
        badge:    true,
      },
      {
        href:     "/profile",
        icon:     User,
        labelKey: "nav.profile",
        descKey:  "more.desc_profile",
        color:    "text-gray-400",
        bg:       "bg-gray-400/10",
      },
      {
        href:     "/settings",
        icon:     Settings,
        labelKey: "nav.settings",
        descKey:  "more.desc_settings",
        color:    "text-gray-400",
        bg:       "bg-gray-400/10",
      },
      {
        href:     "/privacy",
        icon:     Shield,
        labelKey: "nav.privacy",
        descKey:  "more.desc_privacy",
        color:    "text-emerald-400",
        bg:       "bg-emerald-400/10",
      },
      {
        href:     "/recurring",
        icon:     RefreshCcw,
        labelKey: "nav.recurring",
        descKey:  "more.desc_recurring",
        color:    "text-purple-400",
        bg:       "bg-purple-400/10",
      },
      {
        href:     "/export",
        icon:     Download,
        labelKey: "nav.export",
        descKey:  "more.desc_export",
        color:    "text-cyan-400",
        bg:       "bg-cyan-400/10",
      },
    ],
  },
] as const;

// ── Nav row ────────────────────────────────────────────────────

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
      className={`flex items-center gap-4 px-4 py-3.5 transition-colors ${
        isActive ? "bg-[hsl(var(--bg-input))]" : "hover:bg-[hsl(var(--bg-input))]"
      } border-b border-[hsl(var(--border-2))] last:border-0`}
    >
      {/* Icon */}
      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${bg}`}>
        <Icon className={`w-4.5 h-4.5 ${color}`} style={{ width: 18, height: 18 }} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold t1 leading-tight">{t(labelKey)}</p>
        <p className="text-xs t3 mt-0.5 leading-tight">{t(descKey)}</p>
      </div>

      {/* Notification badge */}
      {badge && unread && unread > 0 ? (
        <span className="text-[10px] font-bold bg-rose-400 text-white px-2 py-0.5 rounded-full min-w-[20px] text-center shrink-0">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}

      {/* Chevron / active dot */}
      {isActive
        ? <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
        : <ChevronRight className="w-4 h-4 t3 shrink-0" />}
    </Link>
  );
}

// ── Page ───────────────────────────────────────────────────────

export default function MorePage() {
  const { t }      = useTranslation();
  const pathname   = usePathname();
  const { data: notifData } = useNotifications(true);
  const unread = notifData?.unreadCount ?? 0;

  return (
    <div className="space-y-6 pb-32">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold t1">{t("nav.more")}</h1>
        <p className="text-xs t3 mt-0.5">{t("more.subtitle")}</p>
      </div>

      {/* Section groups */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="space-y-5"
      >
        {SECTIONS.map((group) => (
          <motion.section key={group.groupKey} variants={staggerItem}>
            <p className="text-[10px] font-bold t3 uppercase tracking-[0.15em] mb-2 px-1">
              {t(group.groupKey)}
            </p>
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
