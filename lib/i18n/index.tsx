"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import arDictionary from "@/locales/ar/common.json";
import deDictionary from "@/locales/de/common.json";
import enDictionary from "@/locales/en/common.json";

export type Locale = "ar" | "en" | "de";
export type Direction = "ltr" | "rtl";
type Dictionary = Record<string, unknown>;

export const DEFAULT_LOCALE: Locale = "ar";
export const FALLBACK_LOCALE: Locale = "en";
export const LOCALE_STORAGE_KEY = "spendix_locale";

export const LOCALES: { code: Locale; label: string; nativeLabel: string; badge: string }[] = [
  { code: "ar", label: "Arabic", nativeLabel: "العربية", badge: "AR" },
  { code: "en", label: "English", nativeLabel: "English", badge: "EN" },
  { code: "de", label: "German", nativeLabel: "Deutsch", badge: "DE" },
];

const SUPPORTED_LOCALE_SET = new Set<Locale>(LOCALES.map((locale) => locale.code));
const RTL_LOCALES = new Set<Locale>(["ar"]);

const dictionaryLoaders: Record<Locale, () => Promise<Dictionary>> = {
  ar: () => import("@/locales/ar/common.json").then((module) => module.default),
  en: () => import("@/locales/en/common.json").then((module) => module.default),
  de: () => import("@/locales/de/common.json").then((module) => module.default),
};

const initialDictionaries: Record<Locale, Dictionary> = {
  ar: arDictionary,
  en: enDictionary,
  de: deDictionary,
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && SUPPORTED_LOCALE_SET.has(value as Locale);
}

function getInitialLocale(initialLocale?: Locale): Locale {
  if (initialLocale) return initialLocale;
  if (typeof window === "undefined") return DEFAULT_LOCALE;

  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return isLocale(stored) ? stored : DEFAULT_LOCALE;
}

export function getDirection(locale: Locale): Direction {
  return RTL_LOCALES.has(locale) ? "rtl" : "ltr";
}

function applyDocumentLocale(locale: Locale) {
  if (typeof document === "undefined") return;

  const direction = getDirection(locale);
  document.documentElement.lang = locale;
  document.documentElement.dir = direction;
  document.documentElement.dataset.locale = locale;
  document.documentElement.dataset.direction = direction;
}

function getByPath(dictionary: Dictionary | undefined, key: string): unknown {
  if (!dictionary) return undefined;
  return key.split(".").reduce<unknown>((current, part) => {
    if (current && typeof current === "object") {
      return (current as Record<string, unknown>)[part];
    }
    return undefined;
  }, dictionary);
}

function interpolate(value: string, params?: Record<string, string | number>) {
  if (!params) return value;
  return value.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    params[key] === undefined ? `{{${key}}}` : String(params[key])
  );
}

interface I18nContextType {
  locale: Locale;
  dir: Direction;
  isReady: boolean;
  setLocale: (locale: Locale) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
  formatDate: (date: string | Date, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: DEFAULT_LOCALE,
  dir: getDirection(DEFAULT_LOCALE),
  isReady: false,
  setLocale: async () => {},
  t: (key) => key,
  formatDate: (date) => String(date),
  formatNumber: (value) => String(value),
});

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => getInitialLocale(initialLocale));
  const [dictionaries, setDictionaries] = useState<Partial<Record<Locale, Dictionary>>>(initialDictionaries);
  const [isReady, setIsReady] = useState(true);
  const loadedLocales = useRef(new Set<Locale>(LOCALES.map((item) => item.code)));

  const ensureDictionary = useCallback(async (targetLocale: Locale) => {
    if (loadedLocales.current.has(targetLocale)) return;

    const dictionary = await dictionaryLoaders[targetLocale]();
    loadedLocales.current.add(targetLocale);
    setDictionaries((current) => ({ ...current, [targetLocale]: dictionary }));
  }, []);

  const persistLocale = useCallback(async (nextLocale: Locale) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    await supabase
      .from("profile_settings")
      .upsert(
        { user_id: user.id, language: nextLocale, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
  }, []);

  const setLocale = useCallback(
    async (nextLocale: Locale) => {
      if (!isLocale(nextLocale)) return;

      setLocaleState(nextLocale);
      applyDocumentLocale(nextLocale);
      await ensureDictionary(nextLocale);
      await persistLocale(nextLocale);
    },
    [ensureDictionary, persistLocale]
  );

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      applyDocumentLocale(locale);
      await Promise.all([ensureDictionary(locale), ensureDictionary(FALLBACK_LOCALE)]);
      if (!cancelled) setIsReady(true);
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [ensureDictionary, locale]);

  useEffect(() => {
    const supabase = createClient();

    async function loadProfileLocale() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("profile_settings")
        .select("language")
        .eq("user_id", user.id)
        .maybeSingle();

      if (isLocale(data?.language) && data.language !== locale) {
        setLocaleState(data.language);
        applyDocumentLocale(data.language);
        window.localStorage.setItem(LOCALE_STORAGE_KEY, data.language);
        await ensureDictionary(data.language);
      }
    }

    void loadProfileLocale();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        void loadProfileLocale();
      }
    });

    return () => subscription.unsubscribe();
  }, [ensureDictionary, locale]);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const activeValue = getByPath(dictionaries[locale], key);
      const fallbackValue = getByPath(dictionaries[FALLBACK_LOCALE], key);
      const value = typeof activeValue === "string"
        ? activeValue
        : typeof fallbackValue === "string"
          ? fallbackValue
          : key;

      return interpolate(value, params);
    },
    [dictionaries, locale]
  );

  const localeTag = locale === "ar" ? "ar" : locale === "de" ? "de-DE" : "en-US";

  const formatDate = useCallback(
    (date: string | Date, options?: Intl.DateTimeFormatOptions) => {
      const value = typeof date === "string" ? new Date(`${date}T00:00:00`) : date;
      return new Intl.DateTimeFormat(
        localeTag,
        options ?? {
          month: "short",
          day: "numeric",
          year: "numeric",
        }
      ).format(value);
    },
    [localeTag]
  );

  const formatNumber = useCallback(
    (value: number, options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(localeTag, options).format(value),
    [localeTag]
  );

  const value = useMemo<I18nContextType>(
    () => ({
      locale,
      dir: getDirection(locale),
      isReady,
      setLocale,
      t,
      formatDate,
      formatNumber,
    }),
    [formatDate, formatNumber, isReady, locale, setLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  return useContext(I18nContext);
}
