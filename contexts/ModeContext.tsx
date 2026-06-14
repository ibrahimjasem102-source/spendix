"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { type AppMode, getModeConfig, type ModeConfig } from "@/lib/mode";
import { getAuthToken } from "@/lib/auth/token-store";

interface ModeState {
  mode:       AppMode;
  config:     ModeConfig;
  isLoading:  boolean;
  setMode:    (mode: AppMode) => Promise<void>;
}

const ModeContext = createContext<ModeState>({
  mode:      "personal",
  config:    getModeConfig("personal"),
  isLoading: false,
  setMode:   async () => undefined,
});

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [mode,      setModeState] = useState<AppMode>("personal");
  const [isLoading, setIsLoading] = useState(true);

  // Load mode from profile settings
  useEffect(() => {
    const token = getAuthToken();
    if (!token) { setIsLoading(false); return; }

    fetch("/api/profile/mode", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.mode) setModeState(d.mode as AppMode); })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const setMode = useCallback(async (newMode: AppMode) => {
    setModeState(newMode);
    const token = getAuthToken();
    if (!token) return;

    await fetch("/api/profile/mode", {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ mode: newMode }),
    }).catch(() => {});
  }, []);

  return (
    <ModeContext.Provider value={{
      mode,
      config:    getModeConfig(mode),
      isLoading,
      setMode,
    }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  return useContext(ModeContext);
}
