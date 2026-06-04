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
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return false;
    const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
    const raw = localStorage.getItem(`sb-${projectRef}-auth-token`);
    if (!raw) return false;
    const parsed = raw === "chunked" ? null : JSON.parse(raw) as { access_token?: string };
    return !!(parsed?.access_token);
  } catch { return false; }
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
