"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { NAV_ITEMS, ROUTES, type AppRoute, type NavItem } from "@/lib/routes";

const STORAGE_KEY = "spendix_nav_slots_v2"; // v2 because slot count changed

// Default 5 slots: [fixed, changeable, center placeholder, changeable, fixed]
// slot[0] = dashboard (always locked)
// slot[2] = center FAB placeholder (not displayed as a route)
// slot[4] = more      (always locked)
const DEFAULTS: [AppRoute, AppRoute, AppRoute, AppRoute, AppRoute] = [
  ROUTES.dashboard,
  ROUTES.transactions,
  ROUTES.more,
  ROUTES.aiAssistant,
  ROUTES.more,
];

function isAppRoute(value: unknown): value is AppRoute {
  return typeof value === "string" && Object.values(ROUTES).includes(value as AppRoute);
}

function isNavRoute(value: unknown): value is AppRoute {
  return isAppRoute(value) && NAV_ITEMS.some((item) => item.href === value);
}

function normalize(slots: AppRoute[]): [AppRoute, AppRoute, AppRoute, AppRoute, AppRoute] {
  const next: [AppRoute, AppRoute, AppRoute, AppRoute, AppRoute] = [
    ROUTES.dashboard,
    isNavRoute(slots[1]) && slots[1] !== ROUTES.dashboard && slots[1] !== ROUTES.more ? slots[1] : ROUTES.transactions,
    ROUTES.more,
    isNavRoute(slots[3]) && slots[3] !== ROUTES.dashboard && slots[3] !== ROUTES.more ? slots[3] : ROUTES.aiAssistant,
    ROUTES.more,
  ];

  // Deduplicate only the visible custom slots. Slot 2 is the center FAB placeholder.
  const FALLBACKS: AppRoute[] = [ROUTES.transactions, ROUTES.goals, ROUTES.aiAssistant, ROUTES.analytics, ROUTES.budgets];
  if (next[3] === next[1]) {
    next[3] = FALLBACKS.find((route) => route !== next[1] && route !== ROUTES.dashboard && route !== ROUTES.more) ?? ROUTES.analytics;
  }

  return next;
}

function load(): [AppRoute, AppRoute, AppRoute, AppRoute, AppRoute] {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as AppRoute[];
    if (Array.isArray(parsed) && parsed.length === 5) {
      const next = normalize(parsed);
      save(next);
      return next;
    }
  } catch {}
  return DEFAULTS;
}

function save(slots: [AppRoute, AppRoute, AppRoute, AppRoute, AppRoute]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
}

export function useNavConfig() {
  const [slots, setSlots] = useState<[AppRoute, AppRoute, AppRoute, AppRoute, AppRoute]>(DEFAULTS);

  useEffect(() => { setSlots(load()); }, []);

  // Only the visible side slots (1 and 3) are user-customisable. Slot 2 is the center FAB placeholder.
  const updateSlot = useCallback((index: 1 | 2 | 3, route: AppRoute) => {
    if (!isNavRoute(route) || route === ROUTES.dashboard || route === ROUTES.more) return;
    setSlots((prev) => {
      const next = [...prev] as [AppRoute, AppRoute, AppRoute, AppRoute, AppRoute];
      next[index] = route;
      const normalized = normalize(next);
      save(normalized);
      return normalized;
    });
  }, []);

  const resetSlots = useCallback(() => {
    save(DEFAULTS);
    setSlots(DEFAULTS);
  }, []);

  const items = useMemo(
    () => slots.map((href) => NAV_ITEMS.find((i) => i.href === href) ?? NAV_ITEMS[0]),
    [slots]
  );

  return { slots, items, updateSlot, resetSlots };
}
