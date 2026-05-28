"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AppNotification } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { safeFetch } from "@/lib/fetch-safe";

interface UseNotificationsReturn {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  archiveNotification: (id: string) => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
}

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  const fetch = useCallback(async () => {
    try {
      const res = await safeFetch("/api/notifications?limit=50");
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch();

    const supabase = createClient();

    // Realtime subscription: listen for INSERT / UPDATE / DELETE on notifications
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;

      const channel = supabase.channel(`notifications:${user.id}`)
        .on(
          "postgres_changes" as Parameters<ReturnType<typeof supabase.channel>["on"]>[0],
          {
            event:  "*",
            schema: "public",
            table:  "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload: { eventType: string; new: unknown; old: unknown }) => {
            const cast = (v: unknown) => v as AppNotification;
            if (payload.eventType === "INSERT") {
              setNotifications((prev) => [cast(payload.new), ...prev]);
            } else if (payload.eventType === "UPDATE") {
              const n = cast(payload.new);
              setNotifications((prev) => prev.map((x) => x.id === n.id ? n : x));
            } else if (payload.eventType === "DELETE") {
              const o = cast(payload.old);
              setNotifications((prev) => prev.filter((x) => x.id !== o.id));
            }
          }
        )
        .subscribe();

      channelRef.current = channel;
    });

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [fetch]);

  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => n.id === id ? { ...n, status: "read" as const, read_at: new Date().toISOString() } : n)
    );
    await safeFetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "read" }),
    });
  }, []);

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) =>
      prev.map((n) => n.status === "unread" ? { ...n, status: "read" as const, read_at: new Date().toISOString() } : n)
    );
    await safeFetch("/api/notifications/mark-all-read", { method: "POST" });
  }, []);

  const archiveNotification = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => n.id === id ? { ...n, status: "archived" as const } : n)
    );
    await safeFetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });
  }, []);

  const deleteNotification = useCallback(async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await safeFetch(`/api/notifications/${id}`, { method: "DELETE" });
  }, []);

  const unreadCount = notifications.filter((n) => n.status === "unread").length;

  return {
    notifications,
    unreadCount,
    loading,
    error,
    refresh: fetch,
    markAsRead,
    markAllAsRead,
    archiveNotification,
    deleteNotification,
  };
}
