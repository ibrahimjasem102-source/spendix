"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getSessionState, subscribe, init, type SessionState } from "@/lib/auth/session-manager";

interface GuestContextType {
  isGuest: boolean;
  isLoading: boolean;
}

const GuestContext = createContext<GuestContextType>({ isGuest: true, isLoading: true });

export function GuestProvider({ children }: { children: React.ReactNode }) {
  // Initialize from current singleton state (may already be known if init() ran earlier)
  const [session, setSession] = useState<SessionState>(() => getSessionState());

  useEffect(() => {
    // Trigger one-time async session restore (no-op if already initialized)
    init().catch(() => undefined);

    // Subscribe to all future state changes (login, logout, token refresh)
    const unsubscribe = subscribe(setSession);

    // Sync with any state update that completed between the render and this effect
    setSession(getSessionState());

    return unsubscribe;
  }, []);

  return (
    <GuestContext.Provider value={{
      isGuest: !session.isAuthenticated,
      isLoading: session.isLoading,
    }}>
      {children}
    </GuestContext.Provider>
  );
}

export function useGuest() {
  return useContext(GuestContext);
}
