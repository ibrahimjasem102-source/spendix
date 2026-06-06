export type PlanId = "free" | "plus" | "pro" | "elite";

export interface PlanLimits {
  accounts: number | null;          // null = unlimited
  transactionsPerMonth: number | null;
  goals: number | null;
  budgets: number | null;
  export: boolean;
  ai: boolean;
  advancedAnalytics: boolean;
  investments: boolean;
  household: boolean;
  workTracking: boolean;
  netWorth: boolean;
  tags: boolean;
  recurring: boolean;
  contacts: boolean;
  debts: boolean;
  customDashboards: boolean;
  prioritySupport: boolean;
  betaAccess: boolean;
}

export interface PlanMeta {
  id: PlanId;
  nameKey: string;
  price: number;          // USD/month, 0 = free
  colorClass: string;     // tailwind gradient
  recommended?: boolean;
  limits: PlanLimits;
}

const FREE_LIMITS: PlanLimits = {
  accounts: 1,
  transactionsPerMonth: 30,
  goals: 2,
  budgets: 1,
  export: false,
  ai: false,
  advancedAnalytics: false,
  investments: false,
  household: false,
  workTracking: false,
  netWorth: false,
  tags: false,
  recurring: false,
  contacts: false,
  debts: false,
  customDashboards: false,
  prioritySupport: false,
  betaAccess: false,
};

const PLUS_LIMITS: PlanLimits = {
  accounts: null,
  transactionsPerMonth: null,
  goals: null,
  budgets: null,
  export: true,
  ai: false,
  advancedAnalytics: false,
  investments: false,
  household: false,
  workTracking: false,
  netWorth: false,
  tags: true,
  recurring: true,
  contacts: true,
  debts: true,
  customDashboards: false,
  prioritySupport: false,
  betaAccess: false,
};

const PRO_LIMITS: PlanLimits = {
  ...PLUS_LIMITS,
  ai: true,
  advancedAnalytics: true,
  investments: true,
  netWorth: true,
  prioritySupport: true,
};

const ELITE_LIMITS: PlanLimits = {
  ...PRO_LIMITS,
  household: true,
  workTracking: true,
  customDashboards: true,
  betaAccess: true,
};

export const PLANS: PlanMeta[] = [
  {
    id: "free",
    nameKey: "plans.free",
    price: 0,
    colorClass: "from-slate-500 to-slate-600",
    limits: FREE_LIMITS,
  },
  {
    id: "plus",
    nameKey: "plans.plus",
    price: 5.99,
    colorClass: "from-emerald-500 to-teal-600",
    limits: PLUS_LIMITS,
  },
  {
    id: "pro",
    nameKey: "plans.pro",
    price: 7.99,
    colorClass: "from-blue-500 to-indigo-600",
    recommended: true,
    limits: PRO_LIMITS,
  },
  {
    id: "elite",
    nameKey: "plans.elite",
    price: 9.99,
    colorClass: "from-purple-500 to-violet-600",
    limits: ELITE_LIMITS,
  },
];

export const PLAN_MAP = Object.fromEntries(
  PLANS.map((p) => [p.id, p]),
) as Record<PlanId, PlanMeta>;

export function getPlanLimits(plan: PlanId): PlanLimits {
  return PLAN_MAP[plan]?.limits ?? FREE_LIMITS;
}

// Stripe price IDs — use STRIPE_PLUS_PRICE_ID / STRIPE_PRO_PRICE_ID / STRIPE_ELITE_PRICE_ID
// Old names (STRIPE_PRICE_PLUS etc.) are accepted as fallback during migration.
export const STRIPE_PRICES: Partial<Record<PlanId, string>> = {
  plus:  process.env.STRIPE_PLUS_PRICE_ID  ?? process.env.STRIPE_PRICE_PLUS  ?? "",
  pro:   process.env.STRIPE_PRO_PRICE_ID   ?? process.env.STRIPE_PRICE_PRO   ?? "",
  elite: process.env.STRIPE_ELITE_PRICE_ID ?? process.env.STRIPE_PRICE_ELITE ?? "",
};
