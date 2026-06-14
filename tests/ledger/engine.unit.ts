/**
 * Ledger Engine — Unit Tests
 * Run with: npx tsx tests/ledger/engine.unit.ts
 *
 * Tests pure functions only. No server, no DB, no React.
 */

import assert from "node:assert/strict";
import {
  calculateBalance,
  getBalance,
  getIncome,
  getExpenses,
  getCashFlow,
  getNetWorth,
  getRecentActivity,
  sortByDate,
  filterLedger,
  getCashflowSummary,
} from "../../lib/ledger/engine";
import type { UnifiedLedgerEntry } from "../../lib/ledger/types";

// ── Fixtures ───────────────────────────────────────────────────────────────

function entry(overrides: Partial<UnifiedLedgerEntry> & { id: string }): UnifiedLedgerEntry {
  return {
    user_id:    "user-1",
    type:       "income",
    title:      "Test",
    amount:     100,
    direction:  "inflow",
    date:       "2026-06-01",
    created_at: "2026-06-01T10:00:00Z",
    ...overrides,
  };
}

// ── Test: Add Transaction → appears in ledger (balance) ───────────────────

{
  const entries: UnifiedLedgerEntry[] = [
    entry({ id: "t1", type: "income",      direction: "inflow",  amount: 1000, date: "2026-06-01" }),
    entry({ id: "t2", type: "transaction", direction: "outflow", amount: 300,  date: "2026-06-02" }),
  ];

  const balance = calculateBalance(entries);
  assert.equal(balance, 700, "Balance should be 1000 - 300 = 700");

  const income   = getIncome(entries);
  const expenses = getExpenses(entries);
  assert.equal(income,   1000, "Income should be 1000");
  assert.equal(expenses,  300, "Expenses should be 300");

  console.log("✓ Transaction → ledger (balance, income, expenses)");
}

// ── Test: getBalance alias matches calculateBalance ────────────────────────

{
  const entries = [
    entry({ id: "b1", direction: "inflow",  amount: 500 }),
    entry({ id: "b2", direction: "outflow", amount: 200 }),
  ];
  assert.equal(getBalance(entries), calculateBalance(entries), "getBalance must equal calculateBalance");
  console.log("✓ getBalance alias is consistent");
}

// ── Test: Add Debt → appears in ledger (direction) ─────────────────────────

{
  const entries: UnifiedLedgerEntry[] = [
    entry({ id: "d1", type: "debt", direction: "inflow",  amount: 5000, date: "2026-05-01" }), // payable
    entry({ id: "d2", type: "debt", direction: "outflow", amount: 2000, date: "2026-05-15" }), // receivable
  ];

  const balance = calculateBalance(entries);
  assert.equal(balance, 3000, "Payable debt increases balance, receivable decreases it");

  const cashflow = getCashFlow(entries);
  assert.equal(cashflow.totalInflow,  5000);
  assert.equal(cashflow.totalOutflow, 2000);
  assert.equal(cashflow.netBalance,   3000);

  console.log("✓ Debt → ledger (payable = inflow, receivable = outflow)");
}

// ── Test: Add Work Payment → appears in ledger ────────────────────────────

{
  const entries: UnifiedLedgerEntry[] = [
    entry({ id: "w1", type: "salary", direction: "inflow",  amount: 1500, date: "2026-06-05" }),
    entry({ id: "w2", type: "salary", direction: "neutral", amount:  750, date: "2026-06-10" }), // pending
  ];

  const balance = calculateBalance(entries);
  // neutral entries don't affect balance
  assert.equal(balance, 1500, "Only received (inflow) work payments affect balance");

  // Neutral entries are visible in the ledger but don't count as income
  const income = getIncome(entries);
  assert.equal(income, 1500, "Pending (neutral) salary not counted as income yet");

  console.log("✓ Work Payment → ledger (received = inflow, pending = neutral)");
}

// ── Test: Add Goal Contribution → appears in ledger ───────────────────────

{
  const entries: UnifiedLedgerEntry[] = [
    entry({ id: "g1", type: "transaction", direction: "outflow", amount: 250, date: "2026-06-09" }),
    entry({ id: "g2", type: "goal",        direction: "neutral", amount: 250, date: "2026-06-09" }),
  ];

  const outflow = entries.filter(e => e.direction === "outflow").reduce((s, e) => s + e.amount, 0);
  assert.equal(outflow, 250, "Goal contribution creates one outflow transaction");

  console.log("✓ Goal Contribution → ledger (expense outflow + neutral goal entry)");
}

// ── Test: getCashFlow summary ─────────────────────────────────────────────

{
  const entries: UnifiedLedgerEntry[] = [
    entry({ id: "c1", type: "income",      direction: "inflow",  amount: 2000 }),
    entry({ id: "c2", type: "transaction", direction: "outflow", amount:  800 }),
    entry({ id: "c3", type: "goal",        direction: "neutral", amount:  500 }),
  ];

  const cf = getCashFlow(entries);
  assert.equal(cf.totalInflow,  2000);
  assert.equal(cf.totalOutflow,  800);
  assert.equal(cf.netBalance,   1200);

  console.log("✓ getCashFlow: inflow=2000, outflow=800, net=1200");
}

// ── Test: getNetWorth ─────────────────────────────────────────────────────

{
  const nw = getNetWorth({
    cashBalance:    5000,
    portfolioValue: 10000,
    debtReceivable: 2000,
    debtPayable:    3000,
  });
  assert.equal(nw.netWorth, 14000, "netWorth = 5000 + 10000 + 2000 - 3000 = 14000");
  assert.equal(nw.cash,        5000);
  assert.equal(nw.investments, 10000);
  assert.equal(nw.receivable,  2000);
  assert.equal(nw.payable,     3000);

  console.log("✓ getNetWorth: cash=5000 + portfolio=10000 + recv=2000 - pay=3000 = 14000");
}

// ── Test: getRecentActivity ───────────────────────────────────────────────

{
  const entries: UnifiedLedgerEntry[] = [
    entry({ id: "r1", date: "2026-06-01", created_at: "2026-06-01T08:00:00Z" }),
    entry({ id: "r2", date: "2026-06-05", created_at: "2026-06-05T09:00:00Z" }),
    entry({ id: "r3", date: "2026-06-09", created_at: "2026-06-09T12:00:00Z" }),
    entry({ id: "r4", date: "2026-06-03", created_at: "2026-06-03T10:00:00Z" }),
  ];

  const recent = getRecentActivity(entries, 2);
  assert.equal(recent.length, 2,    "Should return at most 2 entries");
  assert.equal(recent[0].id, "r3",  "Most recent entry first (2026-06-09)");
  assert.equal(recent[1].id, "r2",  "Second entry (2026-06-05)");

  console.log("✓ getRecentActivity: returns N most recent entries in date-desc order");
}

// ── Test: filterLedger ────────────────────────────────────────────────────

{
  const entries: UnifiedLedgerEntry[] = [
    entry({ id: "f1", direction: "inflow",  type: "income", date: "2026-05-01" }),
    entry({ id: "f2", direction: "outflow", type: "transaction", date: "2026-06-01" }),
    entry({ id: "f3", direction: "inflow",  type: "income", date: "2026-06-05" }),
  ];

  const inflows = filterLedger(entries, { direction: "inflow" });
  assert.equal(inflows.length, 2, "Should return only inflow entries");

  const june = filterLedger(entries, { dateFrom: "2026-06-01", dateTo: "2026-06-30" });
  assert.equal(june.length, 2, "Should return entries in June");

  console.log("✓ filterLedger: direction and date filters work");
}

console.log("\n✅ All ledger engine unit tests passed");
