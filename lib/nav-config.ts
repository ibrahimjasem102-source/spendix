"use client";

import { useState, useEffect, useCallback } from "react";
import { NAV_ITEMS, ROUTES, type AppRoute, type NavItem } from "@/lib/routes";

const STORAGE_KEY = "spendix_nav_slots";

// Default 4 slots: [left1, left2, right1, right2]
const DEFAULTS: [AppRoute, AppRoute, AppRoute, AppRoute] = [
  ROUTES.dashboard,
  ROUTES.transactions,
  ROUTES.investments,  // investments more useful than debts as default
  ROUTES.more,
];

function isAppRoute(value: unknown): value is AppRoute {
  return typeof value === "string" && Object.values(ROUTES).includes(value as AppRoute);
}

function normalize(slots: AppRoute[]): [AppRoute, AppRoute, AppRoute, AppRoute] {
  const next: [AppRoute, AppRoute, AppRoute, AppRoute] = [
    ROUTES.dashboard,
    isAppRoute(slots[1]) && slots[1] !== ROUTES.dashboard && slots[1] !== ROUTES.more ? slots[1] : ROUTES.transactions,
    isAppRoute(slots[2]) && slots[2] !== ROUTES.dashboard && slots[2] !== ROUTES.more ? slots[2] : ROUTES.investments,
    ROUTES.more,
  ];

  if (next[1] === next[2]) next[2] = next[1] === ROUTES.investments ? ROUTES.debts : ROUTES.investments;
  return next;
}

function load(): [AppRoute, AppRoute, AppRoute, AppRoute] {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as AppRoute[];
    if (Array.isArray(parsed) && parsed.length === 4) {
      const next = normalize(parsed);
      save(next);
      return next;
    }
  } catch {}
  return DEFAULTS;
}

function save(slots: [AppRoute, AppRoute, AppRoute, AppRoute]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
}

/** All pages that can appear in the bottom nav */
export const ALL_NAV_OPTIONS: NavItem[] = NAV_ITEMS.filter(
  (i) => i.href !== ROUTES.more   // More is always available via the drawer
    || true                        // allow all (remove filter if you want)
);

export function useNavConfig() {
  const [slots, setSlots] = useState<[AppRoute, AppRoute, AppRoute, AppRoute]>(DEFAULTS);

  useEffect(() => { setSlots(load()); }, []);

  const updateSlot = useCallback((index: 0 | 1 | 2 | 3, route: AppRoute) => {
    if (index === 0 || index === 3 || route === ROUTES.dashboard || route === ROUTES.more) return;
    setSlots((prev) => {
      const next = normalize(prev);
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

  const leftItems  = [slots[0], slots[1]].map((href) => NAV_ITEMS.find((i) => i.href === href) ?? NAV_ITEMS[0]);
  const rightItems = [slots[2], slots[3]].map((href) => NAV_ITEMS.find((i) => i.href === href) ?? NAV_ITEMS[0]);

  return { slots, leftItems, rightItems, updateSlot, resetSlots };
}
