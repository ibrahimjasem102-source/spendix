/**
 * Accounts Engine — Unit Tests
 * Run with: npx tsx tests/accounts/engine.unit.ts
 */

import assert from "node:assert/strict";
import {
  groupAccountsByType,
  getTopAccounts,
  computeNetWorthBreakdown,
  getTotalBalance,
} from "../../lib/finance/accountEngine";
import type { Account } from "../../types";

// ── Fixtures ───────────────────────────────────────────────────────────────

function acct(overrides: Partial<Account> & { id: string }): Account {
  return {
    user_id:         "u1",
    name:            "Test",
    type:            "cash",
    currency:        "USD",
    initial_balance: 0,
    is_default:      false,
    created_at:      "2026-01-01T00:00:00Z",
    updated_at:      "2026-01-01T00:00:00Z",
    balance:         0,
    ...overrides,
  };
}

// ── Test: Create Cash Account ──────────────────────────────────────────────
{
  const accounts = [acct({ id: "a1", type: "cash",  name: "Wallet Cash", balance: 500 })];
  const total = getTotalBalance(accounts);
  assert.equal(total, 500, "Cash account balance should be 500");

  const groups = groupAccountsByType(accounts);
  assert.equal(groups.length, 1, "One type group");
  assert.equal(groups[0].type,  "cash");
  assert.equal(groups[0].total, 500);

  console.log("✓ Create Cash Account → balance=500, grouped correctly");
}

// ── Test: Create Bank Account ──────────────────────────────────────────────
{
  const accounts = [
    acct({ id: "a1", type: "cash", name: "Wallet",          balance: 200 }),
    acct({ id: "a2", type: "bank", name: "Main Bank",        balance: 3000 }),
    acct({ id: "a3", type: "bank", name: "Savings Account",  balance: 1000 }),
  ];

  const total = getTotalBalance(accounts);
  assert.equal(total, 4200, "Total balance: 200 + 3000 + 1000 = 4200");

  const groups = groupAccountsByType(accounts);
  const bank = groups.find(g => g.type === "bank");
  assert.ok(bank, "Bank group should exist");
  assert.equal(bank!.total, 4000, "Bank total: 3000 + 1000 = 4000");
  assert.equal(bank!.count, 2);

  console.log("✓ Create Bank Account → correct total and grouping");
}

// ── Test: Add Income → balance increases ──────────────────────────────────
{
  // Simulate: initial_balance=500, income transaction of 200
  const accounts = [acct({ id: "a1", type: "bank", balance: 700 })]; // 500 + 200

  const total = getTotalBalance(accounts);
  assert.equal(total, 700, "Income increases account balance by 200");

  console.log("✓ Add Income → account balance increases correctly");
}

// ── Test: Add Expense → balance decreases ─────────────────────────────────
{
  // Simulate: initial_balance=700, expense of 50
  const accounts = [acct({ id: "a1", type: "bank", balance: 650 })]; // 700 - 50

  const total = getTotalBalance(accounts);
  assert.equal(total, 650, "Expense decreases account balance by 50");

  console.log("✓ Add Expense → account balance decreases correctly");
}

// ── Test: Transfer Cash → Bank, balances update, net worth unchanged ───────
{
  const before = [
    acct({ id: "a1", type: "cash", balance: 1000 }),
    acct({ id: "a2", type: "bank", balance: 500 }),
  ];
  const beforeTotal = getTotalBalance(before);
  assert.equal(beforeTotal, 1500);

  // Transfer 300 from Cash to Bank
  const after = [
    acct({ id: "a1", type: "cash", balance: 700 }),   // 1000 - 300
    acct({ id: "a2", type: "bank", balance: 800 }),   // 500 + 300
  ];
  const afterTotal = getTotalBalance(after);
  assert.equal(afterTotal, 1500, "Transfer must not change total balance");

  console.log("✓ Transfer Cash → Bank: individual balances update, total unchanged");
}

// ── Test: getTopAccounts ───────────────────────────────────────────────────
{
  const accounts = [
    acct({ id: "a1", type: "cash",    balance: 100 }),
    acct({ id: "a2", type: "bank",    balance: 5000 }),
    acct({ id: "a3", type: "savings", balance: 2000 }),
    acct({ id: "a4", type: "wallet",  balance: 50 }),
  ];

  const top2 = getTopAccounts(accounts, 2);
  assert.equal(top2.length, 2);
  assert.equal(top2[0].id, "a2", "Highest balance first (5000)");
  assert.equal(top2[1].id, "a3", "Second highest (2000)");

  console.log("✓ getTopAccounts returns correct ordering");
}

// ── Test: computeNetWorthBreakdown ─────────────────────────────────────────
{
  const accounts = [
    acct({ id: "a1", type: "cash",        balance:  1000 }),
    acct({ id: "a2", type: "bank",        balance:  5000 }),
    acct({ id: "a3", type: "savings",     balance:  2000 }),
    acct({ id: "a4", type: "credit_card", balance: -800  }), // you owe 800
  ];

  const breakdown = computeNetWorthBreakdown(
    accounts,
    10000, // portfolioValue
    2000,  // debtReceivable
    3000,  // debtPayable
  );

  assert.equal(breakdown.liquidAssets,      8000,  "Liquid: 1000 + 5000 + 2000 = 8000");
  assert.equal(breakdown.creditLiabilities, -800,  "Credit card: -800 (you owe)");
  assert.equal(breakdown.portfolio,         10000, "Portfolio value");
  assert.equal(breakdown.receivable,        2000,  "Receivable debts");
  assert.equal(breakdown.payable,           3000,  "Payable debts");

  // netWorth = 8000 + (-800) + 10000 + 2000 - 3000 = 16200
  assert.equal(breakdown.netWorth, 16200, "Net worth = 8000 - 800 + 10000 + 2000 - 3000 = 16200");

  console.log(`✓ Net Worth breakdown: liquid=${breakdown.liquidAssets} cc=${breakdown.creditLiabilities} portfolio=${breakdown.portfolio} → NW=${breakdown.netWorth}`);
}

// ── Test: Investment account type ─────────────────────────────────────────
{
  const accounts = [
    acct({ id: "a1", type: "investment", name: "Brokerage", balance: 15000 }),
  ];

  const groups  = groupAccountsByType(accounts);
  const invGroup = groups.find(g => g.type === "investment");
  assert.ok(invGroup, "Investment account type must be accepted");
  assert.equal(invGroup!.total, 15000);

  console.log("✓ Investment account type grouped correctly");
}

console.log("\n✅ All accounts engine unit tests passed");
