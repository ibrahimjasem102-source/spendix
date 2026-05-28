"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Bell, CheckCheck, Archive, Trash2, ExternalLink,
  Info, CheckCircle, AlertTriangle, XCircle, Clock,
  Landmark, Target, Briefcase, TrendingUp, Sparkles, PiggyBank,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { AppNotification, NotificationType } from "@/types";
import { useNotifications } from "@/hooks/useNotifications";
import { useTranslation } from "@/lib/i18n";
import { useGuest } from "@/contexts/GuestContext";

const TYPE_CONFIG: Record<NotificationType, { icon: React.ElementType; cls: string }> = {
  info:       { icon: Info,        cls: "text-blue-400 bg-blue-400/10"     },
  success:    { icon: CheckCircle, cls: "text-emerald-400 bg-emerald-400/10" },
  warning:    { icon: AlertTriangle, cls: "text-amber-400 bg-amber-400/10" },
  error:      { icon: XCircle,     cls: "text-rose-400 bg-rose-400/10"     },
  reminder:   { icon: Clock,       cls: "text-purple-400 bg-purple-400/10" },
  debt:       { icon: Landmark,    cls: "text-orange-400 bg-orange-400/10" },
  budget:     { icon: Target,      cls: "text-yellow-400 bg-yellow-400/10" },
  work:       { icon: Briefcase,   cls: "text-cyan-400 bg-cyan-400/10"     },
  investment: { icon: TrendingUp,  cls: "text-purple-400 bg-purple-400/10" },
  ai:         { icon: Sparkles,    cls: "text-cyan-400 bg-cyan-400/10"     },
  goal:       { icon: PiggyBank,  cls: "text-amber-400 bg-amber-400/10"   },
};

function NotificationItem({
  notification, onMarkRead, onArchive, onDelete,
}: {
  notification: AppNotification;
  onMarkRead: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const cfg    = TYPE_CONFIG[notification.type];
  const isUnread = notification.status === "unread";

  function handleClick() {
    if (isUnread) onMarkRead(notification.id);
    if (notification.action_url) router.push(notification.action_url);
  }

  return (
    <div className={`flex items-start gap-3 px-4 py-3 hover:bg-[hsl(var(--bg-input))] transition-colors border-b border-[hsl(var(--border-2))] last:border-0 ${isUnread ? "bg-cyan-400/3" : ""}`}>
      {/* Unread dot */}
      <div className="relative shrink-0 mt-0.5">
        <div className={`p-1.5 rounded-xl ${cfg.cls}`}>
          <cfg.icon className="w-3.5 h-3.5" />
        </div>
        {isUnread && (
          <span className="absolute -top-0.5 -end-0.5 w-2 h-2 bg-cyan-400 rounded-full" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={handleClick}>
        <p className={`text-xs font-semibold t1 leading-tight ${isUnread ? "font-bold" : ""}`}>
          {notification.title}
        </p>
        <p className="text-xs t2 mt-0.5 line-clamp-2">{notification.message}</p>
        <p className="text-[10px] t3 mt-1">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {notification.action_url && (
          <button onClick={handleClick} title={t("notifications.view_details")}
            className="p-1 t3 hover:text-cyan-400 rounded transition-colors">
            <ExternalLink className="w-3 h-3" />
          </button>
        )}
        {isUnread && (
          <button onClick={(e) => { e.stopPropagation(); onMarkRead(notification.id); }}
            title={t("notifications.mark_read")}
            className="p-1 t3 hover:text-emerald-400 rounded transition-colors">
            <CheckCheck className="w-3 h-3" />
          </button>
        )}
        <button onClick={(e) => { e.stopPropagation(); onArchive(notification.id); }}
          title={t("notifications.archive")}
          className="p-1 t3 hover:text-amber-400 rounded transition-colors">
          <Archive className="w-3 h-3" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(notification.id); }}
          title={t("notifications.delete")}
          className="p-1 t3 hover:text-rose-400 rounded transition-colors">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

export default function NotificationBell() {
  const { isGuest }       = useGuest();
  const { t }             = useTranslation();
  const { notifications, unreadCount, markAsRead, markAllAsRead, archiveNotification, deleteNotification } =
    useNotifications();

  const [open, setOpen]   = useState(false);
  const ref               = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (isGuest) {
    return (
      <button className="relative p-2 rounded-xl t3 cursor-default opacity-50">
        <Bell className="w-4 h-4" />
      </button>
    );
  }

  const visible = notifications.filter((n) => n.status !== "archived").slice(0, 8);

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl t2 hover:t1 hover:bg-[hsl(var(--bg-input))] transition-all">
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 end-1 min-w-[14px] h-3.5 bg-rose-400 rounded-full
            text-[9px] font-bold text-white flex items-center justify-center px-0.5">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute end-0 top-full mt-2 w-80 z-50 modal-card shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))]">
            <div>
              <p className="text-sm font-semibold t1">{t("notifications.title")}</p>
              {unreadCount > 0 && (
                <p className="text-xs text-cyan-400">{t("notifications.unread_count", { count: String(unreadCount) })}</p>
              )}
            </div>
            {unreadCount > 0 && (
              <button onClick={markAllAsRead}
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors">
                <CheckCheck className="w-3 h-3" />
                {t("notifications.mark_all_read")}
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {visible.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Bell className="w-8 h-8 t3 opacity-30" />
                <p className="text-xs t3">{t("notifications.no_notifications")}</p>
              </div>
            ) : (
              <div className="divide-y divide-[hsl(var(--border-2))]">
                {visible.map((n) => (
                  <div key={n.id} className="group">
                    <NotificationItem
                      notification={n}
                      onMarkRead={markAsRead}
                      onArchive={archiveNotification}
                      onDelete={deleteNotification}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-[hsl(var(--border))] px-4 py-2.5">
            <a href="/notifications"
              className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors font-medium">
              {t("notifications.filter_all")} →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
