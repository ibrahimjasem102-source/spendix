"use client";

import { useState, useMemo } from "react";
import {
  Bell, CheckCheck, Archive, Trash2, ExternalLink,
  Search, Info, CheckCircle, AlertTriangle, XCircle, Clock,
  Landmark, Target, Briefcase, TrendingUp, Sparkles, Loader2, PiggyBank,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { AppNotification, NotificationType } from "@/types";
import { useNotifications } from "@/hooks/useNotifications";
import { useTranslation } from "@/lib/i18n";

const TYPE_CONFIG: Record<NotificationType, { icon: React.ElementType; cls: string }> = {
  info:       { icon: Info,         cls: "text-blue-400 bg-blue-400/10"      },
  success:    { icon: CheckCircle,  cls: "text-emerald-400 bg-emerald-400/10" },
  warning:    { icon: AlertTriangle,cls: "text-amber-400 bg-amber-400/10"    },
  error:      { icon: XCircle,      cls: "text-rose-400 bg-rose-400/10"      },
  reminder:   { icon: Clock,        cls: "text-purple-400 bg-purple-400/10"  },
  debt:       { icon: Landmark,     cls: "text-orange-400 bg-orange-400/10"  },
  budget:     { icon: Target,       cls: "text-yellow-400 bg-yellow-400/10"  },
  work:       { icon: Briefcase,    cls: "text-cyan-400 bg-cyan-400/10"      },
  investment: { icon: TrendingUp,   cls: "text-purple-400 bg-purple-400/10" },
  ai:         { icon: Sparkles,     cls: "text-cyan-400 bg-cyan-400/10"      },
  goal:       { icon: PiggyBank,    cls: "text-amber-400 bg-amber-400/10"    },
};

type FilterTab = "all" | "unread" | "debt" | "budget" | "work" | "ai" | "investment" | "goal";

export default function NotificationsPage() {
  const { t }    = useTranslation();
  const router   = useRouter();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, archiveNotification, deleteNotification } =
    useNotifications();

  const [tab, setTab]       = useState<FilterTab>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let list = notifications.filter((n) => n.status !== "archived");

    if (tab === "unread")     list = list.filter((n) => n.status === "unread");
    else if (tab !== "all")   list = list.filter((n) => n.type === tab);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((n) =>
        n.title.toLowerCase().includes(q) ||
        n.message.toLowerCase().includes(q)
      );
    }

    return list;
  }, [notifications, tab, search]);

  const TABS: { value: FilterTab; key: string }[] = [
    { value: "all",        key: "notifications.filter_all"        },
    { value: "unread",     key: "notifications.filter_unread"     },
    { value: "debt",       key: "notifications.filter_debt"       },
    { value: "budget",     key: "notifications.filter_budget"     },
    { value: "work",       key: "notifications.filter_work"       },
    { value: "investment", key: "notifications.filter_investment" },
    { value: "goal",       key: "notifications.filter_goal"       },
    { value: "ai",         key: "notifications.filter_ai"         },
  ];

  function handleClick(n: AppNotification) {
    if (n.status === "unread") void markAsRead(n.id);
    if (n.action_url) router.push(n.action_url);
  }

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-400/10">
            <Bell className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold t1">{t("notifications.title")}</h1>
            {unreadCount > 0 && (
              <p className="text-xs text-cyan-400 mt-0.5">
                {t("notifications.unread_count", { count: String(unreadCount) })}
              </p>
            )}
          </div>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllAsRead}
            className="btn-ghost text-xs flex items-center gap-1.5">
            <CheckCheck className="w-3.5 h-3.5" />
            {t("notifications.mark_all_read")}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-0.5">
        {TABS.map((tb) => (
          <button key={tb.value} onClick={() => setTab(tb.value)}
            className={`tab-pill shrink-0 ${tab === tb.value ? "active" : ""}`}>
            {t(tb.key)}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 t3" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={t("notifications.search")} className="field ps-9" />
      </div>

      {/* List */}
      {loading ? (
        <div className="py-16 flex items-center justify-center gap-2 t3">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">{t("common.loading")}</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card py-20 flex flex-col items-center gap-3">
          <Bell className="w-12 h-12 t3 opacity-20" />
          <p className="text-sm font-semibold t1">{t("notifications.no_notifications")}</p>
          <p className="text-xs t3">{t("notifications.no_notifications_sub")}</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {filtered.map((n) => {
            const cfg      = TYPE_CONFIG[n.type];
            const isUnread = n.status === "unread";
            return (
              <div key={n.id}
                className={`flex items-start gap-3 px-5 py-4 border-b border-[hsl(var(--border-2))] last:border-0 group hover:bg-[hsl(var(--bg-input))] transition-colors ${isUnread ? "bg-cyan-400/3" : ""}`}>
                {/* Type icon */}
                <div className="relative shrink-0 mt-0.5">
                  <div className={`p-2 rounded-xl ${cfg.cls}`}>
                    <cfg.icon className="w-4 h-4" />
                  </div>
                  {isUnread && <span className="absolute -top-0.5 -end-0.5 w-2.5 h-2.5 bg-cyan-400 rounded-full border-2 border-[hsl(var(--bg-card))]" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleClick(n)}>
                  <p className={`text-sm t1 ${isUnread ? "font-bold" : "font-medium"}`}>{n.title}</p>
                  <p className="text-sm t2 mt-0.5">{n.message}</p>
                  <p className="text-xs t3 mt-1">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {n.action_url && (
                    <button onClick={() => handleClick(n)}
                      className="p-1.5 t3 hover:text-cyan-400 hover:bg-cyan-400/10 rounded-lg transition-all">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {isUnread && (
                    <button onClick={() => void markAsRead(n.id)}
                      className="p-1.5 t3 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-all"
                      title={t("notifications.mark_read")}>
                      <CheckCheck className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => void archiveNotification(n.id)}
                    className="p-1.5 t3 hover:text-amber-400 hover:bg-amber-400/10 rounded-lg transition-all"
                    title={t("notifications.archive")}>
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => void deleteNotification(n.id)}
                    className="p-1.5 t3 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all"
                    title={t("notifications.delete")}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
