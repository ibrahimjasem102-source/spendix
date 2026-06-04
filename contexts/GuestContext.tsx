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
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      if (session?.access_token) {
        signedIn(session.access_token);
        setIsGuest(false);
      } else {
        signedOut();
        setIsGuest(true);
      }
      setIsLoading(false);
    }).catch(() => {
      if (!active) return;
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
