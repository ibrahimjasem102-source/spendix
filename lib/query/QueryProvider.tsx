"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { setAuthToken } from "@/lib/auth/token-store";
import { createRealtimeManager } from "@/lib/realtime/realtimeManager";

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          gcTime: 10 * 60_000,
          refetchOnWindowFocus: false,
          refetchOnReconnect: true,
          refetchOnMount: true,
          retry: (failureCount, error) => {
            const status = (error as { status?: number })?.status;
            // Allow one retry on 401 — token may have been stale during initial load
            // and Supabase fires TOKEN_REFRESHED shortly after
            if (status === 401 && failureCount === 0) return true;
            if (status && status >= 400 && status < 500) return false;
            return failureCount < 2;
          },
          retryDelay: (attempt) => attempt === 0 ? 2000 : Math.min(1000 * 2 ** attempt, 8000),
        },
        mutations: {
          retry: (failureCount, error) => {
            const status = (error as { status?: number })?.status;
            // Allow one retry on 401 — token may have been stale (race with TOKEN_REFRESHED)
            if (status === 401 && failureCount === 0) return true;
            if (status && status >= 400 && status < 500) return false;
            return failureCount < 1;
          },
          retryDelay: (attempt) => attempt === 0 ? 2000 : 1000,
        },
      },
    })
  );

  useEffect(() => {
    const supabase = createClient();
    const realtime = createRealtimeManager(queryClient);
    let active = true;
    let prevUserId: string | null = null;
    let isFirstEvent = true;

    supabase.auth.getSession().then(({ data }) => {
      setAuthToken(data.session?.access_token ?? null);
      if (active && data.session?.user) realtime.start(data.session.user.id);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUserId = session?.user?.id ?? null;
      setAuthToken(session?.access_token ?? null);

      // Clear cache when user actually changes (login/logout), not on token refresh.
      // Skip the first event (INITIAL_SESSION) since it's restoring existing state.
      if (!isFirstEvent && prevUserId !== newUserId) {
        queryClient.clear();
      }
      isFirstEvent = false;
      prevUserId = newUserId;

      realtime.stop();
      if (session?.user) realtime.start(session.user.id);
    });

    return () => {
      active = false;
      realtime.stop();
      subscription.subscription.unsubscribe();
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
