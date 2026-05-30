import type { ReactNode } from "react";

// ── Contract every feature module must satisfy ────────────────
export interface FeatureModule {
  id:           string;
  title:        string;        // i18n key (e.g. "nav.dashboard") or display name
  icon:         ReactNode;
  route:        string;
  showInNav:    boolean;
  permissions?: string[];      // future access-control gates
  // Internal fields (not in the base interface, kept for app wiring)
  group:        "primary" | "finance" | "ai" | "system";
  tone:         import("@/lib/design/tokens").Tone;
  enabled?:     boolean;       // feature flag
}

// ── Register features here — add a new section by appending ──
import { dashboard }     from "./dashboard/config";
import { transactions }  from "./transactions/config";
import { analytics }     from "./analytics/config";
import { budgets }       from "./budgets/config";
import { investments }   from "./investments/config";
import { debts }         from "./debts/config";
import { work }          from "./work/config";
import { aiInsights }    from "./ai-insights/config";
import { aiAssistant }   from "./ai-assistant/config";
import { notifications } from "./notifications/config";
import { settings }      from "./settings/config";
import { ledger }        from "./ledger/config";
import { more }          from "./more/config";
import { goals }         from "./goals/config";
import { hub }           from "./hub/config";
import { profile }       from "./profile/config";
import { accounts }      from "./accounts/config";
import { subscriptions } from "./subscriptions/config";

export const FEATURE_REGISTRY: FeatureModule[] = [
  // ── Primary ──────────────────────────────────────────────
  dashboard,
  transactions,
  analytics,
  hub,

  // ── Finance ──────────────────────────────────────────────
  accounts,
  subscriptions,
  investments,
  debts,
  work,
  budgets,
  goals,

  // ── AI ───────────────────────────────────────────────────
  aiInsights,
  aiAssistant,

  // ── System ───────────────────────────────────────────────
  notifications,
  settings,
  more,

  // ── Legacy / not in nav ───────────────────────────────────
  ledger,
  profile,
];

// Active (not disabled)
export const ACTIVE_FEATURES = FEATURE_REGISTRY.filter(
  (f) => f.enabled !== false,
);

// Active and visible in nav
export const NAV_FEATURES = ACTIVE_FEATURES.filter((f) => f.showInNav);

// ── Lookup helpers ────────────────────────────────────────────
export function getFeatureByRoute(pathname: string): FeatureModule | undefined {
  return ACTIVE_FEATURES.find(
    (f) => pathname === f.route || pathname.startsWith(f.route + "/"),
  );
}

export function getFeaturesByGroup(
  group: FeatureModule["group"],
): FeatureModule[] {
  return NAV_FEATURES.filter((f) => f.group === group);
}
