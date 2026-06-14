export const queryKeys = {
  transactions: {
    all: ["transactions"] as const,
    list: () => [...queryKeys.transactions.all, "list"] as const,
  },
  dashboard: {
    all: ["dashboard"] as const,
    summary: () => [...queryKeys.dashboard.all, "summary"] as const,
  },
  budgets: {
    all: ["budgets"] as const,
    list: (month: number, year: number) => [...queryKeys.budgets.all, "list", month, year] as const,
  },
  analytics: {
    all: ["analytics"] as const,
    charts: () => [...queryKeys.analytics.all, "charts"] as const,
    debts: () => [...queryKeys.analytics.all, "debts"] as const,
    investments: () => [...queryKeys.analytics.all, "investments"] as const,
    work: () => [...queryKeys.analytics.all, "work"] as const,
    bundle: () => [...queryKeys.analytics.all, "bundle"] as const,
  },
  debts: {
    all: ["debts"] as const,
    list: () => [...queryKeys.debts.all, "list"] as const,
  },
  investments: {
    all: ["investments"] as const,
    list: () => [...queryKeys.investments.all, "list"] as const,
    portfolioHistory: () => [...queryKeys.investments.all, "portfolio-history"] as const,
  },
  work: {
    all: ["work"] as const,
    sessions: () => [...queryKeys.work.all, "sessions"] as const,
    payments: () => [...queryKeys.work.all, "payments"] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    list: () => [...queryKeys.notifications.all, "list"] as const,
  },
  contacts: {
    all: ["contacts"] as const,
    list: () => [...queryKeys.contacts.all, "list"] as const,
  },
  categories: {
    all: ["categories"] as const,
    list: () => [...queryKeys.categories.all, "list"] as const,
  },
  accounts: {
    all: ["accounts"] as const,
    list: () => [...queryKeys.accounts.all, "list"] as const,
  },
  subscriptions: {
    all: ["subscriptions"] as const,
    list: () => [...queryKeys.subscriptions.all, "list"] as const,
  },
  calendar: {
    all: ["calendar"] as const,
    byMonth: (year: number, month: number) => [...queryKeys.calendar.all, year, month] as const,
  },
  goals: {
    all:  ["goals"] as const,
    list: () => [...queryKeys.goals.all, "list"] as const,
  },
  tags: {
    all:  ["tags"] as const,
    list: () => [...queryKeys.tags.all, "list"] as const,
  },
  household: {
    all:     ["household"] as const,
    detail:  () => [...queryKeys.household.all, "detail"] as const,
    members: () => [...queryKeys.household.all, "members"] as const,
    summary: () => [...queryKeys.household.all, "summary"] as const,
    pending: () => [...queryKeys.household.all, "pending"] as const,
  },
  ledger: {
    all:  ["ledger"] as const,
    list: (params?: Record<string, string>) => [...(["ledger", "list"] as const), params ?? {}] as const,
  },
  family: {
    all:  ["family"] as const,
    list: () => [...(["family", "list"] as const)] as const,
  },
  contactSummary: {
    all:    ["contactSummary"] as const,
    detail: (id: string) => [...(["contactSummary", "detail"] as const), id] as const,
  },
};
