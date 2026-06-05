"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { setAuthToken, clearTokens, storeRefreshToken } from "@/lib/auth/token-store";

interface GuestContextType {
  isGuest:   boolean;
  isLoading: boolean;
}

const GuestContext = createContext<GuestContextType>({ isGuest: true, isLoading: false });

export function GuestProvider({ children }: { children: React.ReactNode }) {
  // Always start as guest=true to avoid hydration mismatch (server has no localStorage)
  const [isGuest, setIsGuest] = useState(true);

  // useLayoutEffect: runs client-side BEFORE first paint
  // Reads Supabase's own session from localStorage synchronously
  useLayoutEffect(() => {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!url) return;
      const ref = new URL(url).hostname.split(".")[0];
      const key = `sb-${ref}-auth-token`;
      const raw = localStorage.getItem(key);
      if (!raw) return;

      let token: string | null = null;
      if (raw === "chunked") {
        let joined = "";
        for (let i = 0; ; i++) {
          const chunk = localStorage.getItem(`${key}.${i}`);
          if (!chunk) break;
          joined += chunk;
        }
        token = JSON.parse(joined)?.access_token ?? null;
      } else {
        token = JSON.parse(raw)?.access_token ?? null;
      }

      if (token) {
        setAuthToken(token);
        setIsGuest(false);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    // onAuthStateChange is the authoritative source of truth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (session?.access_token) {
        setAuthToken(session.access_token);
        if (session.refresh_token) storeRefreshToken(session.refresh_token);
        setIsGuest(false);
      } else if (event === "SIGNED_OUT") {
        clearTokens();
        setIsGuest(true);
      }
      // For other null-session events: keep current state
    });

    // Background session validation (silent refresh if needed)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      if (session?.access_token) {
        setAuthToken(session.access_token);
        if (session.refresh_token) storeRefreshToken(session.refresh_token);
        setIsGuest(false);
      }
    }).catch(() => undefined);

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <GuestContext.Provider value={{ isGuest, isLoading: false }}>
      {children}
    </GuestContext.Provider>
  );
}

export function useGuest() {
  return useContext(GuestContext);
}
