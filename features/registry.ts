import type { ReactNode } from "react";

// ── Contract every feature module must satisfy ────────────────
export interface FeatureModule {
  id:           string;
  title:        string;        // i18n key or display name
  icon:         ReactNode;
  route:        string;
  showInNav:    boolean;
  permissions?: string[];
  group:        "primary" | "finance" | "ai" | "system";
  tone:         import("@/lib/design/tokens").Tone;
  enabled?:     boolean;
}

import { dashboard }           from "./dashboard/config";
import { transactions }        from "./transactions/config";
import { analytics }           from "./analytics/config";
import { accounts }            from "./accounts/config";
import { budgets }             from "./budgets/config";
import { goals }               from "./goals/config";
import { investments }         from "./investments/config";
import { debts }               from "./debts/config";
import { work }                from "./work/config";
import { aiInsights }          from "./ai-insights/config";
import { aiAssistant }         from "./ai-assistant/config";
import { plans }               from "./plans/config";
import { notifications }       from "./notifications/config";
import { settings }            from "./settings/config";
import { more }                from "./more/config";
// More-page-only (showInNav: false)
import { subscriptions }       from "./subscriptions/config";
import { calendar }            from "./calendar/config";
import { netWorth }            from "./net-worth/config";
import { contacts }            from "./contacts/config";
import { tags }                from "./tags/config";
import { household }           from "./household/config";
import { recurringTransactions } from "./recurring/config";
import { exportData }          from "./export/config";
import { ledger }              from "./ledger/config";
import { profile }             from "./profile/config";

export const FEATURE_REGISTRY: FeatureModule[] = [
  // ── Primary (always visible) ──────────────────────────────
  dashboard,
  transactions,
  analytics,

  // ── Finance (core money features) ────────────────────────
  accounts,
  budgets,
  goals,
  investments,
  debts,
  work,

  // ── AI ───────────────────────────────────────────────────
  aiInsights,
  aiAssistant,

  // ── System ───────────────────────────────────────────────
  plans,
  notifications,
  settings,
  more,

  // ── More-page features (showInNav: false) ────────────────
  subscriptions,
  calendar,
  netWorth,
  contacts,
  tags,
  household,
  recurringTransactions,
  exportData,
  ledger,
  profile,
];

export const ACTIVE_FEATURES = FEATURE_REGISTRY.filter(f => f.enabled !== false);
export const NAV_FEATURES    = ACTIVE_FEATURES.filter(f => f.showInNav);

export function getFeatureByRoute(pathname: string): FeatureModule | undefined {
  return ACTIVE_FEATURES.find(f => pathname === f.route || pathname.startsWith(f.route + "/"));
}

export function getFeaturesByGroup(group: FeatureModule["group"]): FeatureModule[] {
  return NAV_FEATURES.filter(f => f.group === group);
}
