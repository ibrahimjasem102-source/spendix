/**
 * Ledger API — Integration Tests
 * Run with: npx tsx tests/ledger/api.spec.ts
 *
 * Prerequisites: server running at http://localhost:3000 with a seeded test user.
 * Set env vars: TEST_USER_EMAIL, TEST_USER_PASSWORD, TEST_BASE_URL (default: http://localhost:3000)
 *
 * Tests:
 *   1. Add Transaction  → appears in /api/ledger
 *   2. Add Investment   → appears in /api/ledger with module=investment
 *   3. Add Work Payment → appears in /api/ledger with direction=inflow
 *   4. Add Goal Contribution → appears in /api/ledger with module=goal_contribution
 */

import assert from "node:assert/strict";

const BASE     = process.env.TEST_BASE_URL     ?? "http://localhost:3000";
const EMAIL    = process.env.TEST_USER_EMAIL   ?? "";
const PASSWORD = process.env.TEST_USER_PASSWORD ?? "";

if (!EMAIL || !PASSWORD) {
  console.error("Set TEST_USER_EMAIL and TEST_USER_PASSWORD env vars");
  process.exit(1);
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

function post(url: string, token: string, body: unknown) {
  return fetch(`${BASE}${url}`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

async function getLedger(token: string, qs: string) {
  const res = await fetch(`${BASE}/api/ledger?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return json<{
    entries: Array<{ source_id: string; source_module: string; direction: string; entry_type: string }>;
    summary: { inflow: number; outflow: number; net: number };
  }>(res);
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ── Auth ───────────────────────────────────────────────────────────────────

async function authenticate(): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/set-session`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  // If the app doesn't expose this endpoint, fall back to supabase REST auth
  if (res.status === 404 || res.status === 405) {
    throw new Error(
      "Use SUPABASE_URL / SUPABASE_ANON_KEY to call /auth/v1/token directly, " +
      "or expose a sign-in API route in the app for testing."
    );
  }
  const data = await json<{ access_token?: string }>(res);
  if (!data.access_token) throw new Error("No access_token in auth response");
  return data.access_token;
}

// ── Tests ──────────────────────────────────────────────────────────────────

async function testTransactionToLedger(token: string) {
  const createRes = await post("/api/transactions", token, {
    title:            "Ledger test income",
    amount:           99.99,
    type:             "income",
    transaction_date: new Date().toISOString().slice(0, 10),
  });
  const { transaction } = await json<{ transaction: { id: string } }>(createRes);
  assert.ok(transaction?.id, "Transaction must have an id");

  await sleep(600);

  const { entries } = await getLedger(token, "module=transaction&limit=20");
  const found = entries.find(e => e.source_id === transaction.id);

  assert.ok(found, "Transaction must appear in ledger");
  assert.equal(found?.direction, "inflow", "Income transaction → inflow");
  assert.equal(found?.entry_type, "income");

  console.log("✓ Add Transaction → appears in /api/ledger as inflow");
}

async function testInvestmentToLedger(token: string) {
  const createRes = await post("/api/investments", token, {
    asset_name:      "Ledger Test Stock",
    asset_type:      "stock",
    amount_invested: 250,
    investment_date: new Date().toISOString().slice(0, 10),
  });
  const { investment } = await json<{ investment: { id: string } }>(createRes);
  assert.ok(investment?.id, "Investment must have an id");

  await sleep(600);

  const { entries } = await getLedger(token, "module=investment&limit=20");
  const found = entries.find(e => e.source_id === investment.id);

  assert.ok(found, "Investment must appear in ledger");
  assert.equal(found?.direction, "outflow", "Investment → outflow (capital deployed)");
  assert.equal(found?.entry_type, "investment");

  console.log("✓ Add Investment → appears in /api/ledger as outflow");
}

async function testWorkPaymentToLedger(token: string) {
  const createRes = await post("/api/work/payments", token, {
    employer_or_client: "Ledger Test Client",
    amount:             500,
    payment_date:       new Date().toISOString().slice(0, 10),
  });
  const { payment } = await json<{ payment: { id: string } }>(createRes);
  assert.ok(payment?.id, "Work payment must have an id");

  await sleep(600);

  const { entries } = await getLedger(token, "module=work_payment&limit=20");
  const found = entries.find(e => e.source_id === payment.id);

  assert.ok(found, "Work payment must appear in ledger");
  assert.equal(found?.direction, "inflow", "Work payment → inflow (salary received)");
  assert.equal(found?.entry_type, "work_payment");

  console.log("✓ Add Work Payment → appears in /api/ledger as inflow");
}

async function testGoalContributionToLedger(token: string) {
  // Create a manual goal first
  const goalRes = await post("/api/goals", token, {
    title:         "Ledger Test Goal",
    target_amount: 1000,
    tracking_type: "manual",
    category:      "other",
    start_date:    new Date().toISOString().slice(0, 10),
  });
  const { goal } = await json<{ goal: { id: string } }>(goalRes);
  assert.ok(goal?.id, "Goal must have an id");

  const contribRes = await post(`/api/goals/${goal.id}/contribute`, token, { amount: 100 });
  await json<unknown>(contribRes);

  await sleep(800);

  const { entries } = await getLedger(token, "module=goal_contribution&limit=20");
  const found = entries.find(e => e.source_id === goal.id);

  assert.ok(found, "Goal contribution must appear in ledger");
  assert.equal(found?.direction, "outflow", "Goal contribution → outflow (cash allocated)");
  assert.equal(found?.entry_type, "goal_contribution");

  console.log("✓ Add Goal Contribution → appears in /api/ledger as outflow");
}

async function testLedgerSummary(token: string) {
  const { summary } = await getLedger(token, "limit=100");

  assert.equal(typeof summary.inflow,  "number", "summary.inflow must be a number");
  assert.equal(typeof summary.outflow, "number", "summary.outflow must be a number");
  assert.equal(typeof summary.net,     "number", "summary.net must be a number");
  assert.equal(
    Math.round((summary.inflow - summary.outflow) * 100),
    Math.round(summary.net * 100),
    "net must equal inflow - outflow"
  );

  console.log(`✓ /api/ledger summary: inflow=${summary.inflow} outflow=${summary.outflow} net=${summary.net}`);
}

// ── Runner ─────────────────────────────────────────────────────────────────

async function main() {
  console.log("Authenticating...");
  const token = await authenticate();
  console.log("✓ Authenticated\n");

  await testTransactionToLedger(token);
  await testInvestmentToLedger(token);
  await testWorkPaymentToLedger(token);
  await testGoalContributionToLedger(token);
  await testLedgerSummary(token);

  console.log("\n✅ All ledger API integration tests passed");
}

main().catch(err => {
  console.error("\n❌", err.message);
  process.exit(1);
});
