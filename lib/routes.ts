import type { ReactNode } from "react";
import { NAV_FEATURES, getFeaturesByGroup } from "@/features/registry";

// ── Route constants ───────────────────────────────────────────
export const ROUTES = {
  dashboard:     "/dashboard",
  transactions:  "/transactions",
  analytics:     "/analytics",
  ledger:        "/ledger",
  budgets:       "/budgets",
  goals:         "/goals",
  investments:   "/investments",
  debts:         "/debts",
  aiInsights:    "/ai-insights",
  aiAssistant:   "/ai-assistant",
  work:          "/work",
  notifications: "/notifications",
  settings:      "/settings",
  more:          "/more",
  profile:       "/profile",
  hub:           "/hub",
  accounts:      "/accounts",
  subscriptions: "/subscriptions",
  bills:         "/bills",
  calendar:      "/calendar",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

export interface NavItem {
  href:     AppRoute;
  title:    string;    // i18n key
  icon:     ReactNode;
  group:    "primary" | "finance" | "ai" | "system";
}

// ── NAV_ITEMS derived from feature registry ───────────────────
// To add a new section: create features/[name]/config.ts and
// register it in features/registry.ts — no changes needed here.
export const NAV_ITEMS: NavItem[] = NAV_FEATURES.map((f) => ({
  href:  f.route as AppRoute,
  title: f.title,
  icon:  f.icon,
  group: f.group,
}));

// Sidebar excludes "more" — it's a mobile-only hub
export const SIDEBAR_ITEMS = NAV_ITEMS.filter((i) => i.href !== ROUTES.more);

// ── Bottom nav defaults: 2 left | FAB | 2 right ──────────────
const LEFT_HREFS:  AppRoute[] = [ROUTES.dashboard,  ROUTES.transactions];
const RIGHT_HREFS: AppRoute[] = [ROUTES.investments, ROUTES.more];

export const BOTTOM_NAV_LEFT  = NAV_ITEMS.filter((i) => (LEFT_HREFS  as string[]).includes(i.href));
export const BOTTOM_NAV_RIGHT = NAV_ITEMS.filter((i) => (RIGHT_HREFS as string[]).includes(i.href));

export const FAB_MODAL_ROUTES = {
  transaction: "transaction",
  investment:  "investment",
  debt:        "debt",
} as const;

export function isAppRoute(pathname: string): boolean {
  return Object.values(ROUTES).some((r) => pathname === r || pathname.startsWith(r + "/"));
}

export function getNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
}

// ── Group helpers ─────────────────────────────────────────────
export const PRIMARY_NAV = getFeaturesByGroup("primary");
export const FINANCE_NAV = getFeaturesByGroup("finance");
export const AI_NAV      = getFeaturesByGroup("ai");
export const SYSTEM_NAV  = getFeaturesByGroup("system");
