// Pure functions for account-level calculations.
// No React, no side effects.

import type { Account, AccountType } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────

export interface AccountSummary {
  type: AccountType;
  label: string;
  total: number;
  count: number;
  accounts: Account[];
}

export interface NetWorthBreakdown {
  /** Cash + Bank + Savings + Wallet + Investment account balances */
  liquidAssets: number;
  /** Credit card balances (negative = you owe, positive = overpaid) */
  creditLiabilities: number;
  /** From investments table: sum of current_value */
  portfolio: number;
  /** Remaining balance on loans you made */
  receivable: number;
  /** Remaining balance on debts you owe */
  payable: number;
  /** liquidAssets + portfolio + receivable - payable + creditLiabilities */
  netWorth: number;
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash:        "Cash",
  bank:        "Bank",
  credit_card: "Credit Card",
  wallet:      "Wallet",
  savings:     "Savings",
  investment:  "Investment Account",
};

// ── Functions ─────────────────────────────────────────────────────────────

/** Group accounts by type with per-type totals */
export function groupAccountsByType(accounts: Account[]): AccountSummary[] {
  const map = new Map<AccountType, AccountSummary>();

  for (const a of accounts) {
    const t = a.type;
    if (!map.has(t)) {
      map.set(t, {
        type:     t,
        label:    ACCOUNT_TYPE_LABELS[t] ?? t,
        total:    0,
        count:    0,
        accounts: [],
      });
    }
    const s = map.get(t)!;
    s.total    += Number(a.balance) || 0;
    s.count    += 1;
    s.accounts.push(a);
  }

  // Sort: cash → bank → savings → wallet → investment → credit_card
  const ORDER: AccountType[] = ["cash", "bank", "savings", "wallet", "investment", "credit_card"];
  return [...map.values()].sort(
    (a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type),
  );
}

/** Return top N accounts by absolute balance value */
export function getTopAccounts(accounts: Account[], limit = 5): Account[] {
  return [...accounts]
    .sort((a, b) => Math.abs(Number(b.balance) || 0) - Math.abs(Number(a.balance) || 0))
    .slice(0, limit);
}

/** Full net-worth breakdown using the account-based formula */
export function computeNetWorthBreakdown(
  accounts: Account[],
  portfolioValue: number,
  debtReceivable: number,
  debtPayable: number,
): NetWorthBreakdown {
  let liquidAssets      = 0;
  let creditLiabilities = 0;

  for (const a of accounts) {
    const bal = Number(a.balance) || 0;
    if (a.type === "credit_card") {
      creditLiabilities += bal;  // typically negative when you owe
    } else {
      liquidAssets += bal;
    }
  }

  return {
    liquidAssets,
    creditLiabilities,
    portfolio:   portfolioValue,
    receivable:  debtReceivable,
    payable:     debtPayable,
    netWorth:    liquidAssets + creditLiabilities + portfolioValue + debtReceivable - debtPayable,
  };
}

/** Total balance across all accounts (same as accountsTotal in the engine) */
export function getTotalBalance(accounts: Account[]): number {
  return accounts.reduce((s, a) => s + (Number(a.balance) || 0), 0);
}
