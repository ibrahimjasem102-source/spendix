"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { setAuthToken } from "@/lib/auth/token-store";

interface GuestContextType {
  isGuest: boolean;
  isLoading: boolean;
}

const GuestContext = createContext<GuestContextType>({ isGuest: true, isLoading: true });

function detectSessionSync(): boolean {
  if (typeof window === "undefined") return false;
  try {
    // 1. Our own persisted key (set explicitly on login/logout)
    const stored = localStorage.getItem("spendix_access_token");
    if (stored) {
      setAuthToken(stored); // set immediately — no race condition
      return true;
    }
    // 2. Fallback: Supabase's internal key (handles first load after deploy)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return false;
    const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
    const baseKey    = `sb-${projectRef}-auth-token`;
    const raw        = localStorage.getItem(baseKey);
    if (!raw || raw === "chunked") return false;
    const parsed = JSON.parse(raw) as { access_token?: string };
    if (parsed?.access_token) {
      setAuthToken(parsed.access_token); // persist to our key + set in memory
      return true;
    }
  } catch {}
  return false;
}

export function GuestProvider({ children }: { children: React.ReactNode }) {
  const hasSession = detectSessionSync();
  const [isGuest, setIsGuest] = useState(!hasSession);
  const [isLoading, setIsLoading] = useState(!hasSession);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!active) return;
        setAuthToken(session?.access_token ?? null);
        setIsGuest(!session?.user);
        setIsLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setIsGuest(true);
        setIsLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (!active) return;
      setAuthToken(session?.access_token ?? null);
      setIsGuest(!session?.user);
      setIsLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <GuestContext.Provider value={{ isGuest, isLoading }}>
      {children}
    </GuestContext.Provider>
  );
}

export function useGuest() {
  return useContext(GuestContext);
}
