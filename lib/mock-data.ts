import { Transaction } from "@/types";

// ── Transactions ──────────────────────────────────────────────
export const mockTransactions: Transaction[] = [
  { id: "1",  user_id: "mock", category_id: "cat-salary",  title: "Monthly Salary",       type: "income",  amount: 4500,  transaction_date: "2025-05-15", created_at: "", updated_at: "", category: { id: "cat-salary",  name: "Salary",        color: "#10B981", icon: null } },
  { id: "2",  user_id: "mock", category_id: "cat-food",    title: "Lidl Grocery Run",     type: "expense", amount: 87.50, transaction_date: "2025-05-17", created_at: "", updated_at: "", category: { id: "cat-food",    name: "Food",          color: "#ef4444", icon: null } },
  { id: "3",  user_id: "mock", category_id: "cat-ent",     title: "Netflix",              type: "expense", amount: 15.99, transaction_date: "2025-05-16", created_at: "", updated_at: "", category: { id: "cat-ent",     name: "Entertainment", color: "#8B5CF6", icon: null } },
  { id: "4",  user_id: "mock", category_id: "cat-trans",   title: "Monthly Train Pass",   type: "expense", amount: 55.00, transaction_date: "2025-05-14", created_at: "", updated_at: "", category: { id: "cat-trans",   name: "Transport",     color: "#3b82f6", icon: null } },
  { id: "5",  user_id: "mock", category_id: "cat-bills",   title: "Electricity Bill",     type: "expense", amount: 125.00,transaction_date: "2025-05-13", created_at: "", updated_at: "", category: { id: "cat-bills",   name: "Bills",         color: "#f97316", icon: null } },
  { id: "6",  user_id: "mock", category_id: "cat-food",    title: "Dinner — La Piazza",   type: "expense", amount: 45.80, transaction_date: "2025-05-12", created_at: "", updated_at: "", category: { id: "cat-food",    name: "Food",          color: "#ef4444", icon: null } },
  { id: "7",  user_id: "mock", category_id: "cat-ent",     title: "Spotify Premium",      type: "expense", amount: 9.99,  transaction_date: "2025-05-11", created_at: "", updated_at: "", category: { id: "cat-ent",     name: "Entertainment", color: "#8B5CF6", icon: null } },
  { id: "8",  user_id: "mock", category_id: "cat-shop",    title: "Amazon — Headphones",  type: "expense", amount: 67.30, transaction_date: "2025-05-10", created_at: "", updated_at: "", category: { id: "cat-shop",    name: "Shopping",      color: "#ec4899", icon: null } },
  { id: "9",  user_id: "mock", category_id: "cat-health",  title: "Dentist",              type: "expense", amount: 120.00,transaction_date: "2025-05-09", created_at: "", updated_at: "", category: { id: "cat-health",  name: "Health",        color: "#22c55e", icon: null } },
  { id: "10", user_id: "mock", category_id: "cat-salary",  title: "Freelance Project",    type: "income",  amount: 800,   transaction_date: "2025-05-08", created_at: "", updated_at: "", category: { id: "cat-salary",  name: "Salary",        color: "#10B981", icon: null } },
  { id: "11", user_id: "mock", category_id: "cat-trans",   title: "Uber — Airport",       type: "expense", amount: 28.50, transaction_date: "2025-05-07", created_at: "", updated_at: "", category: { id: "cat-trans",   name: "Transport",     color: "#3b82f6", icon: null } },
  { id: "12", user_id: "mock", category_id: "cat-food",    title: "Coffee — Costa",       type: "expense", amount: 4.80,  transaction_date: "2025-05-06", created_at: "", updated_at: "", category: { id: "cat-food",    name: "Food",          color: "#ef4444", icon: null } },
  { id: "13", user_id: "mock", category_id: "cat-bills",   title: "Internet — Vodafone",  type: "expense", amount: 39.99, transaction_date: "2025-05-05", created_at: "", updated_at: "", category: { id: "cat-bills",   name: "Bills",         color: "#f97316", icon: null } },
  { id: "14", user_id: "mock", category_id: "cat-shop",    title: "Zara",                 type: "expense", amount: 94.00, transaction_date: "2025-05-04", created_at: "", updated_at: "", category: { id: "cat-shop",    name: "Shopping",      color: "#ec4899", icon: null } },
  { id: "15", user_id: "mock", category_id: "cat-ent",     title: "Amazon Prime",         type: "expense", amount: 8.99,  transaction_date: "2025-05-03", created_at: "", updated_at: "", category: { id: "cat-ent",     name: "Entertainment", color: "#8B5CF6", icon: null } },
  { id: "16", user_id: "mock", category_id: "cat-health",  title: "Pharmacy",             type: "expense", amount: 22.50, transaction_date: "2025-05-02", created_at: "", updated_at: "", category: { id: "cat-health",  name: "Health",        color: "#22c55e", icon: null } },
  { id: "17", user_id: "mock", category_id: "cat-bills",   title: "Insurance — Allianz",  type: "expense", amount: 89.00, transaction_date: "2025-05-01", created_at: "", updated_at: "", category: { id: "cat-bills",   name: "Bills",         color: "#f97316", icon: null } },
  { id: "18", user_id: "mock", category_id: "cat-food",    title: "Spar — Weekly Shop",   type: "expense", amount: 72.40, transaction_date: "2025-04-28", created_at: "", updated_at: "", category: { id: "cat-food",    name: "Food",          color: "#ef4444", icon: null } },
  { id: "19", user_id: "mock", category_id: "cat-salary",  title: "Dividends",            type: "income",  amount: 150,   transaction_date: "2025-04-25", created_at: "", updated_at: "", category: { id: "cat-salary",  name: "Salary",        color: "#10B981", icon: null } },
  { id: "20", user_id: "mock", category_id: "cat-shop",    title: "Bookstore",            type: "expense", amount: 35.00, transaction_date: "2025-04-20", created_at: "", updated_at: "", category: { id: "cat-shop",    name: "Shopping",      color: "#ec4899", icon: null } },
];

// ── Monthly chart data (6 months) ─────────────────────────────
export const monthlyData = [
  { month: "Dec",  income: 4200, expenses: 2800, savings: 1400 },
  { month: "Jan",  income: 4500, expenses: 3100, savings: 1400 },
  { month: "Feb",  income: 4500, expenses: 2600, savings: 1900 },
  { month: "Mar",  income: 4800, expenses: 3400, savings: 1400 },
  { month: "Apr",  income: 5450, expenses: 2900, savings: 2550 },
  { month: "May",  income: 5450, expenses: 2260, savings: 3190 },
];

// ── Spending line chart (daily, 30 days) ──────────────────────
export const dailySpending = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  amount: Math.round(40 + Math.random() * 120),
}));

// ── Category breakdown ────────────────────────────────────────
export const categoryBreakdown = [
  { name: "Food",          value: 620, color: "#ef4444" },
  { name: "Bills",         value: 450, color: "#f97316" },
  { name: "Shopping",      value: 390, color: "#ec4899" },
  { name: "Transport",     value: 280, color: "#3b82f6" },
  { name: "Entertainment", value: 180, color: "#8B5CF6" },
  { name: "Health",        value: 120, color: "#22c55e" },
];

// ── KPI sparkline data (7 points = last 7 weeks) ──────────────
export const kpiSparklines = {
  balance:  [21200, 22100, 21800, 23400, 22900, 24100, 24830],
  income:   [4200,  4200,  4500,  4500,  4800,  5450,  5450 ],
  expenses: [2800,  3100,  2600,  3400,  2900,  2200,  2260 ],
  savings:  [33,    26,    42,    24,    40,    51,    50   ],
};

// ── Budget data ───────────────────────────────────────────────
export const budgetData = [
  { category: "Food",          budget: 600,  spent: 620,  color: "#ef4444" },
  { category: "Bills",         budget: 450,  spent: 450,  color: "#f97316" },
  { category: "Shopping",      budget: 400,  spent: 390,  color: "#ec4899" },
  { category: "Transport",     budget: 300,  spent: 280,  color: "#3b82f6" },
  { category: "Entertainment", budget: 200,  spent: 180,  color: "#8B5CF6" },
  { category: "Health",        budget: 150,  spent: 120,  color: "#22c55e" },
];

// ── AI Insights ───────────────────────────────────────────────
export const mockInsights = [
  {
    id: "1",
    type: "warning" as const,
    title: "Dining Out Overspend",
    body: "You've spent 40% more on restaurants this month compared to your 3-month average. Consider meal prepping to save ~€120/month.",
    confidence: 0.92,
  },
  {
    id: "2",
    type: "positive" as const,
    title: "Great Savings Rate",
    body: "Your 49% savings rate this month is exceptional. You're on track to hit your annual savings goal 2 months early.",
    confidence: 0.98,
  },
  {
    id: "3",
    type: "tip" as const,
    title: "Subscription Audit",
    body: "You have 6 active subscriptions totalling €78.94/mo. Cancelling 2 unused ones could save €348 annually.",
    confidence: 0.85,
  },
  {
    id: "4",
    type: "tip" as const,
    title: "Invest Your Surplus",
    body: "With a consistent monthly surplus of €2,000+, allocating 20% to an index fund could grow to €28,000 in 5 years.",
    confidence: 0.79,
  },
  {
    id: "5",
    type: "positive" as const,
    title: "Bills Under Control",
    body: "Your utility and subscription bills are 12% below the average for your income bracket. You're managing fixed costs well.",
    confidence: 0.94,
  },
];

// ── Analytics heatmap data ────────────────────────────────────
export const heatmapData = [
  { week: "W1", Food: 180, Transport: 60,  Entertainment: 45,  Bills: 112, Shopping: 95,  Health: 30  },
  { week: "W2", Food: 145, Transport: 80,  Entertainment: 0,   Bills: 0,   Shopping: 200, Health: 0   },
  { week: "W3", Food: 160, Transport: 55,  Entertainment: 90,  Bills: 338, Shopping: 60,  Health: 90  },
  { week: "W4", Food: 135, Transport: 85,  Entertainment: 45,  Bills: 0,   Shopping: 35,  Health: 0   },
];

export const heatmapCategories = ["Food", "Transport", "Entertainment", "Bills", "Shopping", "Health"];
export const heatmapColors: Record<string, string> = {
  Food: "#ef4444", Transport: "#3b82f6", Entertainment: "#8B5CF6",
  Bills: "#f97316", Shopping: "#ec4899", Health: "#22c55e",
};

// ── Investments ───────────────────────────────────────────────
export type AssetType = "stock" | "crypto" | "etf" | "real_estate";
export type RiskLevel  = "low" | "medium" | "high";

export interface Investment {
  id: string;
  name: string;
  type: AssetType;
  quantity: number;
  buyPrice: number;
  currentPrice: number;
  risk: RiskLevel;
  date: string;
}

export const mockInvestments: Investment[] = [
  { id: "1", name: "Apple Inc",           type: "stock",       quantity: 10,    buyPrice: 150,    currentPrice: 178.50,  risk: "medium", date: "2024-09-01" },
  { id: "2", name: "Bitcoin",             type: "crypto",      quantity: 0.5,   buyPrice: 42000,  currentPrice: 67000,   risk: "high",   date: "2024-01-15" },
  { id: "3", name: "MSCI World ETF",      type: "etf",         quantity: 25,    buyPrice: 88,     currentPrice: 102,     risk: "low",    date: "2023-06-01" },
  { id: "4", name: "Tesla Inc",           type: "stock",       quantity: 5,     buyPrice: 220,    currentPrice: 175,     risk: "high",   date: "2024-03-10" },
  { id: "5", name: "Ethereum",            type: "crypto",      quantity: 2,     buyPrice: 2200,   currentPrice: 3400,    risk: "high",   date: "2024-02-20" },
  { id: "6", name: "S&P 500 ETF",         type: "etf",         quantity: 15,    buyPrice: 420,    currentPrice: 505,     risk: "low",    date: "2023-12-01" },
  { id: "7", name: "Frankfurt Apartment", type: "real_estate", quantity: 1,     buyPrice: 320000, currentPrice: 345000,  risk: "medium", date: "2022-08-15" },
];

export const portfolioHistory = [
  { month: "Nov", value: 388000 },
  { month: "Dec", value: 412000 },
  { month: "Jan", value: 398000 },
  { month: "Feb", value: 435000 },
  { month: "Mar", value: 421000 },
  { month: "Apr", value: 448000 },
  { month: "May", value: 462540 },
];

// ── Debts ─────────────────────────────────────────────────────
export type DebtStatus = "paid" | "pending" | "overdue";

export interface Debt {
  id: string;
  creditor: string;
  amount: number;
  paid: number;
  interestRate: number;
  dueDate: string;
  status: DebtStatus;
  notes?: string;
}

export const mockDebts: Debt[] = [
  { id: "1", creditor: "Deutsche Bank — Mortgage",  amount: 280000, paid: 45000,  interestRate: 2.1,  dueDate: "2045-01-01", status: "pending", notes: "Fixed rate until 2027" },
  { id: "2", creditor: "BMW Bank — Car Loan",        amount: 18000,  paid: 12000,  interestRate: 3.5,  dueDate: "2025-12-01", status: "pending" },
  { id: "3", creditor: "Student Loan",               amount: 8500,   paid: 8500,   interestRate: 0,    dueDate: "2024-06-01", status: "paid" },
  { id: "4", creditor: "Visa Credit Card",           amount: 2300,   paid: 0,      interestRate: 18.9, dueDate: "2025-04-30", status: "overdue", notes: "High interest — pay ASAP" },
  { id: "5", creditor: "Personal Loan",              amount: 1000,   paid: 500,    interestRate: 0,    dueDate: "2025-08-01", status: "pending" },
];
