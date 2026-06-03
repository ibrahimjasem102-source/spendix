"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

export type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  setTheme: () => {},
  toggleTheme: () => {},
});

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
    root.classList.remove("light");
  } else {
    root.classList.remove("dark");
    root.classList.add("light");
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    // Sync with what the no-flicker script already applied
    const stored = (localStorage.getItem("spendix_theme") as Theme) || "dark";
    setThemeState(stored);
    applyTheme(stored);
  }, []);

  useEffect(() => {
    const supabase = createClient();

    async function loadProfileTheme() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profile_settings").select("theme").eq("user_id", user.id).maybeSingle();
      const t = data?.theme as Theme | undefined;
      if (t === "dark" || t === "light") {
        setThemeState(t);
        localStorage.setItem("spendix_theme", t);
        applyTheme(t);
      }
    }

    void loadProfileTheme();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        void loadProfileTheme();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem("spendix_theme", t);
    applyTheme(t);
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      void supabase.from("profile_settings").upsert(
        { user_id: user.id, theme: t, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);
  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
