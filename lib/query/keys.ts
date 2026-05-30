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
  accounts: {
    all: ["accounts"] as const,
    list: () => [...queryKeys.accounts.all, "list"] as const,
  },
  subscriptions: {
    all: ["subscriptions"] as const,
    list: () => [...queryKeys.subscriptions.all, "list"] as const,
  },
  bills: {
    all: ["bills"] as const,
    list: () => [...queryKeys.bills.all, "list"] as const,
  },
};
