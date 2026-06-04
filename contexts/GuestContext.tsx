"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { signedIn, signedOut, initSession } from "@/lib/auth/session-manager";

interface GuestContextType {
  isGuest:  boolean;
  isLoading: boolean;
}

const GuestContext = createContext<GuestContextType>({ isGuest: true, isLoading: true });

export function GuestProvider({ children }: { children: React.ReactNode }) {
  // Synchronous init: reads token from localStorage immediately
  // so isGuest is correct before the first render
  const hasSession = initSession();

  const [isGuest,   setIsGuest]   = useState(!hasSession);
  const [isLoading, setIsLoading] = useState(!hasSession);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    // Confirm session is valid (also refreshes if needed)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!active) return;
      if (session?.access_token) {
        signedIn(session.access_token);
        setIsGuest(false);
      } else if (hasSession) {
        // We had a local token but getSession returned null — try refreshing
        try {
          const { data: refreshData } = await supabase.auth.refreshSession();
          if (refreshData.session?.access_token) {
            signedIn(refreshData.session.access_token);
            setIsGuest(false);
          } else {
            signedOut();
            setIsGuest(true);
          }
        } catch {
          // Network error during refresh — keep existing token, assume still valid
          setIsLoading(false);
          return;
        }
      } else {
        signedOut();
        setIsGuest(true);
      }
      setIsLoading(false);
    }).catch(() => {
      if (!active) return;
      // Network error — keep existing state rather than logging out
      setIsLoading(false);
    });

    // Keep in sync with auth state changes (login/logout from any tab)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (!active) return;
      if (session?.access_token) {
        signedIn(session.access_token);
        setIsGuest(false);
      } else {
        signedOut();
        setIsGuest(true);
      }
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
