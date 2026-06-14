/**
 * Accounts API — Integration Tests
 * Run with: TEST_USER_EMAIL=x TEST_USER_PASSWORD=y npx tsx tests/accounts/api.spec.ts
 */

import assert from "node:assert/strict";

const BASE     = process.env.TEST_BASE_URL      ?? "http://localhost:3000";
const EMAIL    = process.env.TEST_USER_EMAIL    ?? "";
const PASSWORD = process.env.TEST_USER_PASSWORD ?? "";

if (!EMAIL || !PASSWORD) {
  console.error("Set TEST_USER_EMAIL and TEST_USER_PASSWORD env vars");
  process.exit(1);
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
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

function put(url: string, token: string, body: unknown) {
  return fetch(`${BASE}${url}`, {
    method:  "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

async function getAccounts(token: string) {
  const res = await fetch(`${BASE}/api/accounts`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await json<{ accounts: Array<{ id: string; name: string; type: string; balance: number; is_default: boolean }> }>(res);
  return data.accounts;
}

async function createAccount(token: string, body: Record<string, unknown>) {
  const res = await post("/api/accounts", token, body);
  const data = await json<{ account: { id: string; name: string; type: string } }>(res);
  return data.account;
}

async function authenticate(): Promise<string> {
  // Try the Supabase auth REST endpoint via server action
  const res = await fetch(`${BASE}/api/auth/token`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (res.status === 404) throw new Error("Expose an auth token endpoint or set SUPABASE credentials");
  const data = await json<{ access_token?: string }>(res);
  if (!data.access_token) throw new Error("No access_token returned");
  return data.access_token;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ── Tests ──────────────────────────────────────────────────────────────────

async function testCreateCashAccount(token: string): Promise<string> {
  const account = await createAccount(token, {
    name:            "Test Cash Wallet",
    type:            "cash",
    currency:        "USD",
    initial_balance: 0,
    is_default:      false,
  });

  assert.ok(account.id,        "Account must have id");
  assert.equal(account.type,   "cash");
  assert.equal(account.name,   "Test Cash Wallet");

  console.log(`✓ Create Cash Account: id=${account.id}`);
  return account.id;
}

async function testCreateBankAccount(token: string): Promise<string> {
  const account = await createAccount(token, {
    name:            "Test Bank Account",
    type:            "bank",
    currency:        "USD",
    initial_balance: 1000,
    is_default:      false,
  });

  assert.ok(account.id,      "Bank account must have id");
  assert.equal(account.type, "bank");

  // Verify it shows up with balance = initial_balance (no transactions yet)
  const accounts = await getAccounts(token);
  const found = accounts.find(a => a.id === account.id);
  assert.ok(found, "Account must appear in list");
  assert.equal(found!.balance, 1000, "Balance must equal initial_balance when no transactions");

  console.log(`✓ Create Bank Account: id=${account.id} balance=${found?.balance}`);
  return account.id;
}

async function testAddIncome(token: string, accountId: string): Promise<number> {
  // Get balance before
  const before = await getAccounts(token);
  const acctBefore = before.find(a => a.id === accountId)!;

  await post("/api/transactions", token, {
    title:            "Test salary",
    amount:           500,
    type:             "income",
    account_id:       accountId,
    transaction_date: new Date().toISOString().slice(0, 10),
  });

  await sleep(200);

  const after = await getAccounts(token);
  const acctAfter = after.find(a => a.id === accountId)!;

  const delta = acctAfter.balance - acctBefore.balance;
  assert.equal(delta, 500, `Income must increase balance by 500 (was ${acctBefore.balance}, now ${acctAfter.balance})`);

  console.log(`✓ Add Income: balance ${acctBefore.balance} → ${acctAfter.balance} (+500)`);
  return acctAfter.balance;
}

async function testAddExpense(token: string, accountId: string, balanceBefore: number) {
  await post("/api/transactions", token, {
    title:            "Test expense",
    amount:           200,
    type:             "expense",
    account_id:       accountId,
    transaction_date: new Date().toISOString().slice(0, 10),
  });

  await sleep(200);

  const accounts = await getAccounts(token);
  const acct = accounts.find(a => a.id === accountId)!;
  const expected = balanceBefore - 200;

  assert.equal(
    Math.round(acct.balance * 100),
    Math.round(expected * 100),
    `Expense must decrease balance by 200 (expected ${expected}, got ${acct.balance})`
  );

  console.log(`✓ Add Expense: balance ${balanceBefore} → ${acct.balance} (-200)`);
}

async function testTransfer(token: string, fromId: string, toId: string) {
  const before = await getAccounts(token);
  const fromBefore = before.find(a => a.id === fromId)!;
  const toBefore   = before.find(a => a.id === toId)!;
  const totalBefore = fromBefore.balance + toBefore.balance;

  const res = await post("/api/accounts/transfer", token, {
    from_account_id: fromId,
    to_account_id:   toId,
    amount:          100,
    date:            new Date().toISOString().slice(0, 10),
    notes:           "Test transfer",
  });
  const { ok } = await json<{ ok: boolean }>(res);
  assert.ok(ok, "Transfer must return ok:true");

  await sleep(200);

  const after = await getAccounts(token);
  const fromAfter = after.find(a => a.id === fromId)!;
  const toAfter   = after.find(a => a.id === toId)!;
  const totalAfter = fromAfter.balance + toAfter.balance;

  assert.equal(
    Math.round(fromAfter.balance * 100),
    Math.round((fromBefore.balance - 100) * 100),
    `Source account must decrease by 100 (was ${fromBefore.balance}, now ${fromAfter.balance})`
  );
  assert.equal(
    Math.round(toAfter.balance * 100),
    Math.round((toBefore.balance + 100) * 100),
    `Destination account must increase by 100 (was ${toBefore.balance}, now ${toAfter.balance})`
  );
  assert.equal(
    Math.round(totalAfter * 100),
    Math.round(totalBefore * 100),
    "Total balance across both accounts must not change after transfer"
  );

  console.log(`✓ Transfer: from ${fromBefore.balance}→${fromAfter.balance}, to ${toBefore.balance}→${toAfter.balance}, total unchanged (${totalBefore})`);
}

// ── Runner ─────────────────────────────────────────────────────────────────

async function main() {
  console.log("Authenticating...");
  const token = await authenticate();
  console.log("✓ Authenticated\n");

  const cashId = await testCreateCashAccount(token);
  const bankId = await testCreateBankAccount(token);

  // Add income to bank, verify balance increases
  const balanceAfterIncome = await testAddIncome(token, bankId);

  // Add expense to bank, verify balance decreases
  await testAddExpense(token, bankId, balanceAfterIncome);

  // Transfer from bank to cash, verify individual balances and total unchanged
  await testTransfer(token, bankId, cashId);

  console.log("\n✅ All accounts API integration tests passed");
}

main().catch(err => {
  console.error("\n❌", err.message);
  process.exit(1);
});
